// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤读端点 status 枚举闸契约锁(2026-11-04 立,**全程不连库**,PG 8810 / Redis 8811 一条都不碰)。
 *
 * 立因(实测根因,不是推测):`apps/api/src/routes/edu-ai-management.ts` 的
 * `attendanceListQuerySchema.status` 此前是 `z.transform(emptyToUndefined).pipe(z.string().max(20))`
 * ⇒ 任意字符串都被当合法筛选值,后端按 `eq(status,'all')` **精确匹配**。web「全部状态」档
 * 直传 `status=all` 时列表恒空且不报错,用户看到"今天没人考勤"。前端侧已归一为不传
 * (提交 41d5da91ec8),本票补后端那一半:非法枚举值必须是**可整改的 400**,零查询、零写库。
 *
 * 两把尺子:
 * 1. **行为面**(Fastify inject + 假库):`status=all` 与其余非五档值 ⇒ 400,且 message 逐字点名
 *    每一个合法值;400 路径上 `db.select` 调用数为 0、写侧调用数为 0(成对留正向对照:
 *    合法值 ⇒ 200 且真发起查询)。「全部」档(不传 / 传空串)必须**不加状态条件**,这条把
 *    前端刚修好的行为在后端也钉住。家长端 `GET /parent/child/:id/attendance` 同型收口。
 * 2. **结构面**(§22c:import 源件的 `__test__` 出口,测试里零复制取值表):枚举档必须恰好等于
 *    `judgeStatus` 现算产出的四档 ∪ 路由自己写入的 `'leave'` ⇒ 少一档(把合法值判死)或多一档
 *    (放进一个无人写的协议码)都翻红;两枚读 schema 必须共用同一枚取值实例(不一致即缺陷)。
 *
 * 夹具形态抄同族既有件 tests/edu-attendance-rbac-contract.test.ts 与
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
    /** 写侧调用记录 —— 400/403 用例必须断言它恒空(副作用没发生) */
    writes: [] as string[],
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
 * 写侧一律记账并返回空形状。本文件不建任何真连接(AGENTS §5 测试隔离铁律)。
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
    step.values = vi.fn(() => step)
    step.set = vi.fn(() => step)
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
import { __test__ as ruleTest } from '../src/services/edu-attendance-rule.js'

const PREFIX = '/api/edu-ai-management'
const ROUTE_FILE = fileURLToPath(new URL('../src/routes/edu-ai-management.ts', import.meta.url))
const ROUTES_SOURCE = readFileSync(ROUTE_FILE, 'utf8')

const VIEWER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' // edu:view
const PLAIN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' // 无任何权限点
const PARENT_A = '33333333-3333-4333-8333-333333333333'
const CHILD_X = '44444444-4444-4444-8444-444444444444'
const CHILD_NOT_BOUND = '77777777-7777-4777-8777-777777777777'
const CLASS_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

// =============================================================================
// 结构面:取值表只认源件自己(§22c —— 测试里不复制第二份档位常量)
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

const filterEnum = (routeTest as Record<string, unknown>).attendanceStatusFilter
const LEGAL = entriesOf(filterEnum)
/** 灌给假库解答器:测试侧仍零复制(唯一来源是源件的枚举实例)。 */
H.legalStatuses = LEGAL

/** 非法值样本:覆盖本票要治的那一枚字面量,以及形状相近的绕过面。 */
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

async function get(
  pathWithQuery: string,
  as?: string,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await getApp()
  const headers: Record<string, string> = {}
  if (as) headers.authorization = `Bearer ${accessToken(as)}`
  const res = await app.inject({ method: 'GET', url: `${PREFIX}${pathWithQuery}`, headers })
  let body: Record<string, unknown> = {}
  try {
    body = res.json() as Record<string, unknown>
  } catch {
    body = { raw: res.body }
  }
  return { statusCode: res.statusCode, body }
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
  deletedAt: null,
})

/** 世界状态:同一学生两档状态各一行(正向对照要能区分"筛选生效"与"恒空")。 */
function scriptAttendance(): void {
  H.attendance.push(attRow('aaaaaaaa-0000-4000-8000-000000000001', CHILD_X, 'present'))
  H.attendance.push(attRow('aaaaaaaa-0000-4000-8000-000000000002', CHILD_X, 'absent'))
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
}

beforeEach(() => {
  resetWorld()
})

afterAll(async () => {
  if (appPromise) (await appPromise).close()
  appPromise = null
})

// =============================================================================
// 1. GET /attendance:非法 status ⇒ 400 + 点名合法值 + 零查询零写库
// =============================================================================

