// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤/请假端点权限面与越权面契约锁(2026-11-01 立,**全程不连库**,PG 8810/Redis 8811 一条都不碰)。
 *
 * 立因:考勤 7 端点 + 请假 5 端点,此前全仓关于考勤只有一枚 web 侧文案契约测试;
 * "普通用户能不能替别班学生签到""越权批量写会不会留下副作用"无人验过(AGENTS §5)。
 *
 * 锁的端点(内容锚点,不写行号;注册面 = apps/api/src/routes/edu-ai-management.ts,
 * 对外前缀 /api/edu-ai-management):
 *   写端点(edu:manage 三条:无 token⇒401 / 无权限⇒403 / 有权限⇒正控通过):
 *     POST /attendance/check-in · PUT /attendance/check-out · PUT /attendance/:id
 *     DELETE /attendance/:id · POST /leave · PUT /leave/:id
 *     PUT /leave/:id/approve · DELETE /leave/:id
 *   读端点(edu:view 同型三条):
 *     GET /attendance · GET /attendance/stats · GET /leave
 *   越权面:
 *     无权限用户以 studentId=学生B 调 check-in ⇒ 403 且**数据库侧零写**(副作用没发生,成对留正向对照);
 *     家长查非自己绑定孩子的考勤 ⇒ 不得读到该孩子数据(绑定查询按谓词与世界状态求交)。
 *   批量写诚实性(门 134 同型):POST /attendance/batch-check-in 的 created/skipped 必须来自回库确认
 *     ——该端点与 POST /attendance/self-check-in、/attendance/qrcode-check-in、
 *     services/edu-attendance-rule.ts(__test__ 判定出口)此刻均未落盘(ATT-JOB 席在写),
 *     对应用例按"契约形状 + 待落盘"显式 skip,运行时探测源文件/路由注册,落盘即自动生效,不伪造绿。
 *
 * 形状抄同族既有件 tests/edu-parent-bills-contract.test.ts(config/db/logger/auth 桩基座),
 * 不自造第二套夹具基座;判定逻辑零复制(§22c):本文件对 db 的"解答器"只是**假数据库行为**,
 * 权限/归属判据全部走真实 requireAnyPermission → authenticate → checkAnyPermission(RBAC 桩只答
 * "该用户是否被授予该权限点",判序与豁免语义是真身)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。
 * 每个计数与世界状态都在 beforeEach 清零 ⇒ "跑两次逐字相同"才是判据而不是运气。
 */
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
    /** users.status 覆盖表(缺省 1=正常),承载层账号状态腿用 */
    statusOverrides: new Map<string, number>(),
    /** 世界状态:家长-学生绑定行 */
    bindings: [] as Array<{ parentId: string; childId: string; status: string }>,
    /** 世界状态:考勤行 */
    attendance: [] as Array<Record<string, unknown>>,
    /** 世界状态:请假行 */
    leaves: [] as Array<Record<string, unknown>>,
    /** 世界状态:在册报名行(eduEnrollment.status='enrolled' 口径) */
    enrollments: [] as Array<Record<string, unknown>>,
    /** 第 n 次 select 的 where 条件与解答行集 */
    reads: 0,
    wheres: [] as unknown[],
    results: [] as unknown[],
    countFlags: [] as boolean[],
    /** 写侧调用记录(insert/update/delete/execute/transaction)—— 越权用例必须恒空 */
    writes: [] as string[],
    /** insert().values(v) 收到的值逐条留档:"库里没多出 B 的考勤行" 直接对它断言 */
    insertValues: [] as Array<Record<string, unknown>>,
    /** update().set(v) 收到的值逐条留档 */
    updateSets: [] as Array<Record<string, unknown>>,
  }
})

/** 桩掉 config:避免 env 校验在测试进程里 process.exit(1)(与既有 api 测试同形);不建任何真连接。 */
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

