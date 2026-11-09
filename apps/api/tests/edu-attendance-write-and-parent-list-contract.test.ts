// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤「写面死字段摘除」+「家长复数读端点枚举闸接线」契约锁(2026-11-04 立,**全程不连库**,
 * PG 8810 / Redis 8811 一条都不碰;AGENTS §5 测试隔离铁律)。
 *
 * 射程 = 上一票(1b2a7cda5a)逐条点名、刻意没碰的两格:
 *
 * ① 写面 `PUT /attendance/:id` 的 `updateAttendanceSchema.status`。
 *    取证(现读调用方,不是推断):全仓 `apps/web`(含 `apps/web/e2e/edu-attendance.spec.ts` 的桩)、
 *    `apps/miniapp-taro/src`、`apps/mobile-rn/src`、`packages/app|shared|api-client` 对这条 PUT 的
 *    调用数 = **0**(web 只有 `DELETE /attendance/${id}`;RN 的 `attendance/${kind}` 是 check-in /
 *    check-out 两条具名路由;小程序只有 check-in / check-out / batch-check-in)。
 *    ⇒ 这一枚 status 是**无主死面**,正解是从入参里去掉,而不是给它配一份枚举
 *    (2026-11 已定口径:`edu_attendance_record.status` 只能由服务端按该班规则现算,
 *     端上自报状态本身就是越权面;留着的后果是脏值长期落库并让前端五档取词/色档落到默认档)。
 *    本文件把"落库的 set 里结构上不可能出现 status"钉住,并留正对照(set 真的落了别的键)。
 *
 * ② 家长端复数读端点 `GET /parent/children/:childId/attendance` 此前**没有任何 query 闸**
 *    ⇒ 传任何 status 被静默忽略(客户端以为筛了、服务端按全量回),而同族单数端点已是
 *    「非法值 400 点名 + 合法值真筛」。取证:`apps/web/app/(main)/edu/parent/children/[childId]/attendance/PageClient.tsx`
 *    与小程序 `pkg-user/edu-child/attendance`、RN `EduChildAttendanceScreen` **都不发 status**
 *    ⇒ 缺的是筛选能力(接线归前端票),不是已发生的静默失效;但"静默忽略"这一格必须当场补上。
 *    修法 = 复用同文件既有那枚 `childAttendanceQuerySchema` 实例(§0.6:取值表全文件只有一份,
 *    禁止再抄第二份,也禁止新建共享常量文件)。
 *
 * 三把尺子:
 * 1. **行为面**(Fastify inject + 假库):非法值 ⇒ 400 且**副作用未发生**(读面零查询、写面零 set);
 *    越权面(未绑定该孩子的家长)⇒ 403 且归属外的表一次都不查,主体只从令牌取(客户端自报
 *    `?parentId=<别人>` 不得进入谓词);成对正向对照 = 合法值真的筛、合法键真的落。
 * 2. **结构面**(§22c:镜像 import 源件 `__test__` 出口,测试里零复制取值表):
 *    写面 schema 的键集不含 status;全文件的 status 取值表只声明一次;两条家长端点引用同一枚
 *    查询 schema;单复数两端对同一批取值的结论逐字一致。
 * 3. **取证面**(静态读源码,内容锚点不写行号):复数端点处理器切片内必须出现
 *    `childAttendanceQuerySchema.safeParse`(否则"接线"只是口头保证)。
 *
 * 夹具形态抄同族既有件 tests/edu-attendance-list-query.test.ts 与
 * tests/edu-attendance-parent-portal-authz.test.ts(config/db/logger/auth/rbac 桩基座),
 * 不自造第二套基座;假库解答器只是"假数据库行为",权限/归属判据全走真实链路。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它);每轮用例前清零。 */
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

  /** drizzle 条件对象 → 被绑定的字面值(测试侧假库解答器唯一实现,§0.6 单源)。 */
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
    /** RBAC 授予集:"<userId>|<permission>" 命中即 checkAnyPermission 返真(只答授予与否,不答判序) */
    permGrants: new Set<string>(),
    /** users.status 覆盖表(缺省 1=正常) */
    statusOverrides: new Map<string, number>(),
    /** 世界状态:confirmed 的家长-学生绑定 */
    bindings: [] as Array<{ parentId: string; childId: string }>,
    /** 世界状态:考勤行 */
    attendance: [] as Array<Record<string, unknown>>,
    /**
     * 合法状态档(由源件的枚举实例在 import 后灌入,测试侧不另写一份取值表)。
     * 空集 ⇒ 假库不做状态过滤,用例自身的"过滤生效"断言会翻红,不会静默假绿。
     */
    legalStatuses: [] as string[],
    /** db.select() 调用次数(= 是否真发起了查询) */
    reads: 0,
    /** 每次 where() 收到的谓词(归属/筛选判据的唯一可读面) */
    wheres: [] as unknown[],
    /** 每次 select() 的返回行集槽位 */
    results: [] as unknown[],
    /** 写侧调用记录(update/insert/delete/…)—— 400/401/403 用例必须断言它恒空 */
    writes: [] as string[],
    /** 每次 .set() 收到的载荷:写面"库里到底落了什么"的唯一可读面 */
    sets: [] as Record<string, unknown>[],
  }
})

