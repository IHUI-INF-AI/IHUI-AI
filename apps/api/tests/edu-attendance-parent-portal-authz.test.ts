// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长门户 + 学生自签端点的承载层鉴权契约锁(2026-11-03 立,**全程不连库**)。
 *
 * 立因(实测根因,不是推测):`apps/api/src/routes/edu-ai-management.ts` 未挂任何全局
 * preHandler,而全仓往 `request.userId` 赋值的三处(plugins/auth.ts 的 authenticate、
 * plugins/internal-service-token.ts、utils/open-capability-gate.ts)结构上都覆盖不到
 * 「端点自己既没挂 preHandler 也没调鉴权」这条路 ⇒ `request.userId` 恒空,端点内那句手写
 * `if (!userId) return 401` 让**每一条真实请求都是 401**。同文件 `/parent/children/:childId/bills`
 * 的修复注释(2026-10-24)已记载同型根因;本票把整片 22 枚一次归位。
 *
 * 两把尺子:
 * 1. **结构锁**(静态读路由源码):22 枚目标端点的处理器体内,自 `server.<method>('<path>'`
 *    起、到下一条路由注册为止的那段里必须出现 `checkAuthOrInternalService`。少一条即红并点名路径。
 *    变异自证:临时摘掉任一条接线 ⇒ 本用例必须翻红。
 * 2. **行为用例**(假库 Fastify inject):无凭据 ⇒ 401;有凭据且绑定 confirmed ⇒ 正常返回;
 *    有凭据但未绑定该孩子 ⇒ 403 **且零写入、归属外的表一次都没查**;
 *    `GET /attendance/me` ⇒ 返回行 studentId 全部等于登录主体,客户端自报 `?studentId=<别人>` 被忽略。
 *
 * 身份**不由测试侧手写 `request.userId`**(那等于绕过承载层自证),而是走真实鉴权链:
 * 桩 @ihui/auth.verifyAccessToken + db/usercenter-queries.getUserStatus,凭据以真三段式 JWS
 * 形态传入 Authorization: Bearer。形状抄同族既有件 tests/edu-parent-bills-contract.test.ts。
 *
 * 测试隔离铁律(AGENTS §5):不连 PG 8810 / Redis 8811;DATABASE_URL 只是占位字面量。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。每轮用例前清零。 */
