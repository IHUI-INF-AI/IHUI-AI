// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-210:学生自助签到不得接受客户端传入的历史日期(2026-11-08)。
 *
 * 缺陷:POST /attendance/self-check-in 曾直接采用 body.date 作为考勤记录日期,
 * 于是学生传 {"date":"2026-01-01"} 就能循环补签/伪造整月考勤。
 *
 * 本文件钉四件事:
 *   a) 学生传昨天 ⇒ 400「仅允许当日签到」,且零读零写(insert 根本没被调用);
 *   b) 学生不传 date ⇒ 使用服务端 bizDayKey(Asia/Shanghai)当日值;
 *      冻结时刻取 UTC 2026-11-07T16:30Z(上海已跨到 11-08)⇒ 写入必须是 11-08;
 *   c) 学生传的是服务端当日 ⇒ 通过;
 *   d) 当日重复提交两次 ⇒ 第二次 409,且库侧只发生一次 insert(不产生第二行);
 *   e) 并发下"判重通过但 insert 撞唯一索引"⇒ 409 而非 500(created=false 走既有重复契约)。
 *
 * 全程不连库(AGENTS §5):db 层是"脚本化队列"假数据库(按调用顺序吐预置行集),
 * 权限守卫与鉴权整桩;日期判据直接从生产模块 import bizDayKey/shiftBizDayKey,不复制日历算法。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const STUDENT = 'cccccccc-4333-8333-8333-333333333333'
const PREFIX = '/api/edu-ai-management'

/** 上海业务日 2026-11-08 00:30(UTC 仍是 11-07)⇒ 能区分"上海日键"与"UTC 日键"。 */
const FROZEN = new Date('2026-11-07T16:30:00.000Z')

const H = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  insertValues: [] as Record<string, unknown>[],
  selectCalls: 0,
  insertCalls: 0,
}))

/** 按"操作种类"分队列的链式 thenable(形状抄 tests/edu-attendance-rule-crud-contract.test.ts)。 */
vi.mock('../src/db/index.js', () => {
  const makeChain = (kind: 'select' | 'insert') => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'values',
      'returning',
      'onConflictDoNothing',
      'onConflictDoUpdate',
      'orderBy',
      'limit',
      'offset',
    ]) {
      step[m] = vi.fn((arg?: unknown) => {
        if (kind === 'insert' && m === 'values')
          H.insertValues.push((arg ?? {}) as Record<string, unknown>)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const q = kind === 'select' ? H.selectQueue : H.insertQueue
      if (kind === 'select') H.selectCalls += 1
      if (kind === 'insert') H.insertCalls += 1
      return Promise.resolve(q.length > 0 ? (q.shift() ?? []) : []).then(resolve, reject)
    }
    return step
  }
  const dbMock = {
    select: vi.fn(() => makeChain('select')),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('select')),
    delete: vi.fn(() => makeChain('select')),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

/** 鉴权桩:学生端点只认承载层注入的 request.userId(见 buildApp 的 onRequest)。 */
vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async () => ({ valid: true, userId: STUDENT })),
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
    checkInTime: new Date(),
    checkOutTime: null,
    status: 'present',
    checkInMethod: 'self',
    operatedBy: STUDENT,
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }
}

/**
 * 一次"全新签到"的读队列:
 *   ① resolveSelfCheckInClassId 当日行(空) ② 在册报名(班级 A)
 *   ③ checkInByStudent 在册校验 ④ 规则(无) ⑤ 事务内判重(空)
 */
function scriptFreshCheckIn(date: string): void {
  H.selectQueue.push([], [{ classId: CLASS_A }], [{ id: 'e1' }], [], [])
  H.insertQueue.push([attendanceRow(date)])
}

beforeEach(() => {
  H.selectQueue.length = 0
  H.insertQueue.length = 0
  H.insertValues.length = 0
  H.selectCalls = 0
  H.insertCalls = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FROZEN)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('F-210 学生自助签到只允许服务端当日', () => {
  it('a) 传昨天 ⇒ 400「仅允许当日签到」,且 insert / select 均未发生', async () => {
    const today = bizDayKey(FROZEN)
    const yesterday = shiftBizDayKey(today, -1)
    // 队列刻意按"昨天能一路签成"预置:旧实现(按客户端 date 落库)会消费它并写入昨天,
    // 新实现必须在读库之前就 400 —— 两条断言同时锁住"拒绝"与"零副作用"。
    scriptFreshCheckIn(yesterday)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: { date: yesterday },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('仅允许当日签到')
    expect(H.insertCalls).toBe(0)
    expect(H.selectCalls).toBe(0)
    expect(H.insertValues).toEqual([])
  })

  it('b) 不传 date ⇒ 写入服务端 bizDayKey(上海 2026-11-08,而非 UTC 11-07)', async () => {
    const expected = bizDayKey(FROZEN)
    // 判据来自生产模块:冻结时刻的上海日键就是 11-08,而 UTC 日仍是 11-07。
    expect(expected).toBe('2026-11-08')
    scriptFreshCheckIn(expected)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: {},
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues).toHaveLength(1)
    expect(H.insertValues[0]?.date).toBe(expected)
    expect(H.insertValues[0]?.date).toBe('2026-11-08')
  })

  it('c) 传服务端当日 ⇒ 通过', async () => {
    const today = bizDayKey(FROZEN)
    scriptFreshCheckIn(today)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: { date: today },
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues[0]?.date).toBe(today)
  })

  it('d) 当日重复提交两次 ⇒ 第二次 409,且库侧只发生一次 insert', async () => {
    const today = bizDayKey(FROZEN)
    scriptFreshCheckIn(today)
    const app = await buildApp()
    const first = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: {},
    })
    expect(first.statusCode).toBe(201)

    // 第二次:resolve ① 命中当日行 ⇒ classId;在册校验/规则/事务判重(命中既有行)
    H.selectQueue.push([{ classId: CLASS_A }], [{ id: 'e1' }], [], [attendanceRow(today)])
    const second = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: {},
    })
    await app.close()
    expect(second.statusCode).toBe(409)
    expect(H.insertCalls).toBe(1)
    expect(H.insertValues).toHaveLength(1)
  })

  it('e) 并发撞唯一索引 ⇒ 409「今日已有考勤记录」,而不是 500', async () => {
    const today = bizDayKey(FROZEN)
    // 判重时空 ⇒ 进入 insert;insert 因唯一索引落空(空集)⇒ 复读命中既有行
    H.selectQueue.push([], [{ classId: CLASS_A }], [{ id: 'e1' }], [], [], [attendanceRow(today)])
    H.insertQueue.push([])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: {},
    })
    await app.close()
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('今日已有考勤记录')
    expect(H.insertCalls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