/** 桩 config:避免 env 校验在测试进程里 process.exit(1);DATABASE_URL 只是占位字面量,不建任何真连接。 */
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
 * 假数据库:select 的返回行集 = 该次 where 谓词里的字面值与世界状态求交(见 answerWith);
 * 写侧记账 kind 与 set 载荷后返回空形状。本文件不建任何真连接(AGENTS §5 测试隔离铁律)。
 */
vi.mock('../src/db/index.js', () => {
  const CHAIN_METHODS = [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
    'rightJoin',
    'crossJoin',
    'groupBy',
    'having',
    'forUpdate',
  ] as const
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  /** 谓词解答器:假库会命中哪些行(纯假库行为,不是生产判据副本)。 */
  function answerWith(predicate: unknown): Array<Record<string, unknown>> {
    const lits = H.literalsOf(predicate)
    const out: Array<Record<string, unknown>> = []
    // 绑定查询指纹:谓词里带 'confirmed' ⇒ 家长与学生两个 uuid 都命中才回行
    if (lits.includes('confirmed')) {
      for (const b of H.bindings) {
        if (lits.includes(b.parentId) && lits.includes(b.childId)) {
          out.push({ ...b, id: `binding-${b.parentId}-${b.childId}` })
        }
      }
      return out
    }
    // 考勤查询:谓词里出现的 uuid 必须是这行的 id/studentId,状态筛选值(若有)必须与这行一致
    const uuidLits = lits.filter((v: string) => UUID_RE.test(v))
    const statusLit = H.legalStatuses.find((s: string) => lits.includes(s))
    for (const row of H.attendance) {
      const rowStatus = String(row.status ?? '')
      if (statusLit && rowStatus !== statusLit) continue
      if (uuidLits.length > 0) {
        const mine = uuidLits.includes(String(row.id)) || uuidLits.includes(String(row.studentId))
        // 非考勤行的 uuid(例如绑定行的 id)不进本表答案
        if (!mine) continue
      }
      out.push(row)
    }
    return out
  }

  /** 读链:select(fields) → from/where/…;count 形态按 fields 区分(与 paginate 的两条查询对齐)。 */
  const readChain = (fields?: Record<string, unknown>) => {
    const slot = H.reads
    H.reads += 1
    H.wheres[slot] = undefined
    H.results[slot] = []
    const isCount = Boolean(fields && 'count' in fields)
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          const rows = answerWith(arg)
          H.results[slot] = isCount ? [{ count: rows.length }] : rows
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.results[slot] ?? []).then(resolve, reject)
    return step
  }

  const writeChain = (kind: string) => {
    H.writes.push(kind)
    const step: Record<string, unknown> = {}
    step.values = vi.fn((arg?: unknown) => {
      H.sets.push((arg ?? {}) as Record<string, unknown>)
      return step
    })
    step.set = vi.fn((arg?: unknown) => {
      H.sets.push((arg ?? {}) as Record<string, unknown>)
      return step
    })
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
    step.onConflictDoNothing = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const txApi = {
    select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)),
    insert: vi.fn(() => writeChain('insert')),
    update: vi.fn(() => writeChain('update')),
    delete: vi.fn(() => writeChain('delete')),
  }

  return {
    db: {
      select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)),
      insert: vi.fn(() => writeChain('insert')),
      update: vi.fn(() => writeChain('update')),
      delete: vi.fn(() => writeChain('delete')),
      execute: vi.fn(() => {
        H.writes.push('execute')
        return Promise.resolve([])
      }),
      transaction: vi.fn(async (cb: (tx: typeof txApi) => unknown) => {
        H.writes.push('transaction')
        return cb(txApi)
      }),
    },
    dbRead: { select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)) },
    dbClient: {},
    dbWriter: { select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)) },
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