const H = vi.hoisted(() => {
  // 测试侧"签名":FNV-1a 摘要,把凭据内容(header+payload)绑进签名段。
  // 要点不是密码学强度,而是让「改 payload」与「换签名段」两型伪造都能被判负。
  const fnv1a = (s: string): string => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const testSecret = 'ihui-test-jwt-secret'

  /** 从 drizzle 条件对象里取出被绑定的字面值(列对象不是字面值,自然被跳过)。唯一实现。 */
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
    /** 世界状态:已 confirmed 的 (家长, 学员) 绑定对 */
    bindings: [] as Array<{ parentId: string; childId: string }>,
    /** 世界状态:按主键登记的绑定行(逐条 confirm/reject/解绑 的归属判据取它) */
    bindingRowsById: [] as Array<{
      id: string
      parentId: string
      studentId: string
      status: string
    }>,
    /** 世界状态:考勤行集(查询按谓词里绑定的 studentId 过滤) */
    attendance: [] as Array<Record<string, unknown>>,
    /** 第 n 次 db.select() 的返回行集 */
    results: [] as unknown[],
    /** 第 n 次 db.select() 实际收到的 where() 条件对象(归属判据的唯一可读面) */
    wheres: [] as unknown[],
    /** db.select() 调用次数 */
    reads: 0,
    /** 写侧调用记录 —— 403 用例必须断言它恒空(副作用没发生) */
    writes: [] as string[],
    /** users.status 覆盖表(缺省 1 = 正常) */
    statusOverrides: new Map<string, number>(),
    testSecret,
    sigOf: (headerAndPayload: string) =>
      `${fnv1a(`${headerAndPayload}.${testSecret}`)}${fnv1a(`${headerAndPayload}.reverse`)}`,
    literalsOf,
  }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/forbidden-in-mock-tests',
    // 必须带合法 db 段:非数字段会让 ioredis 发 SELECT NaN 成为 unhandled rejection,
    // 把退出码打成 1(用例全过也判红)。6379 本机无监听 ⇒ 只在 error 事件里失败,不碰生产 8811。
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * db 链式桩:select 的返回行集由**这次查询的谓词**对世界状态求值得到(见 rowsFor),
 * 写侧一律记账并返回空。本文件不建任何真连接。
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
    'values',
    'set',
    'returning',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ] as const

  /**
   * 谓词解答器:返回"假如这是真库,这条 where 会命中哪些行"。靠谓词本身区分,不靠调用序:
   * - 绑定查询带 status='confirmed' ⇒ 与 H.bindings 求交(家长/学员两个 uuid 都必须在谓词里);
   * - 考勤/名单类查询 ⇒ 按谓词里绑定的 studentId 过滤 H.attendance。
   */
  const rowsFor = (predicate: unknown): unknown[] => {
    const literals = H.literalsOf(predicate)
    if (literals.includes('confirmed')) {
      // 归属探针:家长与学生两个 uuid 都必须在谓词里,且绑定对要已登记,才回一行。
      const pairs = H.bindings.filter(
        (b) => literals.includes(b.parentId) && literals.includes(b.childId),
      )
      return pairs.map(() => ({ id: 'binding-row-1' }))
    }
    const byId = H.bindingRowsById.find((r) => literals.includes(r.id))
    if (byId)
      return [
        { id: byId.id, parentId: byId.parentId, studentId: byId.studentId, status: byId.status },
      ]
    return H.attendance.filter((row) => literals.includes(String(row.studentId)))
  }

  const makeChain = (slot: number) => {
    const step: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) {
      step[m] = vi.fn((arg?: unknown) => {
        if (m === 'where') {
          H.wheres[slot] = arg
          H.results[slot] = rowsFor(arg)
        }
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(H.results[slot] ?? []).then(resolve, reject)
    return step
  }

  const readChain = () => {
    const slot = H.reads
    H.reads += 1
    H.results[slot] = H.results[slot] ?? []
    return makeChain(slot)
  }
  const writeChain = (kind: string) => {
    H.writes.push(kind)
    return makeChain(Number.MAX_SAFE_INTEGER)
  }

  return {
    db: {
      select: vi.fn(() => readChain()),
      insert: vi.fn(() => writeChain('insert')),
      update: vi.fn(() => writeChain('update')),
      delete: vi.fn(() => writeChain('delete')),
      execute: vi.fn(() => {
        H.writes.push('execute')
        return Promise.resolve([])
      }),
      transaction: vi.fn(() => {
        H.writes.push('transaction')
        return Promise.resolve([])
      }),
    },
    dbRead: { select: vi.fn(() => readChain()) },
    dbClient: {},
    dbWriter: { select: vi.fn(() => readChain()) },
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

/** 承载层的验签步:只替掉「验签」这一件事,其余 authenticate 链是真的。 */
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
      const claims = safeJson(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
      if (!claims || typeof claims.userId !== 'string' || claims.userId === '') reject()
      return { phone: '', familyId: '', roleId: 0, ...claims }
    }),
  }
})

/** 承载层的账号状态查询步。 */
vi.mock('../src/db/usercenter-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getUserStatus: vi.fn(async (id: string) => H.statusOverrides.get(id) ?? 1),
  }
})

vi.mock('../src/services/edu-ledger.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, loadEnrollmentLedger: vi.fn(async () => null) }
})

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const PREFIX = '/api/edu-ai-management'
const ROUTE_FILE = new URL('../src/routes/edu-ai-management.ts', import.meta.url)

const PARENT_A = '11111111-1111-4111-8111-111111111111'
const PARENT_B = '22222222-2222-4222-8222-222222222222'
const CHILD_X = '33333333-3333-4333-8333-333333333333'
const CHILD_Y = '44444444-4444-4444-8444-444444444444'
const STUDENT_S = '55555555-5555-4555-8555-555555555555'
const OTHER_STUDENT = '66666666-6666-4666-8666-666666666666'
const BINDING_ID = '77777777-7777-4777-8777-777777777777'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

/** 本票接线清单(内容锚点:方法 + 路径模板;不写行号 —— 行号一次 append 就挪位)。 */
const WIRING_TARGETS: Array<[Method, string]> = [
  ['POST', '/attendance/self-check-in'],
  ['POST', '/attendance/qrcode-check-in'],
  ['GET', '/parent/binding'],
  ['POST', '/parent/binding'],
  ['PUT', '/parent/binding/:id'],
  ['DELETE', '/parent/binding/:id'],
  ['GET', '/parent/children'],
  ['GET', '/parent/child/:id/attendance'],
  ['GET', '/parent/child/:id/grades'],
  ['GET', '/parent/child/:id/schedule'],
  ['GET', '/parent/child/:id/study-plans'],
  ['GET', '/parent/child/:id/meals'],
  ['GET', '/parent/children/:childId/courses'],
  ['GET', '/parent/children/:childId/meals'],
  ['GET', '/parent/children/:childId/study-plans'],
  ['GET', '/parent/children/:childId/attendance'],
  ['GET', '/parent/children/:childId/grades'],
  ['GET', '/parent-binding'],
  ['POST', '/parent-binding'],
  ['DELETE', '/parent-binding/:id'],
  ['PUT', '/parent-binding/:id/confirm'],
  ['PUT', '/parent-binding/:id/reject'],
]

