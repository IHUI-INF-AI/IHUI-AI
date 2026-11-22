// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教师出码端点 `GET /attendance/qrcode` 的权限成对用例 + 越权面副作用复验
 * (台账 B19「考勤 /attendance/qrcode 零行为测试」收口,2026-11-06 立,**全程不连库**:
 * PG 8810 / Redis 8811 一条都不碰,DATABASE_URL 只是无人监听的哨兵字面量)。
 *
 * 立因(现读,不是推测):全仓 `edu-attendance-*` 用例里被引用过的是**扫码签到那一腿**
 * (`POST /attendance/qrcode-check-in`,见 edu-attendance-rule-crud-contract.test.ts 的
 * 「扫码签到:入参不收 classId」),而**出码这一腿**从未被任何用例打到过 —— 它又恰好是
 * 唯一把 `qrSecret` 拿去做 HMAC 的出口。"谁能出码""被拒时会不会已经把密钥带出仓外"
 * 两格都没人验过(AGENTS §5:认证不等于授权)。本文件把这两格钉住:权限链走真身
 * (`requirePermission('edu:manage')` → `authenticate` → RBAC 判序与 admin 豁免全不桩),
 * 只替两件测试装置 —— ①「该用户是否被授予该权限点」、② 假数据库(规则表谓词真求值)。
 *
 * 尺子:
 *   1. 成对留正向对照:持 edu:manage ⇒ 200 且出的码**能被生产校验器判过**;
 *      匿名 ⇒ 401、只有 edu:view ⇒ 403、无任何权限点 ⇒ 403,三条都零读零写;
 *   2. 越权用例断言"副作用没发生":被拒后 ① 零写链 ② 规则表逐字节未变 ③ 一次库都没查
 *      ④ 响应全文不含 qrSecret 原文(出码端点的"副作用"还包括密钥泄露,不止数据库);
 *   3. 身份不得来自客户端可整写的字段:query 里自报 `userId`/`operatorId`/`roleId`/`admin`
 *      换不来放行,这些键也进不了谓词;
 *   4. 判据零复制(§22c):签名/过期/换班三类失败一律 import helpers 的
 *      `verifyAttendanceQrToken`/`decodeAttendanceQrToken`/`ATT_QR_FAILURE_MESSAGES`/
 *      `ATT_QR_TOKEN_TTL_MS` 单源判定,测试侧不自拼 HMAC、不抄第二份失败码表。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。每轮用例前清零。 */