/** RBAC 查询桩:只答"授予集里有没有这一条",判序/401/403 语义全走真实 requireAnyPermission。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

/** 承载层验签桩(与同族件逐字同形):只替"验签"这一步,身份仍走真实 authenticate。 */
vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    verifyAccessToken: vi.fn(async (token: string) => {
      const reject = (): never => {
        throw Object.assign(new Error('JWS signature verification failed'), {
          code: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
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

import eduAiManagementRoutes, { __test__ as routeTest } from '../src/routes/edu-ai-management.js'

const PREFIX = '/api/edu-ai-management'
const ROUTE_FILE = fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url))
const ROUTES_SOURCE = readFileSync(ROUTE_FILE, 'utf8')

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // edu:manage
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 无任何权限点
const PARENT_A = '33333333-3333-4333-8333-333333333333'
const PARENT_B = '22222222-2222-4222-8222-222222222222'
const CHILD_X = '44444444-4444-4444-8444-444444444444'
const CHILD_NOT_BOUND = '77777777-7777-4777-8777-777777777777'
const ATT_ID = '99999999-9999-4999-8999-999999999991'
const ATT_ID_ABSENT = '99999999-9999-4999-8999-999999999992'
const CLASS_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

// =============================================================================
// 源件判据(§22c:测试里零复制 —— 取值表/入参形状都只问源件自己)
// =============================================================================

/** 从 zod 枚举实例读合法档(zod v4 的 def.entries 是 value→value 映射);读不到 ⇒ 顶红不静默放行。 */
function entriesOf(schema: unknown): string[] {
  const entries = (schema as { def?: { entries?: unknown } } | undefined)?.def?.entries
  if (!entries || typeof entries !== 'object') {
    throw new Error('未判定:考勤 status 枚举闸的取值面读不到(def.entries)')
  }
  const keys = Object.keys(entries as Record<string, unknown>)
  if (keys.length === 0) throw new Error('未判定:考勤 status 枚举档枚举到 0 个(§0.3 不冒绿)')
  return keys
}

type Parseable = {
  safeParse: (i: unknown) => { success: boolean; data?: Record<string, unknown> }
}
const filterEnum = (routeTest as Record<string, unknown>).attendanceStatusFilter
const listSchema = (routeTest as Record<string, unknown>).attendanceListQuerySchema as Parseable
const childSchema = (routeTest as Record<string, unknown>).childAttendanceQuerySchema as Parseable
const updateSchema = (routeTest as Record<string, unknown>).updateAttendanceSchema as Parseable
const LEGAL = entriesOf(filterEnum)
/** 灌给假库解答器:测试侧仍零复制(唯一来源是源件的枚举实例)。 */
H.legalStatuses = LEGAL

/** 非法值样本:含本票要治的字面量与形状相近的绕过面。 */
const ILLEGAL = ['all', 'ALL', ' present', 'present ', 'presence', 'PRESET', '今日', 'x'.repeat(21)]

// =============================================================================
// 行为面夹具
// =============================================================================

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
      const statusCode =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await app.register(eduAiManagementRoutes, { prefix: PREFIX })
    await app.ready()
    appPromise = Promise.resolve(app)
  }
  return appPromise
}

interface Call {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE'
  path: string
  as?: string
  query?: Record<string, string>
  body?: Record<string, unknown>
}

async function call(
  o: Call,
): Promise<{ statusCode: number; body: Record<string, unknown>; raw: string }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
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
    body = { raw: res.body }
  }
  return { statusCode: res.statusCode, body, raw: res.body }
}

