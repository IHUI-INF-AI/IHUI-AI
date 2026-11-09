// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤规则配置入口 + 自签/扫码班级归属服务端化 契约锁(2026-11-08,本票①②)。
 * 全程不连库(§5 测试隔离铁律,PG 8810/Redis 8811 一条都不碰):db 层用"脚本化队列"
 * 假数据库(按调用顺序吐出预置行集),权限守卫整桩替身,HTTP 面走 Fastify inject 真路由。
 * 形状抄 tests/admin-batch-missed-ids.test.ts 的链式桩基座,不自造第二套真身判据 ——
 * normalizeHm/judgeStatus/HMAC 校验全部走生产实现,本文件只桩"库行为"与"权限授予与否"。
 *
 * 锁四格:
 *   A. PUT /attendance/rule 非法 HH:MM ⇒ 400 点名原值,且 insert 零调用(不静默回落,§0.3);
 *   B. 规则三端点响应不含 qrSecret 原文(GET 投影 / rotate 只回指纹);
 *   C. POST /attendance/self-check-in 当日无考勤行时仍按在册(enrolled)班级签成,
 *      客户端硬塞的 classId 被忽略(zod strip ⇒ 落库班级 = 服务端现取班级);
 *   D. 既无当日行又无在册 ⇒ 409 可读 reason,且零写库。
 */
import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const CLASS_B = 'bbbbbbbb-4222-8222-8222-222222222222'
const STUDENT = 'cccccccc-4333-8333-8333-333333333333'

const H = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  insertValues: [] as Record<string, unknown>[],
  updateSets: [] as Record<string, unknown>[],
  insertCalls: 0,
  updateCalls: 0,
}))

/** 按"操作种类"分队列的链式 thenable:select/insert/update 各自 pop 各自计数。 */
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
    ]) {
      step[m] = vi.fn((arg?: unknown) => {
        if (kind === 'insert' && m === 'values')
          H.insertValues.push((arg ?? {}) as Record<string, unknown>)
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
    select: vi.fn(() => makeChain('select')),
    insert: vi.fn(() => makeChain('insert')),
    update: vi.fn(() => makeChain('update')),
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

const PREFIX = '/api/edu-ai-management'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 学生端点(自签/扫码)无守卫、只读 request.userId:登录态由测试 app 钩子注入
  app.addHook('onRequest', async (request) => {
    ;(request as { userId?: string }).userId = STUDENT
  })
  await app.register(eduAiManagementRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

/** 假考勤行(与 eduAttendanceRecord 行形态同键)。 */
const attRow = (classId: string): Record<string, unknown> => ({
  id: 'dddddddd-4444-8444-8444-444444444444',
  studentId: STUDENT,
  classId,
  date: '2026-11-08',
  checkInTime: new Date(),
  checkOutTime: null,
  status: 'present',
  checkInMethod: 'self',
  operatedBy: STUDENT,
  remark: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
})

beforeEach(() => {
  H.selectQueue.length = 0
  H.insertQueue.length = 0
  H.updateQueue.length = 0
  H.insertValues.length = 0
  H.updateSets.length = 0
  H.insertCalls = 0
  H.updateCalls = 0
})

describe('A. PUT /attendance/rule:非法 HH:MM ⇒ 400 点名原值,不回落、零写库', () => {
  it("'上午4点' 被 normalizeHm 拒收 ⇒ 400 且 insert/update 均未发生", async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/rule`,
      payload: { classId: CLASS_A, lateAfter: '上午4点' },
    })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('上午4点')
    expect(H.insertCalls).toBe(0)
    expect(H.updateCalls).toBe(0)
  })

  it("合法形态 '9:00'(未补零)按 normalizeHm 单源放行(不发明第二把尺)", async () => {
    H.insertQueue.push([
      {
        id: 'r1',
        classId: CLASS_A,
        lateAfter: '09:00',
        earlyBefore: null,
        absentAfter: null,
        qrSecret: null,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'PUT',
      url: `${PREFIX}/attendance/rule`,
      payload: { classId: CLASS_A, lateAfter: '9:00' },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rule.lateAfter).toBe('09:00')
  })
})

describe('B. 规则出参绝不带密钥原文', () => {
  const SECRET = 'deadbeef'.repeat(8) // 64 位假密钥,只进库侧假行,绝不出现在响应

  it('GET /attendance/rule 命中规则行 ⇒ qrSecretConfigured=true 且响应全文不含密钥', async () => {
    H.selectQueue.push([
      {
        id: 'r1',
        classId: CLASS_A,
        lateAfter: '09:00',
        earlyBefore: '16:00',
        absentAfter: '09:30',
        qrSecret: SECRET,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ])
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/attendance/rule?classId=${CLASS_A}`,
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rule.qrSecretConfigured).toBe(true)
    expect(res.json().data.rule.qrSecret).toBeUndefined()
    expect(res.body).not.toContain(SECRET)
  })

  it('GET 无规则 ⇒ data.rule 为 null(不冒充空规则)', async () => {
    H.selectQueue.push([])
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `${PREFIX}/attendance/rule?classId=${CLASS_B}`,
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    expect(res.json().data.rule).toBeNull()
  })

  it('rotate-qr-secret ⇒ 只回 6 位指纹,64 位新密钥写入库侧但不出现在响应', async () => {
    H.updateQueue.push([{ id: 'r1', classId: CLASS_A, qrSecret: 'x', updatedAt: new Date() }])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/rule/rotate-qr-secret`,
      payload: { classId: CLASS_A },
    })
    await app.close()
    expect(res.statusCode).toBe(200)
    const body = res.json().data
    expect(body.rotated).toBe(true)
    expect(body.fingerprint).toMatch(/^[0-9a-f]{6}$/)
    expect(res.body.length).toBeLessThan(200) // 响应小:塞不下 64 位密钥
    const written = H.updateSets[0]?.qrSecret as string
    expect(written).toMatch(/^[0-9a-f]{64}$/)
    expect(written.startsWith(body.fingerprint)).toBe(true)
  })

  it('rotate 无规则行 ⇒ 404 点名先建档,不回显任何密钥', async () => {
    H.updateQueue.push([])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/rule/rotate-qr-secret`,
      payload: { classId: CLASS_B },
    })
    await app.close()
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toMatch(/[0-9a-f]{64}/)
  })
})

