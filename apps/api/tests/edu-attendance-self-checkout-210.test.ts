// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-210 姊妹面:学生本人签退 `POST /attendance/self-check-out` 只允许服务端当日(2026-11-08)。
 *
 * 缺陷:该端点 `const date = parsed.data.date ?? bizDayKey(new Date())` 直接采用客户端
 * `date`,而落库出口 `checkOutByStudent` 内 `checkOutTime = new Date()` —— 于是学生传
 * `{"date":"2026-11-07"}` 就能给历史考勤行补写"今天的签退时刻",与自签端点(F-210 主体)
 * 同型。教师代签 `PUT /attendance/check-out` 允许历史补签,不在本票范围。
 *
 * 本文件钉三组:
 *   a) 登录态 + date=昨天 ⇒ 400「仅允许当日签退」,且 select/update/insert/transaction 全零;
 *   b) 不传 date / 传服务端当日 ⇒ 正常签退(200),证明闸没有误伤当日路径;
 *   c) 未登录 ⇒ 401(且用非法 date 形态证明闸序是 鉴权→授权→校参数→动作)。
 *
 * 全程不连库(AGENTS §5):db 层是"脚本化队列"假库(按调用顺序吐预置行集),鉴权整桩;
 * 日期判据直接 import 生产 bizDayKey/shiftBizDayKey,不复制日历算法。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const STUDENT = 'cccccccc-4333-8333-8333-333333333333'
const PREFIX = '/api/edu-ai-management'
const ROUTE = `${PREFIX}/attendance/self-check-out`

/** 上海业务日 2026-11-08 00:30(UTC 仍是 11-07)⇒ 能区分"上海日键"与"UTC 日键"。 */
const FROZEN = new Date('2026-11-07T16:30:00.000Z')

const H = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  updateSets: [] as Record<string, unknown>[],
  insertValues: [] as Record<string, unknown>[],
  selectCalls: 0,
  updateCalls: 0,
  insertCalls: 0,
  transactionCalls: 0,
  /** 鉴权桩开关:c=false 时模拟真实 checkAuthOrInternalService 已回 401 的形态。 */
  authed: true,
}))

/** 按"操作种类"分队列的链式 thenable(形状抄 tests/edu-attendance-self-checkin-210.test.ts)。 */
vi.mock('../src/db/index.js', () => {
  const makeChain = (kind: 'select' | 'update' | 'insert') => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'values',
      'returning',
      'onConflictDoNothing',
      'onConflictDoUpdate',
      'orderBy',
      'limit',
      'offset',
    ]) {
      step[m] = vi.fn((arg?: unknown) => {
        if (kind === 'update' && m === 'set')
          H.updateSets.push((arg ?? {}) as Record<string, unknown>)
        if (kind === 'insert' && m === 'values')
          H.insertValues.push((arg ?? {}) as Record<string, unknown>)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (kind === 'select') H.selectCalls += 1
      if (kind === 'update') H.updateCalls += 1
      if (kind === 'insert') H.insertCalls += 1
      const q = kind === 'select' ? H.selectQueue : kind === 'update' ? H.updateQueue : H.insertQueue
      return Promise.resolve(q.length > 0 ? (q.shift() ?? []) : []).then(resolve, reject)
    }
    return step
  }
  const dbMock = {
    select: vi.fn(() => makeChain('select')),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('update')),
    delete: vi.fn(() => makeChain('select')),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      H.transactionCalls += 1
      return fn(dbMock)
    }),
  }
  return { db: dbMock, dbRead: dbMock }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

/** 鉴权桩:学生端点只认承载层注入的 request.userId;未登录时模拟真实插件"已发 401 再返回 false"。 */
vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async (_request: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!H.authed) {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
    return { valid: true, userId: STUDENT }
  }),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(async () => ({})),
}))

vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
import { bizDayKey, shiftBizDayKey } from '../src/utils/biz-day.js'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 学生端点只从承载层取主体;测试侧把"登录态"与真实验签链解耦(与同族用例同形)。
  app.addHook('onRequest', async (request) => {
    ;(request as { userId?: string }).userId = STUDENT
  })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