const H = vi.hoisted(() => {
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'

  /** drizzle 条件对象 → 绑定的字面值与裸 SQL 片段(假库解答器唯一实现,非生产判据副本)。 */
  const literalsOf = (node: unknown, out: string[] = [], depth = 0): string[] => {
    if (node === null || node === undefined || depth > 24) return out
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      out.push(String(node))
      return out
    }
    if (Array.isArray(node)) {
      for (const child of node) literalsOf(child, out, depth + 1)
      return out
    }
    if (typeof node !== 'object') return out
    const rec = node as Record<string, unknown>
    for (const key of ['queryChunks', 'value', 'inlineParam', 'inlineParams', 'params']) {
      if (key in rec) literalsOf(rec[key], out, depth + 1)
    }
    return out
  }

  return {
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    literalsOf,
    permGrants: new Set<string>(),
    statusOverrides: new Map<string, number>(),
    /** 世界状态 = edu_attendance_rule 表(出码只读它;写侧一律记账,越权用例断言恒空)。 */
    rules: [] as Array<Record<string, unknown>>,
    reads: 0,
    wheres: [] as unknown[],
    writes: [] as string[],
    insertValues: [] as Array<Record<string, unknown>>,
    updateSets: [] as Array<Record<string, unknown>>,
  }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/forbidden-in-mock-tests',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * 假数据库:出码链路只经 `loadEnabledAttendanceRule` 查 edu_attendance_rule 一张表,
 * 故 select 按"规则表谓词"求值(eq(classId) ∧ eq(enabled,true) ∧ isNull(deletedAt))。
 * 写侧任何一笔都记账 —— 本端点是只读的,越权用例与正控用例都要看到 writes 恒空。
 */
vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'having'] as const

  const answerRules = (predicate: unknown): Array<Record<string, unknown>> => {
    const lits = H.literalsOf(predicate)
    // eq(enabled, true) 把布尔值 true 作为字面值绑进谓词(drizzle 的列名不在取值通道里);
    // GET /attendance/rule 那条只有 eq(classId)+isNull(deletedAt),不含 'true'。
    const requiresEnabledTrue = lits.includes('true')
    return H.rules.filter((row) => {
      if (row.deletedAt !== null && row.deletedAt !== undefined) return false
      if (!lits.includes(String(row.classId))) return false
      if (requiresEnabledTrue && row.enabled !== true) return false
      return true
    })
  }

  const readChain = () => {
    const slot = H.reads
    H.reads += 1
    H.wheres[slot] = undefined
    let rows: Array<Record<string, unknown>> = []
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          rows = answerRules(arg)
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }

  const writeChain = (kind: string) => {
    H.writes.push(kind)
    const step: Record<string, unknown> = {}
    for (const m of ['values', 'set', 'where', 'returning', 'onConflictDoNothing', 'onConflictDoUpdate']) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'values') H.insertValues.push((arg ?? {}) as Record<string, unknown>)
        if (m === 'set') H.updateSets.push((arg ?? {}) as Record<string, unknown>)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const dbMock = {
    select: vi.fn(() => readChain()),
    insert: vi.fn(() => writeChain('insert')),
    update: vi.fn(() => writeChain('update')),
    delete: vi.fn(() => writeChain('delete')),
    execute: vi.fn(() => {
      H.writes.push('execute')
      return Promise.resolve([])
    }),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      H.writes.push('transaction')
      return cb(dbMock)
    }),
  }
  return {
    db: dbMock,
    dbRead: { select: vi.fn(() => readChain()) },
    dbWriter: { select: vi.fn(() => readChain()) },
    dbClient: {},
  }
})

vi.mock('../src/db/notification-queries.js', () => ({ createNotification: vi.fn() }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
}))
vi.mock('../src/services/wechat-subscribe-message.js', () => ({
  isSubscribeMessageConfigured: vi.fn(() => false),
  getWechatMiniOpenId: vi.fn(async () => null),
  buildFeeReminderData: vi.fn(() => ({})),
  sendSubscribeMessage: vi.fn(async () => ({ ok: false, errcode: 0 })),
}))

/** RBAC 授予查询桩:只答"授予集里有没有这一条";判序 / 401-403 / admin 豁免全走真实 require-permission。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

/** 承载层验签桩:只替"验签"这一步,其余 authenticate 链是真身 ⇒ 身份只能由承载层注入。 */
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    verifyAccessToken: vi.fn(async (token: string) => {
      const reject = (): never => {
        throw Object.assign(new Error('JWS signature verification failed'), {
          code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
          statusCode: 401,
        })
      }
      const parts = String(token).split('.')
      if (parts.length !== 3) reject()
      if (parts[2] !== H.sigOf(`${parts[0]}.${parts[1]}`)) reject()
      let claims: Record<string, unknown> | null = null
      try {
        claims = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >
      } catch {
        reject()
      }
      if (!claims || typeof claims.userId !== 'string' || claims.userId === '') reject()
      return { phone: '', familyId: '', roleId: 0, ...claims }
    }),
    // 2026-11-11:生产 authenticateInner 已改 fail-closed——getTokenBlacklist() 返回 null
    // 即判 token「已吊销」⇒ 401。测试环境 createBlacklist 内部 new IORedis 恒连不上 ⇒ null
    // ⇒ 合法 token 被 401。覆盖为内存假黑名单(has 恒 false)。不回退生产 fail-closed 语义。
    createBlacklist: vi.fn(() => ({
      async has() {
        return false
      },
      async add() {},
      async revoke() {},
    })),
  }
})

vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getUserStatus: vi.fn(async (id: string) => H.statusOverrides.get(id) ?? 1),
  }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
// §22c:签名/过期/换班/失败码/有效期这五把尺一律 import 生产单源,测试侧零复制。
import {
  ATT_QR_FAILURE_MESSAGES,
  ATT_QR_TOKEN_TTL_MS,
  decodeAttendanceQrToken,
  verifyAttendanceQrToken,
} from '../src/routes/edu-ai-management-attendance-helpers.js'

const PREFIX = '/api/edu-ai-management'
const ROUTES_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
  'utf8',
)

const CLASS_A = 'aaaaaaaa-4111-8111-8111-111111111111'
const CLASS_B = 'bbbbbbbb-4222-8222-8222-222222222222'
const TEACHER = 'cccccccc-4333-8333-8333-333333333333' // 持 edu:manage
const VIEWER = 'dddddddd-4444-8444-8444-444444444444' // 只持 edu:view
const PLAIN = 'eeeeeeee-4555-8555-8555-555555555555' // 无任何权限点
const ADMIN = 'ffffffff-4666-8666-8666-666666666666' // roleId>=1,走真实豁免臂
const SECRET = 'cafebabe'.repeat(8) // 64 位假密钥:只进库侧,绝不出现在响应

function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

let appPromise: Promise<FastifyInstance> | null = null
async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    const app = Fastify({ logger: false })
    app.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(eduAiManagementRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

interface Call {
  method: 'GET'
  path: string
  as?: string
  claims?: Record<string, unknown>
  query?: Record<string, string>
}

interface Res {
  statusCode: number
  body: Record<string, unknown>
  raw: string
}

async function call(o: Call): Promise<Res> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as, o.claims ?? {})}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({ method: o.method, url: `${PREFIX}${o.path}${qs}`, headers })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { statusCode: res.statusCode, body, raw: res.body }
}

function seedRule(row: {
  classId: string
  lateAfter?: string | null
  qrSecret?: string | null
  enabled?: boolean
}): void {
  H.rules.push({
    id: `rule-seed-${H.rules.length + 1}`,
    classId: row.classId,
    lateAfter: row.lateAfter ?? null,
    earlyBefore: null,
    absentAfter: null,
    qrSecret: row.qrSecret ?? null,
    enabled: row.enabled ?? true,
    deletedAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  })
}

const snapshotRules = (): string => JSON.stringify(H.rules)
interface QrData {
  payload: string
  classId: string
  expiresAt: string
  ttlMs: number
}
const qrDataOf = (res: Res): QrData => {
  const data = res.body.data as QrData | undefined
  expect(data, `响应体没有 data 段(状态码 ${res.statusCode}):${res.raw.slice(0, 200)}`).toBeDefined()
  return data as QrData
}
/** 从响应里取 token:优先走生产 decode 出口,形态不合即为夹具失效(不猜)。 */
function tokenOf(data: QrData): string {
  const payload = JSON.parse(data.payload) as { token?: unknown }
  expect(typeof payload.token, '出码载荷必须含 token').toBe('string')
  return String(payload.token)
}
/** 拒绝面的"副作用没发生"三连:零读 + 零写 + 规则表逐字节未变,外加密钥不外泄。 */
function expectRejectedNoEffect(res: Res, before: string): void {
  expect(H.reads, '权限不成立时连规则表都不该被查').toBe(0)
  expect(H.writes, '出码是只读端点,任何情况下都不该有写链').toEqual([])
  expect(snapshotRules(), 'edu_attendance_rule 表必须逐字节未变').toBe(before)
  expect(res.raw).not.toContain(SECRET)
}

function resetWorld(): void {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.rules.length = 0
  H.reads = 0
  H.wheres.length = 0
  H.writes.length = 0
  H.insertValues.length = 0
  H.updateSets.length = 0
}

beforeEach(() => resetWorld())
afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