describe('C/D. POST /attendance/self-check-in:班级归属服务端现取,入参 classId 被忽略', () => {
  it('当日无考勤行但在册 ⇒ 按最近 enrolled 班级签成,硬塞的 classId 不生效', async () => {
    // resolve ①:当日考勤行无;②:enrolled 最近一条在 CLASS_A
    H.selectQueue.push([], [{ classId: CLASS_A }]) // resolveSelfCheckInClassId 两步
    H.selectQueue.push([{ id: 'e1' }], []) // checkInByStudent:在册校验 / 规则行(无规则→present)
    H.selectQueue.push([]) // 事务内既有行判重
    H.insertQueue.push([attRow(CLASS_A)])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: { classId: CLASS_B, remark: '放学后自签' }, // 客户端硬塞另一个班 ⇒ 必须被忽略
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.classId).toBe(CLASS_A)
    expect(data.status).toBe('present')
    expect(data.checkInTime).toBeTruthy()
    expect(H.insertValues[0]?.classId).toBe(CLASS_A)
    expect(H.insertValues[0]?.studentId).toBe(STUDENT)
  })

  it('当日已有考勤行 ⇒ 沿用该行班级(顺序①先于在册)', async () => {
    H.selectQueue.push([{ classId: CLASS_A }]) // resolve ① 命中
    H.selectQueue.push([{ id: 'e1' }], []) // 在册校验 / 规则
    H.selectQueue.push([]) // 注:该分支的判重在事务内 select;先给当日行后仍要过 checkInByStudent
    H.insertQueue.push([attRow(CLASS_A)])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: {},
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    expect(res.json().data.classId).toBe(CLASS_A)
  })

  it('既无当日行又无在册 ⇒ 409 可读 reason 且零写库(不许回落"随便挑一个班")', async () => {
    H.selectQueue.push([], [])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/self-check-in`,
      payload: { classId: CLASS_B },
    })
    await app.close()
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('未找到在读班级')
    expect(H.insertCalls).toBe(0)
  })
})

describe('扫码签到:入参不收 classId,班级从 HMAC 载荷解出', () => {
  const SECRET = 'cafebabe'.repeat(8)

  const makeToken = (classId: string, secret: string, exp: number): string => {
    const sig = createHmac('sha256', secret).update(`${classId}|${exp}`).digest('hex')
    return Buffer.from(JSON.stringify({ v: 1, classId, exp, sig }), 'utf8').toString('base64url')
  }

  it('token 内含 CLASS_A ⇒ 签到落 CLASS_A;签名不符的 token ⇒ 403', async () => {
    const exp = Date.now() + 60_000
    const token = makeToken(CLASS_A, SECRET, exp)
    const ruleRow = {
      classId: CLASS_A,
      lateAfter: null,
      earlyBefore: null,
      qrSecret: SECRET,
      enabled: true,
      deletedAt: null,
    }
    // 调用序:loadEnabled(select#1) → 在册校验(#2) → 事务内规则再读(#3) → 事务内判重(#4) → insert#1
    H.selectQueue.push([ruleRow], [{ id: 'e1' }], [ruleRow], [])
    H.insertQueue.push([attRow(CLASS_A)])
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/qrcode-check-in`,
      payload: { token, classId: CLASS_B }, // classId 传入也必被 strip、不参与判定
    })
    await app.close()
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.classId).toBe(CLASS_A)
    expect(H.insertValues[0]?.classId).toBe(CLASS_A)

    // 伪造签名(用错密钥)⇒ 403,零写库
    H.selectQueue.length = 0
    H.insertQueue.length = 0
    const badCallsBefore = H.insertCalls
    H.selectQueue.push([
      {
        classId: CLASS_A,
        lateAfter: null,
        earlyBefore: null,
        qrSecret: SECRET,
        enabled: true,
        deletedAt: null,
      },
    ])
    const forged = makeToken(CLASS_A, 'wrong-secret-padded-to-different-key', exp)
    const app2 = await buildApp()
    const res2 = await app2.inject({
      method: 'POST',
      url: `${PREFIX}/attendance/qrcode-check-in`,
      payload: { token: forged },
    })
    await app2.close()
    expect(res2.statusCode).toBe(403)
    expect(H.insertCalls).toBe(badCallsBefore)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
