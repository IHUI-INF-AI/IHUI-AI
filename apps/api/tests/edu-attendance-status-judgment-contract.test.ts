// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤状态"服务端现算"契约锁(2026-11-01 立,ATT-STATUS 票)。
 * 全程不连库(§5 测试隔离铁律,PG 8810/Redis 8811 一条都不碰):db 层用"脚本化队列"
 * 假数据库(按调用顺序吐出预置行集),权限守卫整桩替身,HTTP 面走 Fastify inject 真路由。
 * 形状抄同目录 edu-attendance-rule-crud-contract.test.ts 的链式桩基座,不自造第二套;
 * 迟到/早退判据零复制(§22c):本文件只从端点行为侧断言落库状态,阈值比较全走生产实现
 * (judgeStatus + edu-attendance-rule.ts),测试不内联任何 HH:MM 比较。
 *
 * 立因(实测三格死状态):
 *   ① PUT /attendance/check-out 此前只写 checkOutTime 不重判 status ⇒ early 在全系统
 *      没有任何写入路径(死状态);
 *   ② POST /attendance/check-in(教师代签)此前 `status: 客户端自报 || 'present'`,
 *      且 checkInTime 恒取服务器 now 而 date 允许回填过去 ⇒ 时刻与所属日期可跨日;
 *   ③ POST /attendance/batch-check-in 同②。
 * 修法口径 = checkInByStudent 既有正确形态(规则+judgeStatus 现算,不收客户端 status)
 * 推广到教师侧,本文件把它钉成契约。
 *
 * 锁格(正向+反向成对):
 *   A. 教师代签:迟到的代签真产出 late(正);客户端硬塞 status:'present' 不得改写服务端
 *      判定(反);回填非当日而无时刻 ⇒ 400 零写库;显式时刻跨日 ⇒ 400。
 *   B. 签退重判:早退场景真产出 early(正,系统内该状态自此唯一写入路径);
 *      leave/absent 高优先态签退后原样保留(反,且规则查询压根不发生 ⇒ 结构性不洗);
 *      阈值内签退仍 present(正对照,防"逢签退必判早退"的反向过度修正)。
 *   C. 批量点名:与 A 同口径(status 服务端现算,自报无效)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
// 业务日界唯一出口:测试取"某时刻所属日期键"必须走生产单源,不得在测试里再算一份时区(§0.6/守门 246)
import { bizDayKey, shiftBizDayKey } from '../src/utils/biz-day.js'

const CLASS_ID = 'aaaaaaaa-4111-8111-8111-111111111111'
const STUDENT_A = 'bbbbbbbb-4222-8222-8222-222222222222'
const STUDENT_B = 'cccccccc-4333-8333-8333-333333333333'
const TEACHER = 'dddddddd-4444-8444-8444-444444444444'

const H = vi.hoisted(() => ({
  /** 按调用顺序 pop 的 select 假行集(db 与 tx 共用同一条队列) */
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  insertValues: [] as Record<string, unknown>[],
  updateSets: [] as Record<string, unknown>[],
  selectCalls: 0,
  insertCalls: 0,
  updateCalls: 0,
}))

/** 链式 thenable 假库:select/insert/update 各自 pop 各自队列、各自计数。 */
vi.mock('../src/db/index.js', () => {
  const makeChain = (kind: 'select' | 'insert' | 'update') => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'onConflictDoNothing',
      'onConflictDoUpdate',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
      'having',
    ]) {
      step[m] = vi.fn((arg?: unknown) => {
        if (kind === 'insert' && m === 'values') {
          const arr = Array.isArray(arg) ? arg : [arg ?? {}]
          for (const one of arr) H.insertValues.push(one as Record<string, unknown>)
        }
        if (kind === 'update' && m === 'set')
          H.updateSets.push((arg ?? {}) as Record<string, unknown>)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const q =
        kind === 'select' ? H.selectQueue : kind === 'insert' ? H.insertQueue : H.updateQueue
      if (kind === 'insert') H.insertCalls += 1
      if (kind === 'update') H.updateCalls += 1
      return Promise.resolve(q.length > 0 ? (q.shift() ?? []) : []).then(resolve, reject)
    }
    return step
  }
  const dbMock = {
    select: vi.fn(() => {
      H.selectCalls += 1
      return makeChain('select')
    }),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('update')),
    delete: vi.fn(() => makeChain('select')),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock, dbWriter: dbMock, dbClient: {} }
})