describe('GET /attendance 的 status 枚举闸', () => {
  it('status=all ⇒ 400,message 逐字点名每一个合法值', async () => {
    scriptAttendance()
    H.permGrants.add(`${VIEWER}|edu:view`)
    const res = await get('/attendance?status=all', VIEWER)
    expect(res.statusCode).toBe(400)
    expect(res.body.code).toBe(400)
    const message = String(res.body.message ?? '')
    expect(message.length).toBeGreaterThan(0)
    for (const one of LEGAL) expect(message).toContain(one)
    // 本仓错误信封 = { code, message }(utils/response.ts 的 error());不得把列表冒充成 data
    expect(res.body.data).toBeUndefined()
  })

  it('status=all ⇒ 零查询、零写库(非法值绝不进 where)', async () => {
    scriptAttendance()
    H.permGrants.add(`${VIEWER}|edu:view`)
    const res = await get('/attendance?status=all', VIEWER)
    expect(res.statusCode).toBe(400)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('其余非枚举值逐条同样 400 且零查询(含前后带空格与超长串)', async () => {
    scriptAttendance()
    H.permGrants.add(`${VIEWER}|edu:view`)
    for (const bad of ILLEGAL) {
      resetWorld()
      scriptAttendance()
      H.permGrants.add(`${VIEWER}|edu:view`)
      const res = await get(`/attendance?status=${encodeURIComponent(bad)}`, VIEWER)
      expect(res.statusCode, `status=${JSON.stringify(bad)} 必须被拒`).toBe(400)
      expect(H.reads, `status=${JSON.stringify(bad)} 不许发起查询`).toBe(0)
      expect(H.writes).toEqual([])
    }
  })

  it('正对照:每一个合法档 ⇒ 200 且真发起查询(证明上一条的 0 查询不是"永远不查")', async () => {
    H.permGrants.add(`${VIEWER}|edu:view`)
    for (const one of LEGAL) {
      resetWorld()
      scriptAttendance()
      H.attendance.push(attRow('aaaaaaaa-0000-4000-8000-000000000003', CHILD_X, one))
      H.permGrants.add(`${VIEWER}|edu:view`)
      const res = await get(`/attendance?status=${one}`, VIEWER)
      expect(res.statusCode, `status=${one} 必须被接受`).toBe(200)
      expect(res.body.code).toBe(0)
      expect(H.reads).toBeGreaterThan(0)
    }
  })

  it('「全部」档(不传 / 传空串)⇒ 200 且谓词里不含任何状态码:钉住"全部=不加条件"', async () => {
    H.permGrants.add(`${VIEWER}|edu:view`)
    for (const qs of ['', '?status=']) {
      resetWorld()
      scriptAttendance()
      H.permGrants.add(`${VIEWER}|edu:view`)
      const res = await get(`/attendance${qs}`, VIEWER)
      expect(res.statusCode, `query="${qs}" 应视作不筛选`).toBe(200)
      for (const w of H.wheres) {
        const lits = H.literalsOf(w)
        for (const status of LEGAL) {
          expect(
            lits,
            `不传 status 时谓词里不该出现状态码 ${status}(否则会复现"恒查空"那一型缺陷)`,
          ).not.toContain(status)
        }
      }
      // 正向对照:不加条件时假库的两档都回得来(证明"没条件"≠"查不到")
      const list = (res.body.data as { list?: unknown[] } | undefined)?.list ?? []
      expect(list.length).toBe(2)
    }
  })

  it('status= 纯空格 ⇒ 400(空串归一为"不筛选",但带空格的串不是空值)', async () => {
    H.permGrants.add(`${VIEWER}|edu:view`)
    const res = await get('/attendance?status=%20', VIEWER)
    expect(res.statusCode).toBe(400)
    expect(H.reads).toBe(0)
  })

  it('鉴权先于形状闸:无 token ⇒ 401、无 edu:view ⇒ 403,两者都零查询零写库', async () => {
    scriptAttendance()
    const anon = await get('/attendance?status=all')
    expect(anon.statusCode).toBe(401)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])

    resetWorld()
    scriptAttendance()
    const denied = await get('/attendance?status=all', PLAIN)
    expect(denied.statusCode).toBe(403)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('同一非法请求连打两次,结论逐字相同(不靠运气绿)', async () => {
    H.permGrants.add(`${VIEWER}|edu:view`)
    scriptAttendance()
    const first = await get('/attendance?status=all', VIEWER)
    const second = await get('/attendance?status=all', VIEWER)
    expect(second.statusCode).toBe(first.statusCode)
    expect(JSON.stringify(second.body)).toBe(JSON.stringify(first.body))
    expect(H.writes).toEqual([])
  })
})

// =============================================================================
// 2. GET /parent/child/:id/attendance:同批收口(不一致就是缺陷)
// =============================================================================

describe('GET /parent/child/:id/attendance 的 status 枚举闸(与 /attendance 同一张脸)', () => {
  it('status=all ⇒ 400 且零查询(绑定查询都没跑)、零写库', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await get(`/parent/child/${CHILD_X}/attendance?status=all`, PARENT_A)
    expect(res.statusCode).toBe(400)
    const message = String(res.body.message ?? '')
    for (const one of LEGAL) expect(message).toContain(one)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('正对照:已绑定家长 + 合法档 ⇒ 200,且筛选真的生效(不是恒空)', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await get(`/parent/child/${CHILD_X}/attendance?status=present`, PARENT_A)
    expect(res.statusCode).toBe(200)
    const list = (res.body.data as { list?: Array<Record<string, unknown>> } | undefined)?.list
    expect(Array.isArray(list)).toBe(true)
    expect((list ?? []).length).toBe(1)
    expect(String(list?.[0]?.status)).toBe('present')
    expect(H.reads).toBeGreaterThan(0)
  })

  it('不传 status ⇒ 全量两档都在(「全部」= 不加状态条件)', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await get(`/parent/child/${CHILD_X}/attendance`, PARENT_A)
    expect(res.statusCode).toBe(200)
    const list = (res.body.data as { list?: unknown[] } | undefined)?.list ?? []
    expect(list.length).toBe(2)
  })

  it('非法值 + 未绑定家长 ⇒ 400(形状闸排在绑定查询之前),零查询零写库', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await get(
      `/parent/child/${CHILD_NOT_BOUND}/attendance?status=all`,
      '99999999-9999-4999-8999-999999999999',
    )
    // 现读次序:登录鉴权 → 路径 uuid 闸 → 查询形状闸 → 归属(confirmed 绑定)查询。
    // 非法协议码在归属查询之前就应当被挡掉(零查询),这条把当前次序钉住:改次序必须显式过一遍本用例。
    expect(res.statusCode).toBe(400)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })

  it('合法值 + 未绑定家长 ⇒ 403(归属闸仍在),且不泄露该孩子数据', async () => {
    H.bindings.push({ parentId: PARENT_A, childId: CHILD_X })
    scriptAttendance()
    const res = await get(
      `/parent/child/${CHILD_NOT_BOUND}/attendance?status=present`,
      '99999999-9999-4999-8999-999999999999',
    )
    expect(res.statusCode).toBe(403)
    const list = (res.body.data as { list?: unknown[] } | undefined)?.list
    expect(list === undefined || list.length === 0).toBe(true)
    expect(H.writes).toEqual([])
  })
})