const attRow = (
  id: string,
  studentId: string,
  status: string,
  date = '2026-01-05',
): Record<string, unknown> => ({
  id,
  studentId,
  classId: CLASS_1,
  date,
  status,
  checkInMethod: 'manual',
  remark: null,
  deletedAt: null,
})

/** 世界状态:同一学生两档状态各一行(正向对照要能区分"筛选生效"与"恒空")。 */
function scriptAttendance(): void {
  H.attendance.push(attRow(ATT_ID, CHILD_X, 'present'))
  H.attendance.push(attRow(ATT_ID_ABSENT, CHILD_X, 'absent'))
}

function resetWorld(): void {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.bindings.length = 0
  H.attendance.length = 0
  H.reads = 0
  H.wheres.length = 0
  H.results.length = 0
  H.writes.length = 0
  H.sets.length = 0
}

beforeEach(() => {
  resetWorld()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

/** 处理器切片:自某条路由注册起,到下一条路由注册为止(内容锚点法,不写行号)。 */
function handlerSlice(registration: string): string {
  const start = ROUTES_SOURCE.indexOf(registration)
  if (start < 0) return ''
  const next = ROUTES_SOURCE.indexOf('\n  server.', start + registration.length)
  return ROUTES_SOURCE.slice(start, next < 0 ? start + 4000 : next)
}

// =============================================================================
// 1. 写面 PUT /attendance/:id:status 已从入参摘除 ⇒ 结构上落不进库
// =============================================================================

describe('PUT /attendance/:id 的写面收口(status 死字段已摘)', () => {
  it('入参形状里没有 status 这一枚键(源件 __test__ 出口现读,测试侧零复制)', () => {
    const parsed = updateSchema.safeParse({ status: 'present', remark: '人工订正' })
    expect(parsed.success).toBe(true)
    expect(Object.keys(parsed.data ?? {})).toContain('remark')
    // zod 默认 strip 未知键 ⇒ status 进不了 parsed.data,因此也进不了 .set()
    expect(parsed.data ?? {}).not.toHaveProperty('status')
  })

  it('源码形状锁:updateAttendanceSchema 定义体内不再出现 status 键', () => {
    const body = /const updateAttendanceSchema = z\.object\(\{([\s\S]*?)\n\}\)/.exec(ROUTES_SOURCE)
    expect(body, 'updateAttendanceSchema 必须仍存在(路由没被摘)').not.toBeNull()
    expect(body![1]).not.toMatch(/(^|\n)\s*status:/)
  })

  it('老客户端继续传 status ⇒ 不 400(不断既有集成),但落库载荷里没有 status', async () => {
    scriptAttendance()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const before = String(H.attendance.find((r) => r.id === ATT_ID)?.status ?? '')
    const res = await call({
      method: 'PUT',
      path: `/attendance/${ATT_ID}`,
      as: TEACHER,
      body: { status: 'all' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.code).toBe(0)
    // 写确实发生了(有 update 链、有 set 载荷),但载荷里结构上没有 status ⇒ 脏值进不了库
    expect(H.writes).toEqual(['update'])
    expect(H.sets.length).toBe(1)
    expect(H.sets[0]).not.toHaveProperty('status')
    // 库里的原值一行都没被动过(假库不会因 set 改世界状态,这里判的是"没把 status 交出去")
    expect(String(H.attendance.find((r) => r.id === ATT_ID)?.status ?? '')).toBe(before)
  })

  it('任意自报值逐条同样落不进库(枚举外/中文/超长串一视同仁)', async () => {
    H.permGrants.add(`${TEACHER}|edu:manage`)
    for (const bad of [...ILLEGAL, 'present', 'leave']) {
      resetWorld()
      scriptAttendance()
      H.permGrants.add(`${TEACHER}|edu:manage`)
      const res = await call({
        method: 'PUT',
        path: `/attendance/${ATT_ID}`,
        as: TEACHER,
        body: { status: bad, remark: 'x' },
      })
      expect(res.statusCode, `status=${JSON.stringify(bad)} 不应打断老客户端`).toBe(200)
      for (const set of H.sets) {
        expect(set, `status=${JSON.stringify(bad)} 不许进 .set()`).not.toHaveProperty('status')
      }
    }
  })

  it('正对照:合法键真的落(证明上一条的"没有 status"不是因为什么都不落)', async () => {
    scriptAttendance()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'PUT',
      path: `/attendance/${ATT_ID}`,
      as: TEACHER,
      body: { remark: '订正备注', checkInMethod: 'manual' },
    })
    expect(res.statusCode).toBe(200)
    expect(H.writes).toEqual(['update'])
    expect(H.sets.length).toBe(1)
    expect(H.sets[0].remark).toBe('订正备注')
    expect(H.sets[0].checkInMethod).toBe('manual')
    expect(H.sets[0].updatedAt).toBeInstanceOf(Date)
  })

  it('鉴权先于一切:无 token ⇒ 401、无 edu:manage ⇒ 403,两者零写链调用、零 set', async () => {
    scriptAttendance()
    const anon = await call({
      method: 'PUT',
      path: `/attendance/${ATT_ID}`,
      body: { status: 'present' },
    })
    expect(anon.statusCode).toBe(401)
    expect(H.writes).toEqual([])
    expect(H.sets).toEqual([])

    resetWorld()
    scriptAttendance()
    const denied = await call({
      method: 'PUT',
      path: `/attendance/${ATT_ID}`,
      as: PLAIN,
      body: { status: 'present' },
    })
    expect(denied.statusCode).toBe(403)
    expect(H.writes).toEqual([])
    expect(H.sets).toEqual([])
  })

  it('记录不存在 ⇒ 404 且零写(不凭空造行)', async () => {
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'PUT',
      path: `/attendance/${CHILD_NOT_BOUND}`,
      as: TEACHER,
      body: { remark: 'x' },
    })
    expect(res.statusCode).toBe(404)
    expect(H.writes).toEqual([])
    expect(H.sets).toEqual([])
  })

  it('主体由承载层取:客户端自报 studentId/classId 不改变归属判定(记录定位只认路径 id)', async () => {
    scriptAttendance()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'PUT',
      path: `/attendance/${ATT_ID}`,
      as: TEACHER,
      body: { studentId: CHILD_NOT_BOUND, classId: CLASS_1, remark: '只改备注' },
    })
    expect(res.statusCode).toBe(200)
    // 自报的身份键被 strip:既不进 set,也不改变"改的是哪一行"(定位仍来自路径)
    for (const set of H.sets) {
      expect(set).not.toHaveProperty('studentId')
      expect(set).not.toHaveProperty('classId')
    }
    expect(H.wheres.filter((w) => w !== undefined).flatMap((w) => H.literalsOf(w))).toContain(
      ATT_ID,
    )
  })
})