describe('接线锁:出码端点不得摘掉 edu:manage 守卫(内容锚点,不写行号)', () => {
  it("server.get('/attendance/qrcode' 的处理器第一行是 requireEduManage", () => {
    const registration = `server.get('/attendance/qrcode'`
    const start = ROUTES_SOURCE.indexOf(registration)
    expect(start, '出码端点必须仍注册在路由面上').toBeGreaterThan(-1)
    expect(ROUTES_SOURCE.slice(start, start + 300)).toContain('requireEduManage(request, reply)')
    // 反向锁:出码这条不能被人顺手改成 requireEduView(只读权限即可出码 = 提权)
    expect(ROUTES_SOURCE.slice(start, start + 300)).not.toContain('requireEduView(request, reply)')
  })
})

describe('A. 正向对照:持 edu:manage 出码,且出的码真能被生产校验器判过', () => {
  it('200 ⇒ 载荷形状齐备、token 对 CLASS_A + 该班密钥验签通过、TTL 取单源常量', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00', qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.code).toBe(0)
    const data = qrDataOf(res)
    expect(data.classId).toBe(CLASS_A)
    expect(data.ttlMs).toBe(ATT_QR_TOKEN_TTL_MS)
    const payload = JSON.parse(data.payload) as Record<string, unknown>
    expect(payload.type).toBe('edu-attendance-checkin')
    expect(payload.classId).toBe(CLASS_A)

    const token = tokenOf(data)
    const decoded = decodeAttendanceQrToken(token)
    expect(decoded, 'token 必须能被单源 decode 出口解开').not.toBeNull()
    expect(decoded?.classId).toBe(CLASS_A)
    // 判据零复制:验签走生产 verifyAttendanceQrToken,null = 通过
    expect(verifyAttendanceQrToken(token, CLASS_A, SECRET, Date.now())).toBeNull()
    expect(new Date(decoded?.exp ?? 0).getTime()).toBe(new Date(data.expiresAt).getTime())
    // 出码是只读:整条链路一笔写都没有
    expect(H.writes).toEqual([])
    expect(snapshotRules()).not.toBe('[]')
  })

  it('响应全文不含 qrSecret 原文(密钥只做 HMAC 的 key,不出仓)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
    expect(res.raw).not.toContain(SECRET)
    // 码里也不得内嵌密钥:解码后的载荷键集只有 v/classId/exp/sig
    const keys = Object.keys(
      JSON.parse(Buffer.from(tokenOf(qrDataOf(res)), 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >,
    ).sort()
    expect(keys).toEqual(['classId', 'exp', 'sig', 'v'])
  })

  it('admin 臂(roleId>=1)经真实豁免链同样可出码,且判据不落在授予集上', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: ADMIN,
      claims: { roleId: 1 },
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
    expect(H.permGrants.size, '豁免臂不应依赖授予集').toBe(0)
    expect(H.writes).toEqual([])
  })
})

describe('B. 拒绝面三条(匿名 401 / 只有 edu:view 403 / 无任何权限点 403)—— 逐条断言副作用未发生', () => {
  it('无 token ⇒ 401,零读零写、规则表未变、密钥未外泄', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(401)
    expect(res.body.code).toBe(401)
    expectRejectedNoEffect(res, before)
  })

  it("只有 edu:view ⇒ 403(出码不是'能看考勤'的附属能力),零读零写、规则表未变", async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    H.permGrants.add(`${VIEWER}|edu:view`)
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: VIEWER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(403)
    expectRejectedNoEffect(res, before)
    // 成对正向对照:同一枚主体、同一份载荷,补上 edu:manage 就该成功
    H.permGrants.add(`${VIEWER}|edu:manage`)
    const ok = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: VIEWER,
      query: { classId: CLASS_A },
    })
    expect(ok.statusCode).toBe(200)
  })

  it('已登录但无任何权限点 ⇒ 403,零读零写、规则表未变(登录本身不构成授权)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: PLAIN,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(403)
    expectRejectedNoEffect(res, before)
  })

  it('鉴权先于形状闸:匿名 + 非法 classId ⇒ 仍是 401,不用 400 承认这条路存在', async () => {
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      query: { classId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(401)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })
})