function attendanceRow(date: string): Record<string, unknown> {
  return {
    id: 'dddddddd-4444-8444-8444-444444444444',
    studentId: STUDENT,
    classId: CLASS_A,
    date,
    checkInTime: new Date('2026-11-07T23:00:00.000Z'),
    checkOutTime: null,
    status: 'present',
    checkInMethod: 'self',
    checkOutMethod: null,
    operatedBy: STUDENT,
    remark: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    deletedAt: null,
  }
}

function checkedOutRow(date: string): Record<string, unknown> {
  return {
    ...attendanceRow(date),
    checkOutTime: new Date(FROZEN),
    checkOutMethod: 'self',
    status: 'present',
  }
}

/**
 * 一次"可签退到落库"的读队列:
 *   ① resolveSelfCheckInClassId 当日考勤行(命中) ② checkOutByStudent 事务内既有行(命中)
 *   update returning ⇒ 改写后的行
 */
function scriptSelfCheckOut(date: string): void {
  H.selectQueue.push([{ classId: CLASS_A }], [attendanceRow(date)])
  H.updateQueue.push([checkedOutRow(date)])
}

beforeEach(() => {
  H.selectQueue.length = 0
  H.updateQueue.length = 0
  H.insertQueue.length = 0
  H.updateSets.length = 0
  H.insertValues.length = 0
  H.selectCalls = 0
  H.updateCalls = 0
  H.insertCalls = 0
  H.transactionCalls = 0
  H.authed = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FROZEN)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F-210 学生自助签退只允许服务端当日', () => {
  it('a) 传昨天 ⇒ 400「仅允许当日签退」,且零读零写(改前会继续走到写库)', async () => {
    const today = bizDayKey(FROZEN)
    const yesterday = shiftBizDayKey(today, -1)
    expect(today).toBe('2026-11-08')
    expect(yesterday).toBe('2026-11-07')
    // 队列刻意按"昨天能一路签成"预置:旧实现(按客户端 date 落库)会消费它并写入昨天,
    // 新实现必须在读库之前就 400 —— 两条断言同时锁住"拒绝"与"零副作用"。
    scriptSelfCheckOut(yesterday)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: ROUTE,
      payload: { date: yesterday },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('仅允许当日签退')
    expect(H.selectCalls).toBe(0)
    expect(H.updateCalls).toBe(0)
    expect(H.insertCalls).toBe(0)
    expect(H.transactionCalls).toBe(0)
    expect(H.updateSets).toEqual([])
    expect(H.insertValues).toEqual([])
  })

  it('b1) 不传 date ⇒ 走服务端 bizDayKey(上海 2026-11-08)正常签退', async () => {
    const today = bizDayKey(FROZEN)
    scriptSelfCheckOut(today)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: ROUTE,
      payload: {},
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    // 读序:① resolve 班级 ② 事务内既有行 ③ 规则(无)
    expect(H.selectCalls).toBe(3)
    expect(H.updateCalls).toBe(1)
    expect(H.transactionCalls).toBe(1)
    const data = res.json().data as Record<string, unknown>
    expect(data.classId).toBe(CLASS_A)
    expect(data.checkOutMethod).toBe('self')
  })

  it('b2) 传服务端当日 ⇒ 正常签退(闸不误伤当日路径)', async () => {
    const today = bizDayKey(FROZEN)
    scriptSelfCheckOut(today)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: ROUTE,
      payload: { date: today },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.selectCalls).toBe(3)
    expect(H.updateCalls).toBe(1)
    expect(H.updateSets).toHaveLength(1)
    expect(H.updateSets[0]?.checkOutMethod).toBe('self')
  })

  it('c) 未登录 ⇒ 401,且鉴权先于校参数/动作(零读零写)', async () => {
    H.authed = false
    // 用非法 date 形态:若"校参数"排在鉴权之前,这里会先回 400 —— 401 才证明闸序正确。
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: ROUTE,
      payload: { date: 'not-a-date' },
    })
    await app.close()
    expect(res.statusCode).toBe(401)
    expect(H.selectCalls).toBe(0)
    expect(H.updateCalls).toBe(0)
    expect(H.insertCalls).toBe(0)
    expect(H.transactionCalls).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