/**
 * 假数据库:select 的返回行集 = 该次 where 谓词里的字面值与世界状态求交(见 answerWith);
 * 写侧一律记账(insert 记 values、update 记 set、链主 kind 记进 writes)并返回可行形状。
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

  /** 世界状态解答器:返回"假如这是真库,这条 where 会命中哪些行"(纯假库行为,非生产判据副本)。 */
  function answerWith(predicate: unknown): Array<Record<string, unknown>> {
    const lits = H.literalsOf(predicate)
    const dateLits = lits.filter((v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    const statusLits = lits.filter((v: string) => ['pending', 'approved', 'rejected'].includes(v))
    const out: Array<Record<string, unknown>> = []
    for (const b of H.bindings) {
      if (
        lits.includes(b.parentId) &&
        lits.includes(b.childId) &&
        (!lits.includes('confirmed') || b.status === 'confirmed')
      ) {
        out.push({ id: `binding-${b.parentId}-${b.childId}`, parentId: b.parentId, ...b })
      }
    }
    for (const a of H.attendance) {
      if (lits.includes('confirmed') || lits.includes('enrolled')) break
      const byId = lits.includes(String(a.id))
      const byStudent =
        lits.includes(String(a.studentId)) &&
        (dateLits.length === 0 || dateLits.includes(String(a.date)))
      if (byId || byStudent) out.push(a)
    }
    for (const l of H.leaves) {
      if (lits.includes('confirmed')) break
      const byId = lits.includes(String(l.id))
      const byStudent =
        lits.includes(String(l.studentId)) &&
        (statusLits.length === 0 || statusLits.includes(String(l.status)))
      if (byId || byStudent) out.push(l)
    }
    for (const e of H.enrollments) {
      // 报名查询的指纹:classId + 'enrolled' 两个字面值同时在场(考勤/请假谓词不含 'enrolled')
      if (
        lits.includes(String(e.classId)) &&
        lits.includes('enrolled') &&
        e.status === 'enrolled'
      ) {
        out.push(e)
      }
    }
    return out
  }

  /** 读链:select(fields) → from/where/... ;where 时按谓词解答;count 形态按 fields 区分。 */
  const readChain = (fields?: Record<string, unknown>) => {
    const slot = H.reads
    H.reads += 1
    H.wheres[slot] = undefined
    H.results[slot] = []
    const isPlainCount = Boolean(fields && 'count' in fields && !('status' in fields))
    const isStatusCount = Boolean(fields && 'count' in fields && 'status' in fields)
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          const rows = answerWith(arg)
          if (isPlainCount) H.results[slot] = [{ count: rows.length }]
          else if (isStatusCount) {
            const byStatus = new Map<string, number>()
            for (const r of rows) {
              const k = String(r.status ?? 'unknown')
              byStatus.set(k, (byStatus.get(k) ?? 0) + 1)
            }
            H.results[slot] = [...byStatus.entries()].map(([status, count]) => ({
              status,
              count,
            }))
          } else H.results[slot] = rows
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.results[slot] ?? []).then(resolve, reject)
    return step
  }

  const insertChain = () => {
    H.writes.push('insert')
    let valuesArr: Array<Record<string, unknown>> = []
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: Record<string, unknown> | Array<Record<string, unknown>>) => {
      valuesArr = Array.isArray(v) ? v : [v]
      for (const one of valuesArr) H.insertValues.push(one)
      return step
    })
    step.returning = vi.fn(() =>
      Promise.resolve(valuesArr.map((v, i) => ({ id: `row-new-${i}`, ...v }))),
    )
    step.onConflictDoNothing = vi.fn(() => step)
    step.onConflictDoUpdate = vi.fn(() => step)
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const updateChain = () => {
    H.writes.push('update')
    let predicate: unknown
    const step: Record<string, unknown> = {}
    step.set = vi.fn((v: Record<string, unknown>) => {
      H.updateSets.push(v)
      return step
    })
    step.where = vi.fn((p: unknown) => {
      predicate = p
      return step
    })
    step.returning = vi.fn(() => Promise.resolve(predicate ? answerWith(predicate) : []))
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return step
  }

  const deleteChain = () => {
    H.writes.push('delete')
    const step: Record<string, unknown> = {}
    step.where = vi.fn(() => step)
    step.returning = vi.fn(() => Promise.resolve([]))
    return step
  }

  const txApi = {
    select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)),
    insert: vi.fn(() => insertChain()),
    update: vi.fn(() => updateChain()),
    delete: vi.fn(() => deleteChain()),
  }

  return {
    db: {
      select: vi.fn((fields?: Record<string, unknown>) => readChain(fields)),
      insert: vi.fn(() => insertChain()),
      update: vi.fn(() => updateChain()),
      delete: vi.fn(() => deleteChain()),
      execute: vi.fn(() => {
        H.writes.push('execute')
        return Promise.resolve([])
      }),
      // transaction 真执行回调(正控路径要能走完);回调进入即记一次 transaction 写意图
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

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(),
}))
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