describe('C. 身份不来自客户端可整写字段', () => {
  it('无权主体在 query 里自报 userId/operatorId/roleId/admin ⇒ 仍 403,且这些键进不了谓词', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: PLAIN,
      query: {
        classId: CLASS_A,
        userId: TEACHER,
        operatorId: TEACHER,
        roleId: '1',
        admin: 'true',
      },
    })
    expect(res.statusCode).toBe(403)
    expectRejectedNoEffect(res, before)
    const lits = H.wheres.flatMap((w) => (w === undefined ? [] : H.literalsOf(w)))
    expect(lits, '自报身份键不得进任何谓词').not.toContain(TEACHER)
  })

  it('有权主体自报多余的 studentId/userId 不改变出码结果,也不进谓词(班级只认 classId 入参)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A, userId: PLAIN, studentId: PLAIN },
    })
    expect(res.statusCode).toBe(200)
    expect(qrDataOf(res).classId).toBe(CLASS_A)
    const lits = H.wheres.flatMap((w) => (w === undefined ? [] : H.literalsOf(w)))
    expect(lits, '查询谓词只按 classId 取规则,不被自报主体左右').not.toContain(PLAIN)
  })
})

describe('D. 配置缺失/换班复用:出码端的边界与码的班级绑定', () => {
  it('该班无规则 ⇒ 400 点名未配置,零写、且不发出任何 token', async () => {
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_B },
    })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toContain('qrSecret')
    expect(H.writes).toEqual([])
    expect(res.raw).not.toContain('"token"')
    expect(snapshotRules()).toBe('[]')
  })

  it('规则在但 qrSecret 为空 ⇒ 400,零写(没有密钥就不能伪造一张"可用"的码)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: null })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(400)
    expect(H.writes).toEqual([])
    expect(res.raw).not.toContain('"token"')
  })

  it('enabled=false 的规则不被采信 ⇒ 400;同班同密钥一旦 enabled 即 200(谓词真的在筛 enabled)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET, enabled: false })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const off = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(off.statusCode).toBe(400)
    expect(H.writes).toEqual([])

    // 成对正向对照:把世界状态里的开关翻真(等价于库里改了配置),同一请求即成功
    H.rules.forEach((r) => {
      r.enabled = true
    })
    const on = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(on.statusCode).toBe(200)
    expect(
      verifyAttendanceQrToken(
        tokenOf(qrDataOf(on)),
        CLASS_A,
        SECRET,
        new Date(qrDataOf(on).expiresAt).getTime(),
      ),
    ).toBeNull()
  })

  it('码与班级绑定:A 班的码拿去按 B 班校验必须失败(失败码取自单源表,不静默通过)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    seedRule({ classId: CLASS_B, qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
    const token = tokenOf(qrDataOf(res))
    const failure = verifyAttendanceQrToken(token, CLASS_B, SECRET, Date.now())
    expect(failure).toBe('TOKEN_CLASS_MISMATCH')
    expect(ATT_QR_FAILURE_MESSAGES.TOKEN_CLASS_MISMATCH).toBeTruthy()
    // 过期同样判负:把校验时刻推到有效期之后
    const expired = verifyAttendanceQrToken(
      token,
      CLASS_A,
      SECRET,
      new Date(qrDataOf(res).expiresAt).getTime() + 1,
    )
    expect(expired).toBe('TOKEN_EXPIRED')
  })

  it('软删的规则行不被采信(谓词里的 isNull(deletedAt) 真在生效)', async () => {
    seedRule({ classId: CLASS_A, qrSecret: SECRET })
    H.rules.forEach((r) => {
      r.deletedAt = new Date('2026-11-05T00:00:00.000Z')
    })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/qrcode',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(400)
    expect(H.writes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