// =============================================================================
// 3. 结构锁:取值表与判定器/落库值同源,两枚读 schema 共用同一实例
// =============================================================================

describe('status 取值表的同源锁(§22c:判据只有一份)', () => {
  it('枚举档恰好等于 judgeStatus 现算产出的四档 ∪ 路由自己写入的 leave', () => {
    const judge = (ruleTest as Record<string, unknown>).judgeStatus as (i: unknown) => string
    const judged = new Set<string>([
      judge({ checkInTime: null }),
      judge({ lateAfter: '08:30', checkInTime: new Date(2026, 0, 5, 9, 30) }),
      judge({
        earlyBefore: '16:00',
        checkInTime: new Date(2026, 0, 5, 8, 0),
        checkOutTime: new Date(2026, 0, 5, 14, 0),
      }),
      judge({
        lateAfter: '08:30',
        earlyBefore: '16:00',
        checkInTime: new Date(2026, 0, 5, 8, 0),
        checkOutTime: new Date(2026, 0, 5, 16, 30),
      }),
    ])
    // leave 这一档由请假审批流写入路由自己那句 eq(status,'leave') —— 现读源码,不写行号
    expect(ROUTES_SOURCE.includes(`eq(eduAttendanceRecord.status, 'leave')`)).toBe(true)
    const expected = new Set<string>([...judged, 'leave'])
    expect(new Set(LEGAL)).toEqual(expected)
  })

  it('两枚考勤读 schema 对同一取值表逐字一致(同批收口,不许一张脸一只眼)', () => {
    const list = (routeTest as Record<string, unknown>).attendanceListQuerySchema as {
      safeParse: (i: unknown) => { success: boolean }
    }
    const child = (routeTest as Record<string, unknown>).childAttendanceQuerySchema as {
      safeParse: (i: unknown) => { success: boolean }
    }
    for (const one of [...LEGAL, ...ILLEGAL]) {
      expect(
        list.safeParse({ status: one }).success,
        `GET /attendance 对 ${JSON.stringify(one)} 的结论`,
      ).toBe(child.safeParse({ status: one }).success)
    }
  })

  it('枚举闸不吃客户端自报的其它形状:未知键仍被 zod strip(不改变既有契约)', () => {
    const list = (routeTest as Record<string, unknown>).attendanceListQuerySchema as {
      safeParse: (i: unknown) => { success: boolean; data?: Record<string, unknown> }
    }
    const ok = list.safeParse({ status: 'late', studentId: CHILD_X, foo: 'bar' })
    expect(ok.success).toBe(true)
    expect(ok.data?.status).toBe('late')
    expect(ok.data?.foo).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