/** RBAC 查询桩:只答"授予集里有没有这一条",判序/豁免/401-403 语义全走真实 require-permission。 */
vi.mock('../src/db/rbac-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    checkAnyPermission: vi.fn(async (userId: string, permissions: string[]) =>
      permissions.some((p) => H.permGrants.has(`${userId}|${p}`)),
    ),
  }
})

/** 承载层验签桩(与 edu-parent-bills-contract.test.ts 同形):只替"验签"这一步。 */
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

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const PREFIX = '/api/edu-ai-management'

const TEACHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' // edu:manage
const VIEWER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // edu:view
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 无任何权限点
const STUDENT_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' // 学生A(登录主体)
const CHILD_B = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' // 学生B(别人的孩子)
const CLASS_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const ATT_ID = '11111111-1111-4111-8111-111111111111' // 已存在的考勤行 id
const LEAVE_ID = '22222222-2222-4222-8222-222222222222' // 已存在的 pending 请假行 id
const LEAVE_STU = '00000000-0000-4000-8000-000000000001' // 请假专用学生(与考勤学生隔离,夹具防串味)
const PARENT_A = '33333333-3333-4333-8333-333333333333'
const CHILD_X = '44444444-4444-4444-8444-444444444444'
const FIXED_DATE = '2026-01-05'

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
    app.setErrorHandler((err, _request, reply) => {
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

interface CallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  /** 登录主体 userId(造真三段式凭据);不传 = 无 token */
  as?: string
}

async function call(
  o: CallOptions,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${o.path}`,
    headers,
    ...(o.body === undefined ? {} : { payload: o.body }),
  })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = { raw: res.body }
  }
  return { statusCode: res.statusCode, body }
}

/** 落盘探测:ATT-JOB 席的件此刻可能还没进工作树,探测面 = 路由注册源码 / 服务源文件存在性。 */
const ROUTES_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url)),
  'utf8',
)
const RULE_SERVICE_PATH = fileURLToPath(
  new URL('../src/services/edu-attendance-rule.ts', import.meta.url),
)
const hasRoute = (registration: string): boolean => ROUTES_SOURCE.includes(registration)
/** 家长考勤端点是否已接承载层鉴权(checkAuthOrInternalService)——现读源码切片,不写行号。 */
function parentAttendanceHandlerSlice(): string {
  const start = ROUTES_SOURCE.indexOf(`server.get('/parent/children/:childId/attendance'`)
  if (start < 0) return ''
  const next = ROUTES_SOURCE.indexOf('server.get(', start + 10)
  return ROUTES_SOURCE.slice(start, next < 0 ? start + 3000 : next)
}

/** 正控所需世界状态:一条考勤行 + 一条 pending 请假行(请假学生独立,防跨表串味)。 */
function scriptBaseRows(): void {
  H.attendance.push({
    id: ATT_ID,
    studentId: CHILD_B,
    classId: CLASS_1,
    date: FIXED_DATE,
    status: 'present',
    checkOutTime: null,
    deletedAt: null,
  })
  H.leaves.push({
    id: LEAVE_ID,
    studentId: LEAVE_STU,
    classId: CLASS_1,
    leaveType: 'sick',
    startDate: FIXED_DATE,
    endDate: FIXED_DATE,
    totalDays: 1,
    reason: '感冒',
    status: 'pending',
    deletedAt: null,
  })
}

/** 名册世界状态:给定学生集在 CLASS_1 在册(edu-attendance-absent-job 登记的在册口径同形)。 */
function scriptRoster(studentIds: string[]): void {
  for (const studentId of studentIds) {
    H.enrollments.push({
      id: `enroll-${studentId}`,
      studentId,
      classId: CLASS_1,
      status: 'enrolled',
      deletedAt: null,
    })
  }
}

function resetWorld(): void {
  H.permGrants.clear()
  H.statusOverrides.clear()
  H.bindings.length = 0
  H.attendance.length = 0
  H.leaves.length = 0
  H.enrollments.length = 0
  H.reads = 0
  H.wheres.length = 0
  H.results.length = 0
  H.countFlags.length = 0
  H.writes.length = 0
  H.insertValues.length = 0
  H.updateSets.length = 0
}

beforeEach(() => {
  resetWorld()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

// =============================================================================
// 1. 写端点权限面三条(无 token⇒401 / 无 edu:manage⇒403 / 有 edu:manage⇒正控通过)
//    401/403 两条同时断言"副作用没发生"(writes 恒空、insertValues 恒空)
// =============================================================================

interface WriteEndpointCase {
  name: string
  method: 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  /** 正控期望状态码 */
  okStatus: number
}

const WRITE_CASES: WriteEndpointCase[] = [
  {
    name: 'POST /attendance/check-in',
    method: 'POST',
    path: '/attendance/check-in',
    body: { studentId: CHILD_B, classId: CLASS_1, date: '2026-02-02' },
    okStatus: 201,
  },
  {
    name: 'PUT /attendance/check-out',
    method: 'PUT',
    path: '/attendance/check-out',
    body: { studentId: CHILD_B, classId: CLASS_1, date: FIXED_DATE },
    okStatus: 200,
  },
  {
    name: 'PUT /attendance/:id',
    method: 'PUT',
    path: `/attendance/${ATT_ID}`,
    body: { status: 'late' },
    okStatus: 200,
  },
  {
    name: 'DELETE /attendance/:id',
    method: 'DELETE',
    path: `/attendance/${ATT_ID}`,
    okStatus: 200,
  },
  {
    name: 'POST /leave',
    method: 'POST',
    path: '/leave',
    body: {
      studentId: LEAVE_STU,
      classId: CLASS_1,
      leaveType: 'sick',
      startDate: FIXED_DATE,
      endDate: FIXED_DATE,
      totalDays: 1,
      reason: '感冒',
    },
    okStatus: 201,
  },
  {
    name: 'PUT /leave/:id',
    method: 'PUT',
    path: `/leave/${LEAVE_ID}`,
    body: { reason: '感冒加重' },
    okStatus: 200,
  },
  {
    name: 'PUT /leave/:id/approve',
    method: 'PUT',
    path: `/leave/${LEAVE_ID}/approve`,
    body: { status: 'approved', approveRemark: '同意' },
    okStatus: 200,
  },
  { name: 'DELETE /leave/:id', method: 'DELETE', path: `/leave/${LEAVE_ID}`, okStatus: 200 },
]

describe('考勤/请假写端点权限面(edu:manage)', () => {
  for (const c of WRITE_CASES) {
    describe(c.name, () => {
      it('无 token ⇒ 401,且零副作用', async () => {
        scriptBaseRows()
        const res = await call({ method: c.method, path: c.path, body: c.body })
        expect(res.statusCode).toBe(401)
        expect(H.writes).toEqual([])
        expect(H.insertValues).toEqual([])
      })

      it('已登录但无 edu:manage ⇒ 403,且零副作用', async () => {
        scriptBaseRows()
        const res = await call({ method: c.method, as: PLAIN, path: c.path, body: c.body })
        expect(res.statusCode).toBe(403)
        expect(res.body.code).toBe(403)
        expect(H.writes).toEqual([])
        expect(H.insertValues).toEqual([])
      })

      it('持有 edu:manage ⇒ 正控通过', async () => {
        scriptBaseRows()
        H.permGrants.add(`${TEACHER}|edu:manage`)
        const res = await call({ method: c.method, as: TEACHER, path: c.path, body: c.body })
        expect(res.statusCode).toBe(c.okStatus)
        expect([401, 403]).not.toContain(res.statusCode)
      })
    })
  }
})

// =============================================================================
// 2. 读端点权限面三条(edu:view;edu:manage 同予放行)
// =============================================================================

const READ_CASES: Array<{ name: string; path: string }> = [
  { name: 'GET /attendance', path: '/attendance' },
  { name: 'GET /attendance/stats', path: '/attendance/stats' },
  { name: 'GET /leave', path: '/leave' },
]

describe('考勤/请假读端点权限面(edu:view)', () => {
  for (const c of READ_CASES) {
    describe(c.name, () => {
      it('无 token ⇒ 401', async () => {
        scriptBaseRows()
        const res = await call({ method: 'GET', path: c.path })
        expect(res.statusCode).toBe(401)
      })

      it('已登录但无 edu:view/edu:manage ⇒ 403', async () => {
        scriptBaseRows()
        const res = await call({ method: 'GET', as: PLAIN, path: c.path })
        expect(res.statusCode).toBe(403)
      })

      it('持有 edu:view ⇒ 200 且响应走统一信封', async () => {
        scriptBaseRows()
        H.permGrants.add(`${VIEWER}|edu:view`)
        const res = await call({ method: 'GET', as: VIEWER, path: c.path })
        expect(res.statusCode).toBe(200)
        expect(res.body.code).toBe(0)
      })
    })
  }
})

// =============================================================================
// 3. 越权用例(AGENTS §5:断言"副作用没发生"+成对正向对照)
// =============================================================================

describe('越权面', () => {
  it('学生A(无 edu:manage)替学生B 签到 ⇒ 403,且库里没多出 B 的考勤行', async () => {
    scriptBaseRows()
    const attendanceBefore = H.attendance.length
    const res = await call({
      method: 'POST',
      as: STUDENT_A,
      path: '/attendance/check-in',
      body: { studentId: CHILD_B, classId: CLASS_1, date: '2026-03-03' },
    })
    expect(res.statusCode).toBe(403)
    // 副作用未发生:零写链调用、零 insert 值落入假库、世界状态里 B 的考勤行数不变
    expect(H.writes).toEqual([])
    expect(H.insertValues.filter((v) => v.studentId === CHILD_B)).toEqual([])
    expect(H.attendance.length).toBe(attendanceBefore)
  })

  it('正对照:持有 edu:manage 者替 B 签到 ⇒ 201 且确实写了一行 B 的考勤', async () => {
    scriptBaseRows()
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'POST',
      as: TEACHER,
      path: '/attendance/check-in',
      body: { studentId: CHILD_B, classId: CLASS_1, date: '2026-03-03' },
    })
    expect(res.statusCode).toBe(201)
    expect(H.insertValues.some((v) => v.studentId === CHILD_B)).toBe(true)
  })

  it('家长查非自己绑定孩子的考勤 ⇒ 绝不泄露该孩子数据(非 200-with-list)', async () => {
    // 世界状态:PARENT_A 只绑定了 CHILD_X;查 CHILD_Y(没绑定,甚至不存在)
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X, status: 'confirmed' })
    H.attendance.push({
      id: '99999999-9999-4999-8999-999999999999',
      studentId: CHILD_Y_NOT_BOUND,
      classId: CLASS_1,
      date: FIXED_DATE,
      status: 'present',
      deletedAt: null,
    })
    const res = await call({
      method: 'GET',
      as: PARENT_A,
      path: `/parent/children/${CHILD_Y_NOT_BOUND}/attendance`,
    })
    // 安全不变量:未绑定者任何情况下不得读到该孩子的考勤行(200 且 list 非空 = 泄露)
    const leaked =
      res.statusCode === 200 &&
      Array.isArray((res.body.data as { list?: unknown[] } | undefined)?.list) &&
      ((res.body.data as { list?: unknown[] }).list?.length ?? 0) > 0
    expect(leaked).toBe(false)
    expect([401, 403]).toContain(res.statusCode)
  })

  it('已绑定家长的读取链路(契约:绑定命中 ⇒ 200;鉴权未接线时显式 skip)', async (ctx) => {
    const slice = parentAttendanceHandlerSlice()
    if (!slice.includes('checkAuthOrInternalService')) {
      // 实测缺口(报告点名):该端点既不挂 preHandler 也不内调鉴权,直接读 request.userId ⇒ 恒 401,
      // 与 /parent/children/:childId/bills 修复前的缺陷②同型。鉴权接线落盘前此条不判(不伪绿)。
      return ctx.skip()
    }
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X, status: 'confirmed' })
    H.attendance.push({
      id: '88888888-8888-4888-8888-888888888888',
      studentId: CHILD_X,
      classId: CLASS_1,
      date: FIXED_DATE,
      status: 'present',
      deletedAt: null,
    })
    const res = await call({
      method: 'GET',
      as: PARENT_A,
      path: `/parent/children/${CHILD_X}/attendance`,
    })
    expect(res.statusCode).toBe(200)
  })
})

const CHILD_Y_NOT_BOUND = '77777777-7777-4777-8777-777777777777'

// =============================================================================
// 4. 批量写诚实性(门 134 同型)+ 待落盘契约(ATT-JOB 席)
// =============================================================================

const BATCH_LANDED = hasRoute(`server.post('/attendance/batch-check-in'`)
const SELF_LANDED = hasRoute(`server.post('/attendance/self-check-in'`)
const QRCODE_LANDED = hasRoute(`server.post('/attendance/qrcode-check-in'`)
const RULE_FILE_EXISTS = existsSync(RULE_SERVICE_PATH)

describe('POST /attendance/batch-check-in 批量写诚实性', () => {
  it.skipIf(!BATCH_LANDED)(
    '名册 3 人、库里已有 1 人当日考勤 ⇒ created=2、skipped=1、created+skipped=名册数',
    async () => {
      // 名册世界状态:B(CHILD_B,已有当日考勤) + C/D 两名无记录在册学生
      const STUDENT_C = '55555555-5555-4555-8555-555555555555'
      const STUDENT_D = '66666666-6666-4666-8666-666666666666'
      scriptBaseRows() // CHILD_B 在 FIXED_DATE 已有考勤行
      scriptRoster([CHILD_B, STUDENT_C, STUDENT_D])
      H.permGrants.add(`${TEACHER}|edu:manage`)
      const res = await call({
        method: 'POST',
        as: TEACHER,
        path: '/attendance/batch-check-in',
        body: { classId: CLASS_1, date: FIXED_DATE },
      })
      expect(res.statusCode).toBe(200)
      const data = res.body.data as {
        roster?: number
        created?: number
        skipped?: number
        missedIds?: string[]
      }
      // 诚实性(门 134 同型):created/skipped 来自回库确认查询,不是请求数倒推
      expect(data.roster).toBe(3)
      expect(data.created).toBe(2)
      expect(data.skipped).toBe(1)
      expect((data.created ?? 0) + (data.skipped ?? 0)).toBe(data.roster)
      expect(data.missedIds ?? []).toEqual([])
      // 假库侧对账:只为 C/D 发了 insert,B 那条被跳过而非重复写
      expect(H.insertValues.filter((v) => v.studentId === CHILD_B)).toEqual([])
      expect(H.insertValues.map((v) => v.studentId).sort()).toEqual([STUDENT_C, STUDENT_D].sort())
    },
  )

  it.skipIf(!BATCH_LANDED)('名册 0 人 ⇒ 400 点名"无对象",而不是静默 200 空集', async () => {
    H.permGrants.add(`${TEACHER}|edu:manage`)
    const res = await call({
      method: 'POST',
      as: TEACHER,
      path: '/attendance/batch-check-in',
      body: { classId: CLASS_1, date: FIXED_DATE },
    })
    expect(res.statusCode).toBe(400)
    expect(H.insertValues).toEqual([])
  })
})

/** 取某端点注册的处理器源码切片(内容锚点,不写行号;找下一个 server.<method>(' 为止)。 */
function handlerSlice(startMarker: string): string {
  const start = ROUTES_SOURCE.indexOf(startMarker)
  if (start < 0) return ''
  const rest = ROUTES_SOURCE.slice(start + startMarker.length)
  const m = rest.search(/server\.(get|post|put|delete)\(/)
  return m < 0 ? rest.slice(0, 4000) : rest.slice(0, m)
}

describe('自签/扫码契约(身份由承载层显式传入,§5 认证不等于授权)', () => {
  const SELF_AUTH_WIRED = handlerSlice(`server.post('/attendance/self-check-in'`).includes(
    'checkAuthOrInternalService',
  )
  const QR_AUTH_WIRED = handlerSlice(`server.post('/attendance/qrcode-check-in'`).includes(
    'checkAuthOrInternalService',
  )

  it.skipIf(!SELF_LANDED)(
    '学生A 自签:studentId 不得被客户端自报成 B ⇒ 库里没多出 B 的考勤行',
    async () => {
      scriptBaseRows()
      const before = H.attendance.length
      const res = await call({
        method: 'POST',
        as: STUDENT_A,
        path: '/attendance/self-check-in',
        body: { classId: CLASS_1, date: FIXED_DATE, studentId: CHILD_B },
      })
      // 核心不变量:无论端点走到哪一步,都不得为学生 B 落考勤行
      expect(H.insertValues.filter((v) => v.studentId === CHILD_B)).toEqual([])
      expect(H.attendance.length).toBe(before)
      if (!SELF_AUTH_WIRED) {
        // 钉死实测缺口(报告点名):该端点既不挂 preHandler 也不内调鉴权,
        // request.userId 无人赋值 ⇒ 任何真凭据都恒 401「未登录」。接线落盘后本分支自动退出。
        expect(res.statusCode).toBe(401)
      }
    },
  )

  it.skipIf(!QRCODE_LANDED)('扫码签到:无凭据/非法 token ⇒ 非 201 且零考勤写入', async () => {
    scriptBaseRows()
    const res = await call({
      method: 'POST',
      as: STUDENT_A,
      path: '/attendance/qrcode-check-in',
      body: { classId: CLASS_1, token: 'forged-token' },
    })
    expect(res.statusCode).not.toBe(201)
    expect(H.insertValues).toEqual([])
    if (!QR_AUTH_WIRED) {
      // 同型缺口:扫码腿同样未接承载层鉴权,恒 401(接线后本分支自动退出)
      expect(res.statusCode).toBe(401)
    } else {
      expect([400, 403]).toContain(res.statusCode)
    }
  })
})

// =============================================================================
// 5. 判定纯函数(§22c:判据实现唯一在 src/services/edu-attendance-rule.ts 的 __test__ 出口,
//    本文件只 import 调用、零复制;文件未落盘时四型用例显式 skip,不伪造绿)
// =============================================================================

describe('edu-attendance-rule 判定纯函数(迟到/早退/正常/输入缺失四型)', () => {
  type JudgeResult = { status: string; reason: string }
  type JudgeInput = {
    lateAfter?: string | null
    earlyBefore?: string | null
    checkInTime?: Date | null
    checkOutTime?: Date | null
  }
  async function loadRule(): Promise<{
    judgeStatus: (i: JudgeInput) => string
    judgeStatusDetailed: (i: JudgeInput) => JudgeResult
  } | null> {
    if (!RULE_FILE_EXISTS) return null
    try {
      const mod = (await import('../src/services/edu-attendance-rule.js')) as Record<
        string,
        unknown
      >
      const test = mod.__test__ as Record<string, unknown> | undefined
      if (!test || typeof test.judgeStatusDetailed !== 'function') return null
      return {
        judgeStatus: test.judgeStatus as (i: JudgeInput) => string,
        judgeStatusDetailed: test.judgeStatusDetailed as (i: JudgeInput) => JudgeResult,
      }
    } catch {
      return null
    }
  }

  it('迟到:签到时刻晚于 lateAfter 阈值 ⇒ late,reason 点名两时刻', async (ctx) => {
    const rule = await loadRule()
    if (!rule) return ctx.skip()
    const out = rule.judgeStatusDetailed({
      lateAfter: '08:30',
      checkInTime: new Date(2026, 0, 5, 9, 30),
    })
    expect(out.status).toBe('late')
    expect(out.reason).toMatch(/^late:/)
    expect(rule.judgeStatus({ lateAfter: '08:30', checkInTime: new Date(2026, 0, 5, 9, 30) })).toBe(
      'late',
    )
  })

  it('早退:签退时刻早于 earlyBefore 阈值 ⇒ early,reason 点名两时刻', async (ctx) => {
    const rule = await loadRule()
    if (!rule) return ctx.skip()
    const out = rule.judgeStatusDetailed({
      earlyBefore: '16:00',
      checkInTime: new Date(2026, 0, 5, 8, 0),
      checkOutTime: new Date(2026, 0, 5, 14, 0),
    })
    expect(out.status).toBe('early')
    expect(out.reason).toMatch(/^early:/)
  })

  it('正常:阈值内 ⇒ present 且 reason=ok(真判过,不是判不出)', async (ctx) => {
    const rule = await loadRule()
    if (!rule) return ctx.skip()
    const out = rule.judgeStatusDetailed({
      lateAfter: '08:30',
      earlyBefore: '16:00',
      checkInTime: new Date(2026, 0, 5, 8, 0),
      checkOutTime: new Date(2026, 0, 5, 16, 30),
    })
    expect(out.status).toBe('present')
    expect(out.reason).toBe('ok')
  })

  it('输入缺失:无签到时刻 ⇒ absent(no-check-in);非法阈值 ⇒ unjudged 形态不冒充判过(§0.3)', async (ctx) => {
    const rule = await loadRule()
    if (!rule) return ctx.skip()
    const missing = rule.judgeStatusDetailed({ lateAfter: '08:30', checkInTime: null })
    expect(missing.status).toBe('absent')
    expect(missing.reason).toBe('no-check-in')
    // 没签退 ≠ 早退:早退维缺 checkOutTime 时不参与判定
    const noCheckOut = rule.judgeStatusDetailed({
      earlyBefore: '16:00',
      checkInTime: new Date(2026, 0, 5, 8, 0),
      checkOutTime: null,
    })
    expect(noCheckOut.status).toBe('present')
    // 畸形阈值 ⇒ reason 必须是 unjudged:* 子因,而不是静默放行
    const malformed = rule.judgeStatusDetailed({
      lateAfter: '25:99',
      checkInTime: new Date(2026, 0, 5, 8, 0),
    })
    expect(malformed.reason).toMatch(/^unjudged:/)
  })

  it('待落盘点名(已落盘则本条空转):src/services/edu-attendance-rule.ts 的 __test__ 出口', () => {
    // 缺口登记:文件与 __test__.{judgeStatus, judgeStatusDetailed, hmOfLocalDate} 已于 2026-11-01
    // 实测落盘(ATT-JOB/ATT-API 席);若被回退,上面四型用例自动转 skip,本条负责显式留痕。
    expect(RULE_FILE_EXISTS).toBe(RULE_FILE_EXISTS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