vi.mock('../src/plugins/require-permission.js', () => ({
  requirePermission: () => async () => {},
  requireAnyPermission: () => async () => {},
  requireAdmin: async () => {},
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: vi.fn(async () => ({ valid: true, userId: TEACHER })),
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

const PREFIX = '/api/edu-ai-management'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 守卫已被桩成 no-op;教师代签的 operatedBy 读 request.userId,由测试钩子注入登录态
  app.addHook('onRequest', async (request) => {
    ;(request as { userId?: string }).userId = TEACHER
  })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

/** edu_attendance_rule 的假规则行(loadEnabledAttendanceRule 只取三键)。 */
const ruleRow = (
  lateAfter: string | null,
  earlyBefore: string | null,
): Record<string, unknown> => ({
  id: 'r1',
  classId: CLASS_ID,
  lateAfter,
  earlyBefore,
  absentAfter: null,
  qrSecret: null,
  enabled: true,
  deletedAt: null,
})

/** edu_attendance_record 的假既有行(签退重判的被审面)。 */
const existingRow = (over: Record<string, unknown>): Record<string, unknown> => ({
  id: 'eeeeeeee-4555-8555-8555-555555555555',
  studentId: STUDENT_A,
  classId: CLASS_ID,
  date: '2026-01-05',
  checkInTime: null,
  checkOutTime: null,
  status: 'present',
  checkInMethod: 'manual',
  checkOutMethod: null,
  operatedBy: TEACHER,
  remark: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...over,
})

/** 只在本地墙钟上造时刻,日期键一律经 bizDayKey 现算 ⇒ 断言与跑机时区无关。 */
function localAt(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(y, m, d, h, min)
}

beforeEach(() => {
  H.selectQueue.length = 0
  H.insertQueue.length = 0
  H.updateQueue.length = 0
  H.insertValues.length = 0
  H.updateSets.length = 0
  H.selectCalls = 0
  H.insertCalls = 0
  H.updateCalls = 0
})

afterEach(() => {
  vi.useRealTimers()
})

// =============================================================================
// A. POST /attendance/check-in(教师代签):status 服务端现算 + 时刻与日期同日
// =============================================================================

describe('A. 教师代签 POST /attendance/check-in', () => {
  it('正向:该班规则 lateAfter=09:00,服务器当前时刻 11:30 ⇒ 落库 status=late(不是 present)', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(inT)
    const day = bizDayKey(inT)
    H.selectQueue.push([ruleRow('09:00', '16:00')], []) // ①规则 ②事务内判重(无)
    H.insertQueue.push([existingRow({ date: day, status: 'late', checkInTime: inT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues).toHaveLength(1)
    expect(H.insertValues[0]?.status).toBe('late')
    expect((H.insertValues[0]?.checkInTime as Date).getTime()).toBe(inT.getTime())
    expect(H.insertValues[0]?.operatedBy).toBe(TEACHER)
  })

  it('反向:客户端硬塞 status:"present" ⇒ 服务端判定不被改写(zod strip 后自报值结构上进不了库)', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(inT)
    const day = bizDayKey(inT)
    H.selectQueue.push([ruleRow('09:00', '16:00')], [])
    H.insertQueue.push([existingRow({ date: day, status: 'late', checkInTime: inT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: {
        studentId: STUDENT_A,
        classId: CLASS_ID,
        date: day,
        status: 'present', // ← 修复前这一枚会直接落库
      },
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues[0]?.status).toBe('late')
  })

  it('反向:回填历史日但不给时刻 ⇒ 400 点名 checkInTime,零写库、零规则读取', async () => {
    const pastDay = shiftBizDayKey(bizDayKey(new Date()), -3)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: pastDay },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('checkInTime')
    expect(H.insertCalls).toBe(0)
    expect(H.selectCalls).toBe(0)
  })

  it('反向:显式 checkInTime 与 date 跨业务日 ⇒ 400 点名"同日",零写库', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    const wrongDay = shiftBizDayKey(bizDayKey(inT), 1) // 时刻在 wrongDay 的前一天,故意错开
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: {
        studentId: STUDENT_A,
        classId: CLASS_ID,
        date: wrongDay,
        checkInTime: inT.toISOString(),
      },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('同日')
    expect(H.insertCalls).toBe(0)
  })

  it('正向:显式 checkInTime 落在 date 当日内 ⇒ 按该时刻判定 late(回填有合法出路)', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    const day = bizDayKey(inT)
    H.selectQueue.push([ruleRow('09:00', null)], [])
    H.insertQueue.push([existingRow({ date: day, status: 'late', checkInTime: inT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: {
        studentId: STUDENT_A,
        classId: CLASS_ID,
        date: day,
        checkInTime: inT.toISOString(),
      },
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues[0]?.status).toBe('late')
    expect((H.insertValues[0]?.checkInTime as Date).getTime()).toBe(inT.getTime())
  })

  it('无规则班级(退化档):不发明默认阈值 ⇒ 判定走"阈值缺失"分支,落 present', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(inT)
    const day = bizDayKey(inT)
    H.selectQueue.push([], []) // 规则行不存在 ⇒ judgeStatus 阈值维全部不参与
    H.insertQueue.push([existingRow({ date: day })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/check-in`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(H.insertValues[0]?.status).toBe('present')
  })
})

// =============================================================================
// B. PUT /attendance/check-out(签退重判):early 唯一写入路径 + 高优先态保留
// =============================================================================

describe('B. 签退重判 PUT /attendance/check-out', () => {
  it('正向:present 记录 08:00 签到、14:00 签退,规则 earlyBefore=16:00 ⇒ status=early(全系统该状态的写入路径)', async () => {
    const outT = localAt(2026, 0, 5, 14, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(outT)
    const day = bizDayKey(outT)
    H.selectQueue.push(
      [existingRow({ date: day, status: 'present', checkInTime: localAt(2026, 0, 5, 8, 0) })],
      [ruleRow('09:00', '16:00')],
    )
    H.updateQueue.push([existingRow({ date: day, status: 'early', checkOutTime: outT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/check-out`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.updateSets).toHaveLength(1)
    expect(H.updateSets[0]?.status).toBe('early')
    expect((H.updateSets[0]?.checkOutTime as Date).getTime()).toBe(outT.getTime())
  })

  it('反向:leave(请假审批联动写入)签退后仍是 leave,且规则查询压根不发生(结构性不洗)', async () => {
    const outT = localAt(2026, 0, 5, 14, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(outT)
    const day = bizDayKey(outT)
    // 若实现错误地对 leave 也重判,下面这条规则行会把状态洗成 early ⇒ 断言同时抓两件事
    H.selectQueue.push([
      existingRow({ date: day, status: 'leave', checkInTime: localAt(2026, 0, 5, 8, 0) }),
    ])
    H.updateQueue.push([existingRow({ date: day, status: 'leave', checkOutTime: outT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/check-out`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.updateSets[0]?.status).toBe('leave')
    expect(H.selectCalls).toBe(1) // 只查了考勤行,没有问规则
    expect(H.updateSets[0]?.checkOutTime).toBeTruthy() // 签退时刻本身仍照常写入
  })

  it('反向:absent 记录签退后仍是 absent(即便时刻阈值全命中也不得洗成 early)', async () => {
    const outT = localAt(2026, 0, 5, 14, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(outT)
    const day = bizDayKey(outT)
    H.selectQueue.push([
      existingRow({ date: day, status: 'absent', checkInTime: localAt(2026, 0, 5, 8, 0) }),
    ])
    H.updateQueue.push([existingRow({ date: day, status: 'absent', checkOutTime: outT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/check-out`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.updateSets[0]?.status).toBe('absent')
    expect(H.selectCalls).toBe(1)
  })

  it('正对照:阈值内(08:00 签到、17:00 签退)重判后仍 present,reason 走 ok 档', async () => {
    const outT = localAt(2026, 0, 5, 17, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(outT)
    const day = bizDayKey(outT)
    H.selectQueue.push(
      [existingRow({ date: day, status: 'present', checkInTime: localAt(2026, 0, 5, 8, 0) })],
      [ruleRow('09:00', '16:00')],
    )
    H.updateQueue.push([existingRow({ date: day, status: 'present', checkOutTime: outT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/check-out`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.updateSets[0]?.status).toBe('present')
    expect(H.selectCalls).toBe(2) // present 非保留态 ⇒ 确实问了规则(重判发生过)
  })

  it('迟到修正联动:present 行 11:30 签到(阈值 09:00)、17:00 签退 ⇒ 重判补出 late', async () => {
    const outT = localAt(2026, 0, 5, 17, 0)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(outT)
    const day = bizDayKey(outT)
    H.selectQueue.push(
      [existingRow({ date: day, status: 'present', checkInTime: localAt(2026, 0, 5, 11, 30) })],
      [ruleRow('09:00', '16:00')],
    )
    H.updateQueue.push([existingRow({ date: day, status: 'late', checkOutTime: outT })])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/check-out`,
      payload: { studentId: STUDENT_A, classId: CLASS_ID, date: day },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(H.updateSets[0]?.status).toBe('late')
  })
})

// =============================================================================
// C. POST /attendance/batch-check-in(批量点名):与 A 同口径
// =============================================================================

describe('C. 批量点名 POST /attendance/batch-check-in', () => {
  it('正向+反向:11:30 点名、规则 lateAfter=09:00,客户端硬塞 status:"present" ⇒ 全员落库 late', async () => {
    const inT = localAt(2026, 0, 5, 11, 30)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(inT)
    H.selectQueue.push(
      [ruleRow('09:00', '16:00')], // resolveTeacherCheckIn:规则
      [{ studentId: STUDENT_A }, { studentId: STUDENT_B }], // 在册名单
      [], // 当日已有记录:无
    )
    H.insertQueue.push([
      { id: 'x1', studentId: STUDENT_A },
      { id: 'x2', studentId: STUDENT_B },
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/batch-check-in`,
      payload: { classId: CLASS_ID, status: 'present' }, // 自报值必须整族失效
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const data = res.json().data as Record<string, unknown>
    expect(data.status).toBe('late')
    expect(data.created).toBe(2)
    expect(H.insertValues).toHaveLength(2)
    for (const v of H.insertValues) {
      expect(v.status).toBe('late')
      expect((v.checkInTime as Date).getTime()).toBe(inT.getTime())
    }
  })

  it('反向:回填非当日而无 checkInTime ⇒ 400 点名,零写库', async () => {
    const pastDay = shiftBizDayKey(bizDayKey(new Date()), -2)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/batch-check-in`,
      payload: { classId: CLASS_ID, date: pastDay },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('checkInTime')
    expect(H.insertCalls).toBe(0)
    expect(H.selectCalls).toBe(0)
  })

  it('正向:显式 checkInTime 落在 date 当日 ⇒ 按该时刻判定,全员 present(阈值内)', async () => {
    const inT = localAt(2026, 0, 5, 8, 30)
    const day = bizDayKey(inT)
    H.selectQueue.push([ruleRow('09:00', '16:00')], [{ studentId: STUDENT_A }], [])
    H.insertQueue.push([{ id: 'x1', studentId: STUDENT_A }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/batch-check-in`,
      payload: { classId: CLASS_ID, date: day, checkInTime: inT.toISOString() },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('present')
    expect(H.insertValues[0]?.status).toBe('present')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