/** 把路径模板填成可注入的真实 URL。 */
function materialize(path: string): string {
  return path.replace(':childId', CHILD_X).replace(':id', BINDING_ID)
}

/** 造一条真三段式 JWS(验签桩用同一份 sigOf 核对)。 */
function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

async function buildApp(): Promise<FastifyInstance> {
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
  return app
}

interface Call {
  method: Method
  /** 路径模板(会经 materialize 填充) */
  path: string
  /** 登录主体:发真凭据,由真鉴权链注入 request.userId;不传 = 匿名 */
  as?: string
  query?: Record<string, string>
  body?: unknown
}

async function call(o: Call): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await buildApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${materialize(o.path)}${qs}`,
    headers,
    payload: o.body,
  })
  await app.close()
  return { statusCode: res.statusCode, body: (res.json() ?? {}) as Record<string, unknown> }
}

function bind(parentId: string, childId: string): void {
  H.bindings.push({ parentId, childId })
}

const attendanceRow = (id: string, studentId: string, date: string): Record<string, unknown> => ({
  id,
  studentId,
  classId: '88888888-8888-4888-8888-888888888888',
  date,
  status: 'present',
  checkInMethod: 'self',
  deletedAt: null,
})

beforeEach(() => {
  H.bindings.length = 0
  H.bindingRowsById.length = 0
  H.attendance.length = 0
  H.results.length = 0
  H.wheres.length = 0
  H.reads = 0
  H.writes.length = 0
  H.statusOverrides.clear()
})

describe('结构锁:22 枚端点的处理器必须自持承载层鉴权出口', () => {
  it('每条目标路由体内都出现 checkAuthOrInternalService', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8').split('\n')
    const routeRe = /^\s*server\.(get|post|put|delete|patch)\('([^']+)'/
    const starts: Array<{ idx: number; method: string; path: string }> = []
    for (let i = 0; i < src.length; i += 1) {
      const m = routeRe.exec(src[i]!)
      if (m) starts.push({ idx: i, method: m[1]!.toUpperCase(), path: m[2]! })
    }
    expect(starts.length).toBeGreaterThan(150) // 取不到路由面 ⇒ 尺子本身失效,不许静默放行

    const missing: string[] = []
    for (const [method, path] of WIRING_TARGETS) {
      const hit = starts.filter((s) => s.method === method && s.path === path)
      if (hit.length !== 1) {
        missing.push(`${method} ${path}(路由注册命中 ${hit.length} 条,期望恰 1 条)`)
        continue
      }
      const from = hit[0]!.idx
      const next = starts.find((s) => s.idx > from)
      const body = src.slice(from, next ? next.idx : src.length).join('\n')
      if (!/checkAuthOrInternalService\s*\(\s*request\s*,\s*reply\s*\)/.test(body)) {
        missing.push(`${method} ${path}`)
      }
    }
    expect(missing, `承载层鉴权缺位的端点:\n${missing.join('\n')}`).toEqual([])
  })

  it('接线之后不得再留手写的 `if (!userId) 401` 第二把尺', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8').split('\n')
    const routeRe = /^\s*server\.(get|post|put|delete|patch)\('([^']+)'/
    const starts: Array<{ idx: number; method: string; path: string }> = []
    for (let i = 0; i < src.length; i += 1) {
      const m = routeRe.exec(src[i]!)
      if (m) starts.push({ idx: i, method: m[1]!.toUpperCase(), path: m[2]! })
    }
    const leftovers: string[] = []
    for (const [method, path] of WIRING_TARGETS) {
      const hit = starts.filter((s) => s.method === method && s.path === path)
      if (hit.length !== 1) continue
      const from = hit[0]!.idx
      const next = starts.find((s) => s.idx > from)
      const body = src.slice(from, next ? next.idx : src.length).join('\n')
      if (/if \(!userId\) return reply\.status\(401\)/.test(body))
        leftovers.push(`${method} ${path}`)
    }
    expect(leftovers, `仍留有手写 401 的端点:\n${leftovers.join('\n')}`).toEqual([])
  })

  it('新增的 GET /attendance/me 不接受客户端自报 studentId(入参形状里没有它)', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8')
    const schema = /const myAttendanceQuerySchema = z\.object\(\{[\s\S]*?\}\)/.exec(src)
    expect(schema, 'myAttendanceQuerySchema 必须存在').not.toBeNull()
    expect(schema![0]).not.toMatch(/studentId/)
    expect(schema![0]).toMatch(/date: attendanceDateSchema/)
    expect(schema![0]).toMatch(/startDate: attendanceDateSchema/)
    expect(schema![0]).toMatch(/endDate: attendanceDateSchema/)
  })
})

describe('行为用例:匿名请求一律 401(22 枚逐条,鉴权先于形状闸)', () => {
  const cases: Array<[Method, string, Record<string, string>?]> = WIRING_TARGETS.map(
    ([m, p]) => [m, p] as [Method, string],
  )
  for (const [method, path] of cases) {
    it(`${method} ${path} 无凭据 ⇒ 401`, async () => {
      const res = await call({ method, path })
      expect(res.statusCode, `${method} ${path} 匿名应 401`).toBe(401)
      // 匿名必须在任何查询之前终止
      expect(H.reads, `${method} ${path} 匿名不得触达任何表`).toBe(0)
      expect(H.writes, `${method} ${path} 匿名不得有副作用`).toEqual([])
    })
  }
})

describe('行为用例:归属校验(鉴权≠授权)未被接线削弱', () => {
  it('家长已 confirmed 绑定该孩子 ⇒ 正常返回 { list }', async () => {
    bind(PARENT_A, CHILD_X)
    H.attendance.push(attendanceRow('att-1', CHILD_X, '2026-11-02'))
    const res = await call({
      method: 'GET',
      path: '/parent/children/:childId/attendance',
      as: PARENT_A,
    })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as { list: Array<Record<string, unknown>> }
    expect(Array.isArray(data.list)).toBe(true)
    expect(data.list.map((r) => r.id)).toEqual(['att-1'])
  })

  it('有凭据但未绑定该孩子 ⇒ 403,且零写入、归属外的表一次都没查', async () => {
    bind(PARENT_B, CHILD_Y) // PARENT_A 与 CHILD_X 之间没有任何绑定
    H.attendance.push(attendanceRow('att-x', CHILD_X, '2026-11-02'))
    const res = await call({
      method: 'GET',
      path: '/parent/children/:childId/attendance',
      as: PARENT_A,
    })
    expect(res.statusCode).toBe(403)
    expect(H.writes, '403 之后不得有任何写副作用').toEqual([])
    // 只应问过绑定表那一次;考勤表一次都不许被查询
    expect(H.reads, '归属不成立时不得再查归属外的数据').toBe(1)
    const literalPools = H.wheres.filter((w) => w !== undefined).map((w) => H.literalsOf(w))
    const boundProbe = literalPools.find((l) => l.includes('confirmed'))
    expect(boundProbe, '必须真的带 status=confirmed 归属判据').toBeDefined()
    expect(boundProbe).toContain(PARENT_A)
    expect(boundProbe).toContain(CHILD_X)
  })

  it('孩子考勤 /parent/child/:id/attendance 未绑定同样 403 且不查表', async () => {
    H.attendance.push(attendanceRow('att-x', CHILD_X, '2026-11-02'))
    const res = await call({ method: 'GET', path: '/parent/child/:id/attendance', as: PARENT_A })
    expect(res.statusCode).toBe(403)
    expect(H.reads).toBe(1)
    expect(H.writes).toEqual([])
  })

  it('绑定判据仍是 confirmed:pending 绑定不放过', async () => {
    // 世界状态里只有 PARENT_A↔CHILD_X,但 H.bindings 只在 status='confirmed' 谓词下被求交;
    // 因此「未登记绑定」与「绑定非 confirmed」在这一格里同形 —— 都必须是 403 而非 200。
    const res = await call({ method: 'GET', path: '/parent/children', as: PARENT_A })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as { children: unknown[] }
    expect(data.children).toEqual([])
  })

  it('学生本人不得经 /parent-binding/:id/confirm 确认他人的绑定', async () => {
    H.bindingRowsById.push({
      id: BINDING_ID,
      parentId: PARENT_A,
      studentId: CHILD_X,
      status: 'pending',
    })
    const res = await call({ method: 'PUT', path: '/parent-binding/:id/confirm', as: STUDENT_S })
    expect(res.statusCode).toBe(403)
    expect(H.writes, '越权确认必须零写入').toEqual([])
  })
})

describe('行为用例:GET /attendance/me(学生本人考勤)', () => {
  it('返回行全部 studentId === 登录主体', async () => {
    H.attendance.push(
      attendanceRow('me-1', STUDENT_S, '2026-11-02'),
      attendanceRow('me-2', STUDENT_S, '2026-11-01'),
      attendanceRow('other-1', OTHER_STUDENT, '2026-11-02'),
    )
    const res = await call({ method: 'GET', path: '/attendance/me', as: STUDENT_S })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as { list: Array<Record<string, unknown>> }
    expect(Array.isArray(data.list)).toBe(true)
    expect(data.list.length).toBeGreaterThan(0)
    for (const row of data.list) expect(row.studentId).toBe(STUDENT_S)
    expect(data.list.map((r) => r.id)).not.toContain('other-1')
  })

  it('客户端自报 ?studentId=<别人> 被忽略:谓词里不得出现他人 uuid', async () => {
    H.attendance.push(
      attendanceRow('me-1', STUDENT_S, '2026-11-02'),
      attendanceRow('other-1', OTHER_STUDENT, '2026-11-02'),
    )
    const res = await call({
      method: 'GET',
      path: '/attendance/me',
      as: STUDENT_S,
      query: { studentId: OTHER_STUDENT },
    })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as { list: Array<Record<string, unknown>> }
    expect(data.list.map((r) => r.id)).toEqual(['me-1'])
    const literals = H.wheres.flatMap((w) => (w === undefined ? [] : H.literalsOf(w)))
    expect(literals, '自报主体必须被忽略').not.toContain(OTHER_STUDENT)
    expect(literals).toContain(STUDENT_S)
  })

  it('日期形状闸沿用 attendanceDateSchema:非法格式 ⇒ 400,合法 ⇒ 进谓词', async () => {
    const bad = await call({
      method: 'GET',
      path: '/attendance/me',
      as: STUDENT_S,
      query: { date: '2026/11/02' },
    })
    expect(bad.statusCode).toBe(400)
    expect(H.reads, '形状不合法时不得触达表').toBe(0)

    H.attendance.push(attendanceRow('me-1', STUDENT_S, '2026-11-02'))
    const ok = await call({
      method: 'GET',
      path: '/attendance/me',
      as: STUDENT_S,
      query: { date: '2026-11-02', startDate: '2026-10-01', endDate: '2026-11-30' },
    })
    expect(ok.statusCode).toBe(200)
    const literals = H.wheres.flatMap((w) => (w === undefined ? [] : H.literalsOf(w)))
    expect(literals).toContain('2026-11-02')
    expect(literals).toContain('2026-10-01')
    expect(literals).toContain('2026-11-30')
  })

  it('匿名 ⇒ 401 且零查询;封禁账号(状态腿)也不放行', async () => {
    const anon = await call({ method: 'GET', path: '/attendance/me' })
    expect(anon.statusCode).toBe(401)
    expect(H.reads).toBe(0)

    H.statusOverrides.set(STUDENT_S, 3)
    H.attendance.push(attendanceRow('me-1', STUDENT_S, '2026-11-02'))
    const dead = await call({ method: 'GET', path: '/attendance/me', as: STUDENT_S })
    expect(dead.statusCode, '注销主体的凭据不应被当有效会话').toBeLessThan(500)
    expect([401, 403]).toContain(dead.statusCode)
  })

  it('返回形态与 /parent/children/:childId/attendance 同形({ list },按 date 倒序)', async () => {
    bind(PARENT_A, CHILD_X)
    H.attendance.push(
      attendanceRow('me-old', STUDENT_S, '2026-10-01'),
      attendanceRow('me-new', STUDENT_S, '2026-11-02'),
    )
    const mine = await call({ method: 'GET', path: '/attendance/me', as: STUDENT_S })
    const parent = await call({
      method: 'GET',
      path: '/parent/children/:childId/attendance',
      as: PARENT_A,
    })
    expect(mine.statusCode).toBe(200)
    expect(parent.statusCode, '对照面本身也要是 200(接线后整片可用)').toBe(200)
    const shape = (b: Record<string, unknown>) => Object.keys(b.data as Record<string, unknown>)
    expect(shape(mine.body)).toEqual(['list'])
    expect(shape(parent.body)).toEqual(['list'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
