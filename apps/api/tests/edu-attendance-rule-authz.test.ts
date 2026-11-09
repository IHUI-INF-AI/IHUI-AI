// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤规则端点 `GET /attendance/rule` 与 `PUT /attendance/rule` 的权限成对用例 + 越权面
 * 副作用复验(台账 B21「考勤 /attendance/rule 零行为测试」收口,2026-11-06 立,**全程不连库**:
 * PG 8810 / Redis 8811 一条都不碰,DATABASE_URL 只是无人监听的哨兵字面量)。
 *
 * 立因(现读,不是推测):该两条端点此前只有一枚 `edu-attendance-rule-crud-contract.test.ts`,
 * 而那枚把 `plugins/require-permission.js` 整桩替成 no-op(见其 vi.mock 段)⇒「谁能写规则 /
 * 无权限的人会不会留下副作用」这一格从未被真判过。本文件补的就是这一格:权限链走真身
 * (`requirePermission` → `authenticate` → RBAC 判序与 admin 豁免全不桩),只替两件测试装置 ——
 * ①「该用户是否被授予该权限点」(db/rbac-queries.checkAnyPermission)、② 假数据库
 * (且这张假库**真的会改世界状态**,于是"数据未被改动"是读得回来的事实,不是调用计数)。
 *
 * 尺子(与 AGENTS §5 一一对应):
 *   1. 成对留正向对照:合法主体成功(200 + 世界状态真的变了)与非法主体被拒(401/403)两半都有;
 *   2. 越权用例断言"副作用没发生":拒绝之后 ① 零写链调用 ② 规则表逐字节未变 ③ 再经 GET 读回
 *      阈值仍是旧值 —— 三条同时成立才算过;
 *   3. 身份不得来自客户端可整写的字段:把 `userId` / `operatorId` / `roleId` / `qrSecret` 塞进
 *      query 或 body,判据只认承载层(authenticate)注入的主体 ⇒ 结论仍是被拒,且这些键进不了写载荷;
 *   4. 判据零复制(§22c):阈值归一化只 import `normalizeHm` 单源,状态判定只 import
 *      `services/edu-attendance-rule` 的 `__test__` 出口,出参投影只 import `toAttendanceRuleDto`。
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
    /** RBAC 授予集:"<userId>|<permission>" 命中即 checkAnyPermission 返真(只答授予与否,判序是真身) */
    permGrants: new Set<string>(),
    /** users.status 覆盖表(缺省 1=正常) */
    statusOverrides: new Map<string, number>(),
    /** 世界状态 = edu_attendance_rule 表(unique 键 classId)。写侧真的改这里,故可"读回复验"。 */
    rules: [] as Array<Record<string, unknown>>,
    /** 读侧:select 次数与每次 where 收到的谓词(用于断言"权限不成立时连表都没查") */
    reads: 0,
    wheres: [] as unknown[],
    /** 写侧记账(insert/update/delete 各一笔)—— 越权用例必须恒空 */
    writes: [] as string[],
    /** insert().values(v) 收到的载荷逐条留档:自报身份键是否进库,直接对它断言 */
    insertValues: [] as Array<Record<string, unknown>>,
    /** update().set(v) / onConflictDoUpdate({set}) 收到的载荷逐条留档 */
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
 * 假数据库:本文件三枚端点只碰 edu_attendance_rule 一张表,故 select 一律按"规则表谓词"解答;
 * insert 走 classId 唯一键 upsert(与路由的 onConflictDoUpdate 同形),**真的写进 H.rules**。
 */
vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'groupBy',
    'having',
  ] as const

  /** 谓词解答器:假如这是真库,这条 where 会命中哪些规则行。 */
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

  /** classId 唯一键 upsert:命中则合并 set(只写本次给出的键),未命中则新建一行(带列默认值)。 */
  const applyUpsert = (
    values: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Record<string, unknown> => {
    const classId = String(values.classId ?? '')
    const idx = H.rules.findIndex((r) => String(r.classId) === classId)
    if (idx >= 0) {
      const merged = { ...(H.rules[idx] ?? {}), ...values, ...set }
      H.rules[idx] = merged
      return merged
    }
    const created: Record<string, unknown> = {
      id: `rule-${H.rules.length + 1}`,
      classId,
      lateAfter: null,
      earlyBefore: null,
      absentAfter: null,
      qrSecret: null,
      enabled: true,
      deletedAt: null,
      createdAt: new Date('2026-11-06T00:00:00.000Z'),
      updatedAt: new Date('2026-11-06T00:00:00.000Z'),
      ...values,
      ...set,
    }
    H.rules.push(created)
    return created
  }

  const insertChain = () => {
    H.writes.push('insert')
    let values: Record<string, unknown> = {}
    let conflictSet: Record<string, unknown> = {}
    let applied: Record<string, unknown> | null = null
    // 落库只发生一次:returning 与 thenable 两条出口都取这一份(否则 await 形态一变就写两遍)
    const applyOnce = (): Record<string, unknown> => {
      if (!applied) applied = applyUpsert(values, conflictSet)
      return applied
    }
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Record<string, unknown>) => {
      values = v
      H.insertValues.push(v)
      return step
    })
    step.onConflictDoUpdate = vi.fn((cfg: { set?: Record<string, unknown> }) => {
      conflictSet = cfg.set ?? {}
      H.updateSets.push(conflictSet)
      return step
    })
    step.onConflictDoNothing = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([applyOnce()]))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([applyOnce()]).then(resolve, reject)
    return step
  }

  const updateChain = () => {
    H.writes.push('update')
    let set: Record<string, unknown> = {}
    let predicate: unknown
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Record<string, unknown>) => {
      set = v
      H.updateSets.push(v)
      return step
    })
    step.where = vi.fn((p: unknown) => {
      predicate = p
      return step
    })
    step.returning = vi.fn(() =>
      Promise.resolve(
        answerRules(predicate).map((row) => {
          const merged = { ...row, ...set }
          const at = H.rules.findIndex((r) => String(r.classId) === String(row.classId))
          if (at >= 0) H.rules[at] = merged
          return merged
        }),
      ),
    )
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const dbMock = {
    select: vi.fn(() => readChain()),
    insert: vi.fn(() => insertChain()),
    update: vi.fn(() => updateChain()),
    delete: vi.fn(() => {
      H.writes.push('delete')
      return { where: vi.fn(() => Promise.resolve([])) }
    }),
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
// §22c:判据零复制 —— 三处都 import 生产单源,测试侧不写第二份阈值表/投影表/判定表。
import { normalizeHm } from '../src/services/edu-schedule-conflict.js'
import { __test__ as ruleJudge } from '../src/services/edu-attendance-rule.js'
import {
  toAttendanceRuleDto,
  type AttendanceRuleRow,
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
const SECRET = 'deadbeef'.repeat(8) // 64 位假密钥:只进库侧,绝不出现在响应

type Method = 'GET' | 'PUT'

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
  method: Method
  path: string
  as?: string
  claims?: Record<string, unknown>
  query?: Record<string, string>
  body?: Record<string, unknown>
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
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${o.path}${qs}`,
    headers,
    ...(o.body === undefined ? {} : { payload: o.body }),
  })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  return { statusCode: res.statusCode, body, raw: res.body }
}

/** 世界状态里种一枚规则行(列默认值与 edu_attendance_rule 定义同形)。 */
function seedRule(row: {
  classId: string
  lateAfter?: string | null
  earlyBefore?: string | null
  absentAfter?: string | null
  qrSecret?: string | null
  enabled?: boolean
}): void {
  H.rules.push({
    id: `rule-seed-${H.rules.length + 1}`,
    classId: row.classId,
    lateAfter: row.lateAfter ?? null,
    earlyBefore: row.earlyBefore ?? null,
    absentAfter: row.absentAfter ?? null,
    qrSecret: row.qrSecret ?? null,
    enabled: row.enabled ?? true,
    deletedAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  })
}

const snapshotRules = (): string => JSON.stringify(H.rules)
const ruleFor = (classId: string): Record<string, unknown> | undefined =>
  H.rules.find((r) => String(r.classId) === classId)
/** 过线后的响应体与"生产投影出口 + JSON 序列化"逐字对齐(Dates 走 ISO,不手搓字段清单)。 */
const dtoJson = (classId: string): unknown => {
  const row = ruleFor(classId)
  return JSON.parse(JSON.stringify(toAttendanceRuleDto(row as unknown as AttendanceRuleRow)))
}
/** 拒绝面的"副作用没发生"两连:零写链 + 表逐字节未变(读回那一维由各用例自己复验)。 */
function expectNoSideEffect(before: string): void {
  expect(H.writes, '被拒之后不得有任何写链调用').toEqual([])
  expect(snapshotRules(), 'edu_attendance_rule 表必须逐字节未变').toBe(before)
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

describe('接线锁:两条端点各自挂的守卫不得回退(内容锚点,不写行号)', () => {
  it('GET 走 requireEduView、PUT 走 requireEduManage,且都在处理器第一行', () => {
    const targets = [
      [`server.get('/attendance/rule'`, 'requireEduView(request, reply)'],
      [`server.put('/attendance/rule'`, 'requireEduManage(request, reply)'],
    ] as const
    for (const [registration, guard] of targets) {
      const start = ROUTES_SOURCE.indexOf(registration)
      expect(start, `${registration} 必须仍注册在路由面上`).toBeGreaterThan(-1)
      expect(
        ROUTES_SOURCE.slice(start, start + 400),
        `${registration.split('(')[1]} 的守卫 ${guard} 缺位`,
      ).toContain(guard)
    }
  })
})

describe('A. GET /attendance/rule 权限面(edu:view / edu:manage 任一命中即放行)', () => {
  it('正向对照:持 edu:view ⇒ 200,出参等于生产投影出口 toAttendanceRuleDto 的序列化结果,全文不含密钥原文', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00', qrSecret: SECRET })
    H.permGrants.add(`${VIEWER}|edu:view`)
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: VIEWER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.code).toBe(0)
    expect(ruleFor(CLASS_A), '夹具本身要立得住').toBeDefined()
    expect(res.body.data).toEqual({ rule: dtoJson(CLASS_A) })
    const rule = (res.body.data as { rule: Record<string, unknown> }).rule
    expect(rule.qrSecretConfigured).toBe(true)
    expect(rule).not.toHaveProperty('qrSecret')
    expect(res.raw).not.toContain(SECRET)
  })

  it('正向对照(第二臂):持 edu:manage 者同样可读(与"任一命中即放行"同形)', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00' })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: TEACHER,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(200)
  })

  it('无 token ⇒ 401,且规则表一次都没查、零写、表未变(鉴权先于一切判据)', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00', qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(401)
    expect(H.reads, '匿名请求不得触达任何表').toBe(0)
    expectNoSideEffect(before)
    expect(res.raw).not.toContain(SECRET)
  })

  it('已登录但 edu:view/edu:manage 全无 ⇒ 403,且零读零写、表未变', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00', qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: PLAIN,
      query: { classId: CLASS_A },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body.code).toBe(403)
    expect(H.reads, '权限不成立时不得再去查别人的配置').toBe(0)
    expectNoSideEffect(before)
    expect(res.raw).not.toContain(SECRET)
  })

  it('身份不来自客户端可整写字段:query 里自报 userId/operatorId/admin/roleId 也换不来放行,且这些键进不了谓词', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '09:00', qrSecret: SECRET })
    const before = snapshotRules()
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: PLAIN,
      query: {
        classId: CLASS_A,
        userId: TEACHER,
        operatorId: TEACHER,
        admin: 'true',
        roleId: '1',
      },
    })
    expect(res.statusCode).toBe(403)
    expectNoSideEffect(before)
    const lits = H.wheres.flatMap((w) => (w === undefined ? [] : H.literalsOf(w)))
    expect(lits, '无权主体自报的身份键不得进任何谓词').not.toContain(TEACHER)
  })

  it('classId 形状闸:非法 uuid ⇒ 400 且零写;匿名 + 非法 uuid 仍是 401(鉴权先于形状闸)', async () => {
    H.permGrants.add(`${VIEWER}|edu:view`)
    const bad = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: VIEWER,
      query: { classId: 'not-a-uuid' },
    })
    expect(bad.statusCode).toBe(400)
    expect(bad.body.code).toBe(400)
    expectNoSideEffect('[]')

    const anonBad = await call({ method: 'GET', path: '/attendance/rule', query: { classId: 'x' } })
    expect(anonBad.statusCode, '鉴权必须在形状闸之前判定').toBe(401)
  })

  it('admin 臂:roleId>=1 经真实豁免链可读(判据走 require-permission 真身,非测试侧自认)', async () => {
    seedRule({ classId: CLASS_B })
    const res = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: ADMIN,
      claims: { roleId: 1 },
      query: { classId: CLASS_B },
    })
    expect(res.statusCode).toBe(200)
    expect(H.permGrants.size, '豁免臂不应依赖授予集').toBe(0)
  })
})

describe('B. PUT /attendance/rule 权限面(写面只认 edu:manage)', () => {
  it('正向对照:持 edu:manage ⇒ 200 且规则行真的落到库里,阈值 = normalizeHm 单源产物', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00', earlyBefore: '16:00', qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: { classId: CLASS_A, lateAfter: '9:00' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.writes).toEqual(['insert'])
    // 读回复验:库里这一行的 lateAfter 真被改成单源归一化的值,未给的 earlyBefore/qrSecret 原样保留
    expect(ruleFor(CLASS_A)?.lateAfter).toBe(normalizeHm('9:00'))
    expect(ruleFor(CLASS_A)?.earlyBefore).toBe('16:00')
    expect(ruleFor(CLASS_A)?.qrSecret).toBe(SECRET)
    expect((res.body.data as Record<string, unknown>).rule).toEqual(dtoJson(CLASS_A))
  })

  it('正向对照(建新档):该班原本无规则 ⇒ 200、库里只多出这一行', async () => {
    H.permGrants.add(`${TEACHER}|edu:manage`)
    expect(snapshotRules()).toBe('[]')
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: { classId: CLASS_B, absentAfter: '10:00', enabled: true },
    })
    expect(res.statusCode).toBe(200)
    expect(H.rules.length, 'upsert 只应新增一行').toBe(1)
    expect(ruleFor(CLASS_B)?.absentAfter).toBe('10:00')
    expect(H.writes).toEqual(['insert'])
  })

  it('无 token ⇒ 401:零写链、表逐字节未变;成对的正控确实会改库(证明"未变"不是"谁也改不动")', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00' })
    const before = snapshotRules()
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      body: { classId: CLASS_A, lateAfter: '09:00' },
    })
    expect(res.statusCode).toBe(401)
    expectNoSideEffect(before)
    expect(ruleFor(CLASS_A)?.lateAfter).toBe('08:00')

    H.permGrants.add(`${TEACHER}|edu:manage`)
    const ok = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: { classId: CLASS_A, lateAfter: '09:00' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ruleFor(CLASS_A)?.lateAfter).toBe('09:00')
  })

  it('已登录但只有 edu:view ⇒ 403(写面必须 edu:manage),零写、再经 GET 读回阈值未变', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00' })
    H.permGrants.add(`${VIEWER}|edu:view`)
    const before = snapshotRules()
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: VIEWER,
      body: { classId: CLASS_A, lateAfter: '09:00' },
    })
    expect(res.statusCode).toBe(403)
    expectNoSideEffect(before)
    const readBack = await call({
      method: 'GET',
      path: '/attendance/rule',
      as: VIEWER,
      query: { classId: CLASS_A },
    })
    expect(readBack.statusCode).toBe(200)
    expect((readBack.body.data as { rule: { lateAfter?: string } }).rule?.lateAfter).toBe('08:00')
  })

  it('已登录但无任何权限点 ⇒ 403,零写、库里阈值未变(登录本身不构成授权)', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00' })
    const before = snapshotRules()
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: PLAIN,
      body: { classId: CLASS_A, lateAfter: '09:00' },
    })
    expect(res.statusCode).toBe(403)
    expectNoSideEffect(before)
    expect(ruleFor(CLASS_A)?.lateAfter).toBe('08:00')
  })

  it('越权面:持有 edu:manage 也不能借 body 自报他人身份或自塞密钥 —— 这些键结构上进不了写载荷', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00', qrSecret: SECRET })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const before = snapshotRules()
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: {
        classId: CLASS_A,
        lateAfter: '09:00',
        userId: PLAIN,
        operatorId: PLAIN,
        createdBy: PLAIN,
        roleId: 1,
        qrSecret: 'attacker-chosen-secret',
      },
    })
    expect(res.statusCode).toBe(200)
    const payloads = [...H.insertValues, ...H.updateSets]
    expect(payloads.length, '写侧确实发生过(否则本条会在替空数组打气)').toBeGreaterThan(0)
    for (const payload of payloads) {
      expect(payload, '客户端自报的身份键一律进不了写载荷').not.toHaveProperty('userId')
      expect(payload).not.toHaveProperty('operatorId')
      expect(payload).not.toHaveProperty('createdBy')
      expect(payload).not.toHaveProperty('roleId')
      expect(
        payload,
        '写规则端点结构上写不进密钥:qrSecret 只有 rotate 一条通道',
      ).not.toHaveProperty('qrSecret')
    }
    // 库里那一行的密钥原文一行都没被动过
    expect(ruleFor(CLASS_A)?.qrSecret).toBe(SECRET)
    expect(ruleFor(CLASS_A)?.lateAfter).toBe('09:00')
    expect(snapshotRules()).not.toBe(before)
  })

  it('非法阈值 ⇒ 400 点名原值,且该行原有阈值逐字节未变(不静默回落,§0.3)', async () => {
    seedRule({ classId: CLASS_A, lateAfter: '08:00' })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const before = snapshotRules()
    const res = await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: { classId: CLASS_A, lateAfter: '上午4点' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toContain('上午4点')
    expectNoSideEffect(before)
    expect(ruleFor(CLASS_A)?.lateAfter).toBe('08:00')
  })

  it('鉴权先于形状闸:匿名 + 非法载荷 ⇒ 仍是 401,而不是用 400 承认这条路存在', async () => {
    const res = await call({ method: 'PUT', path: '/attendance/rule', body: { classId: 'x' } })
    expect(res.statusCode).toBe(401)
    expectNoSideEffect('[]')
  })

  it('写入的阈值确实被单源判定器消费(§22c:判据 import services 的 __test__ 出口,测试侧零复制)', async () => {
    seedRule({ classId: CLASS_A, lateAfter: null })
    H.permGrants.add(`${TEACHER}|edu:manage`)
    await call({
      method: 'PUT',
      path: '/attendance/rule',
      as: TEACHER,
      body: { classId: CLASS_A, lateAfter: '9:00' },
    })
    const stored = ruleFor(CLASS_A)?.lateAfter
    expect(stored).toBe(normalizeHm('9:00'))
    const late = ruleJudge.judgeStatusDetailed({
      lateAfter: stored as string,
      checkInTime: new Date(2026, 10, 6, 9, 31),
    })
    const onTime = ruleJudge.judgeStatusDetailed({
      lateAfter: stored as string,
      checkInTime: new Date(2026, 10, 6, 8, 59),
    })
    expect(late.status).toBe('late')
    expect(onTime.status).toBe('present')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