// =============================================================================
// 2. 家长复数读端点:补上枚举闸(不再静默忽略),且与单数端点同一张脸
// =============================================================================

describe('GET /parent/children/:childId/attendance 的 status 枚举闸(与单数端点同形)', () => {
  const P = `/parent/children/${CHILD_X}/attendance`

  it('接线锁(取证面):处理器切片里真的调了那枚共用 schema', () => {
    const slice = handlerSlice(`server.get('/parent/children/:childId/attendance'`)
    expect(slice, '复数家长端点必须存在').not.toBe('')
    expect(slice).toContain('childAttendanceQuerySchema.safeParse')
    expect(slice).toContain('checkAuthOrInternalService')
    // 状态筛选必须真的进谓词(否则"接了闸却不落地"= 又一格静默忽略)
    expect(slice).toContain('eq(eduAttendanceRecord.status, parsed.data.status)')
  })

  it('status=all ⇒ 400,message 逐字点名每一个合法值;零查询(绑定表都没查)、零写', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await call({ method: 'GET', path: P, as: PARENT_A, query: { status: 'all' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe(400)
    const message = String(res.body.message ?? '')
    for (const one of LEGAL) expect(message).toContain(one)
    expect(res.body.data).toBeUndefined()
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('其余非枚举值逐条同样 400 且零查询(含前后带空格与超长串)', async () => {
    for (const bad of ILLEGAL) {
      resetWorld()
      H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
      scriptAttendance()
      const res = await call({ method: 'GET', path: P, as: PARENT_A, query: { status: bad } })
      expect(res.statusCode, `status=${JSON.stringify(bad)} 必须被拒`).toBe(400)
      expect(H.reads, `status=${JSON.stringify(bad)} 不许发起查询`).toBe(0)
      expect(H.writes).toEqual([])
    }
  })

  it('正对照:合法档 ⇒ 200 且筛选真的生效(只回该档那一行,不是恒空也不是全量)', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await call({ method: 'GET', path: P, as: PARENT_A, query: { status: 'present' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.code).toBe(0)
    const list =
      (res.body.data as { list?: Array<Record<string, unknown>> } | undefined)?.list ?? []
    expect(list.length).toBe(1)
    expect(String(list[0].status)).toBe('present')
    expect(H.reads).toBeGreaterThan(0)
  })

  it('「全部」档(不传 / 传空串)⇒ 200 且谓词里不含任何状态码:钉住"全部=不加条件"', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    for (const query of [undefined, { status: '' }]) {
      resetWorld()
      H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
      scriptAttendance()
      const res = await call({ method: 'GET', path: P, as: PARENT_A, query })
      expect(res.statusCode, `query=${JSON.stringify(query)} 应视作不筛选`).toBe(200)
      const list = (res.body.data as { list?: unknown[] } | undefined)?.list ?? []
      expect(list.length, '不加条件时两档都回得来(证明"没条件"≠"查不到")').toBe(2)
      for (const w of H.wheres.filter((x) => x !== undefined)) {
        const lits = H.literalsOf(w)
        if (lits.includes('confirmed')) continue // 归属查询那一趟不算
        for (const status of LEGAL)
          expect(lits, `谓词里不该出现状态码 ${status}`).not.toContain(status)
      }
    }
  })

  it('startDate/endDate 不再被静默忽略:合法日期串真的进谓词', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await call({
      method: 'GET',
      path: P,
      as: PARENT_A,
      query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    })
    expect(res.statusCode).toBe(200)
    const lits = H.wheres.filter((w) => w !== undefined).flatMap((w) => H.literalsOf(w))
    expect(lits).toContain('2026-01-01')
    expect(lits).toContain('2026-01-31')
  })

  it('越权面:未绑定该孩子的家长带合法 status ⇒ 403 且不泄露一行,考勤表一次都不查', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await call({
      method: 'GET',
      path: `/parent/children/${CHILD_NOT_BOUND}/attendance`,
      as: '99999999-9999-4999-8999-999999999999',
      query: { status: 'present' },
    })
    expect(res.statusCode).toBe(403)
    const list = (res.body.data as { list?: unknown[] } | undefined)?.list
    expect(list === undefined || list.length === 0).toBe(true)
    expect(H.reads, '归属不成立时不得再查考勤表').toBe(1)
    expect(H.writes).toEqual([])
  })

  it('非法 status + 未绑定家长 ⇒ 400 在归属查询之前(次序钉住),零查询零写', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await call({
      method: 'GET',
      path: `/parent/children/${CHILD_NOT_BOUND}/attendance`,
      as: '99999999-9999-4999-8999-999999999999',
      query: { status: 'all' },
    })
    expect(res.statusCode).toBe(400)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('主体只从令牌取:客户端自报 ?parentId=<别人> 不得进入归属谓词', async () => {
    // 世界状态:绑定属于 PARENT_B,登录的是 PARENT_A ⇒ 即便自称 parentId=PARENT_B 也不能通过
    H.bindings.push({ parentId: PARENT_B, childId: CHILD_X })
    scriptAttendance()
    const res = await call({
      method: 'GET',
      path: P,
      as: PARENT_A,
      query: { parentId: PARENT_B, userId: PARENT_B, status: 'present' },
    })
    expect(res.statusCode).toBe(403)
    const bindingProbe = H.wheres
      .filter((w) => w !== undefined)
      .map((w) => H.literalsOf(w))
      .find((l) => l.includes('confirmed'))
    expect(bindingProbe, '必须真的带 status=confirmed 归属判据').toBeDefined()
    expect(bindingProbe).toContain(PARENT_A)
    expect(bindingProbe, '客户端自报的家长身份不得进谓词').not.toContain(PARENT_B)
    expect(H.writes).toEqual([])
  })

  it('鉴权先于形状闸:无 token ⇒ 401 零查询;匿名带非法 status 也不给 400 的机会', async () => {
    scriptAttendance()
    const anon = await call({ method: 'GET', path: P, query: { status: 'all' } })
    expect(anon.statusCode).toBe(401)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })
})

// =============================================================================
// 3. 同源锁:三处读端点/两条家长端点必须一张脸;全文件只许一枚取值表
// =============================================================================

describe('status 取值表的同源锁(§0.6 + §22c:判据只有一份)', () => {
  it('全文件的 status 取值表只声明一次(第二份必然漂移)', () => {
    const tables = ROUTES_SOURCE.match(/z\.enum\(\s*\['present'/g) ?? []
    expect(tables.length, `考勤 status 取值表声明数应为 1,现读 ${tables.length} 处`).toBe(1)
  })

  it('两条家长端点引用的是同一枚 schema 实例(源码切片法)', () => {
    const singular = handlerSlice(`server.get('/parent/child/:id/attendance'`)
    const plural = handlerSlice(`server.get('/parent/children/:childId/attendance'`)
    expect(singular).toContain('childAttendanceQuerySchema.safeParse')
    expect(plural).toContain('childAttendanceQuerySchema.safeParse')
    // 复数端点不得自立第二份取值面(它自己的切片里不该再出现 z.enum / 状态码字面量清单)
    expect(plural).not.toMatch(/z\.enum\(/)
    expect(plural).not.toMatch(/'present',\s*'late'/)
  })

  it('教师端读面 / 家长单数 / 家长复数:同一批取值三处结论逐字一致(一张脸三只眼不行)', () => {
    for (const one of [...LEGAL, ...ILLEGAL, '']) {
      const l = listSchema.safeParse({ status: one }).success
      const c = childSchema.safeParse({ status: one }).success
      expect(c, `单数家长端对 ${JSON.stringify(one)} 的结论必须与教师端一致`).toBe(l)
    }
  })

  it('写面不再有 status 入参 ⇒ 路由里对 edu_attendance_record.status 的写入只剩服务端现算', () => {
    // 现读:PUT /attendance/:id 的处理器切片里不得再出现任何"把请求体 status 交给 set"的通路
    const slice = handlerSlice(`server.put('/attendance/:id'`)
    expect(slice, 'PUT /attendance/:id 必须仍存在').not.toBe('')
    expect(slice).not.toMatch(/updates\.status\s*=/)
    expect(slice).not.toMatch(/status:\s*parsed\.data\.status/)
    // 合法写 status 的两条路径(签退重判 / 请假审批)必须还在,否则是"能力被摘"而不是"死字段被摘"
    expect(ROUTES_SOURCE).toMatch(/judgeStatus/)
  })

  it('同一非法请求连打两次,结论逐字相同(不靠运气绿)', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const first = await call({
      method: 'GET',
      path: `/parent/children/${CHILD_X}/attendance`,
      as: PARENT_A,
      query: { status: 'all' },
    })
    const second = await call({
      method: 'GET',
      path: `/parent/children/${CHILD_X}/attendance`,
      as: PARENT_A,
      query: { status: 'all' },
    })
    expect(second.statusCode).toBe(first.statusCode)
    expect(JSON.stringify(second.body)).toBe(JSON.stringify(first.body))
    expect(H.writes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
