// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B34 —— POST /user/check-in(签到写型端点)权限成对用例 + 越权用例(2026-11-05 立,**全程不连库**)。
 *
 * 台账口径核正(现读):该端点的实现住在 `apps/api/src/routes/user.ts` 的 `userCheckinRoutes`
 * (落库表为 `sign_in_records`),路由注册前缀 `/api`(routes/index.ts:`server.register(userCheckinRoutes, { prefix: '/api' })`)。
 * 立票前全仓 grep:apps/api/tests 内没有任何用例引用过 `/user/check-in`(既有
 * `g962-b4b-cgroup-route-shape.test.ts` 只注册路由面、EXPECTED 清单不含本端点,不跑行为)。
 *
 * 三把尺子(与同族 edu-attendance-*-authz 件同一形状):
 * 1. **结构锁**(静态读路由源码):处理器体内必须出现 `checkAuth(request, reply)`,
 *    主体一律取 `request.userId`,**不得**出现 `request.body` / `request.query`(入参不含主体 ⇒ 自报无处可达)。
 * 2. **身份纪律**(行为面):客户端在 body 与 query 同时伪造 `userId=<乙>` ⇒ 落库行仍只归甲,
 *    每一个 where 谓词的绑定字面量含甲 uuid、不含乙 uuid(判据不复制:奖励/日界一律 import
 *    `src/utils/checkin-helpers.ts` 源出口,§22c)。
 * 3. **副作用未发生**:匿名 ⇒ 零读零写;重复签到 409 后行集逐字节不变;
 *    甲的任何请求都不得改动乙的行集(前后 JSON 快照逐字节比对)。
 *
 * 身份不走测试侧手写 `request.userId`(那等于绕过承载层自证):桩 `@ihui/auth.verifyAccessToken`
 * + `db/usercenter-queries.getUserStatus`,凭据以真三段式 JWS 形态经 Authorization: Bearer 传入,
 * 其余鉴权链(checkAuth → authenticate)为真。形状抄 tests/edu-attendance-parent-portal-authz.test.ts。
 *
 * 测试隔离铁律(AGENTS §5):不连 PG 8810 / Redis 8811;DATABASE_URL 只是占位字面量,
 * REDIS_URL 指向 6379(本机无监听 ⇒ FAST_FAIL 选项下快速失败并按设计放行),不碰生产 8811。
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
    /** 世界状态:签到行集(sign_in_records 的假库投影) */
    signIns: [] as Array<Record<string, unknown>>,
    /** 第 n 次 db.select() 的返回行集 */
    results: [] as unknown[],
    /** 第 n 次 db.select() 实际收到的 where() 条件对象(归属判据的唯一可读面) */
    wheres: [] as unknown[],
    /** db.select() 调用次数 */
    reads: 0,
    /** 写侧调用记账(insert/update/delete…) */
    writes: [] as string[],
    /** 每次 insert().values(...) 捕获的入参原样(归属断言的直接证据面) */
    insertValues: [] as Array<Record<string, unknown>>,
    /** 落库行自增主键计数 */
    seq: 0,
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
    // 必须带合法 db 段:非数字段会让 ioredis 发 SELECT NaN 成为 unhandled rejection。
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/**
 * db 链式桩:select 的返回行集由这条 where 绑定的字面值对世界状态求值得到;
 * insert 把 values 落进世界状态并记账(「副作用是否发生」的可证面)。本文件不建任何真连接。
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
    'values',
    'set',
    'returning',
    'onConflictDoNothing',
    'onConflictDoUpdate',
  ] as const

  /** 谓词解答器:签到行按 (userId, signInDate) 两个绑定字面值同时命中才回。 */
  const rowsFor = (predicate: unknown): unknown[] => {
    const lits = H.literalsOf(predicate)
    return H.signIns.filter(
      (r) => lits.includes(String(r.userId)) && lits.includes(String(r.signInDate)),
    )
  }

  const makeReadChain = () => {
    const slot = H.reads
    H.reads += 1
    H.results[slot] = H.results[slot] ?? []
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

  const makeInsertChain = () => {
    H.writes.push('insert')
    const applied: Array<Record<string, unknown>> = []
    const step: Record<string, unknown> = {}
    step.values = vi.fn((v: unknown) => {
      const rows = (Array.isArray(v) ? v : [v]) as Array<Record<string, unknown>>
      for (const r of rows) {
        H.seq += 1
        const row = { id: `sr-${H.seq}`, ...r }
        H.signIns.push(row)
        applied.push(row)
        H.insertValues.push(r)
      }
      return step
    })
    for (const m of ['returning', 'onConflictDoNothing', 'onConflictDoUpdate'] as const) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(applied).then(resolve, reject)
    return step
  }

  const writeChain = (kind: string) => {
    H.writes.push(kind)
    return makeReadChain()
  }

  return {
    db: {
      select: vi.fn(() => makeReadChain()),
      insert: vi.fn(() => makeInsertChain()),
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
    dbRead: { select: vi.fn(() => makeReadChain()) },
    dbClient: {},
    dbWriter: { select: vi.fn(() => makeReadChain()) },
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  setFastify: vi.fn(),
  serializeErrorFields: vi.fn((m: unknown) => m),
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

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

import { userCheckinRoutes } from '../src/routes/user.js'
// 判据单一真相源(§22c):奖励档位与日界算法一律 import 源出口,测试内禁止第二份手抄。
import { calcSignInReward, shiftDate, todayString } from '../src/utils/checkin-helpers.js'

const PREFIX = '/api'
const ROUTE_FILE = new URL('../src/routes/user.ts', import.meta.url)

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** 造一条真三段式 JWS(验签桩用同一份 sigOf 核对)。 */
function accessToken(userId: string, extraClaims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ userId, type: 'access', ...extraClaims })
  return `${head}.${body}.${H.sigOf(`${head}.${body}`)}`
}

function toHttpError(err: unknown): { statusCode: number; message: string } {
  if (err instanceof Error) {
    const statusCode =
      'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500
    return { statusCode, message: err.message }
  }
  return { statusCode: 500, message: String(err) }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  app.setErrorHandler((err: unknown, _request, reply) => {
    const { statusCode, message } = toHttpError(err)
    reply.status(statusCode).send({ code: statusCode, message })
  })
  await app.register(userCheckinRoutes, { prefix: PREFIX })
  await app.ready()
  return app
}

interface Call {
  method: 'GET' | 'POST'
  path: string
  /** 登录主体:发真凭据,由真鉴权链注入 request.userId;不传 = 匿名 */
  as?: string
  query?: Record<string, string>
  body?: Record<string, unknown>
}

async function call(o: Call): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await buildApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({
    method: o.method,
    url: `${PREFIX}${o.path}${qs}`,
    headers,
    payload: o.body,
  })
  await app.close()
  return { statusCode: res.statusCode, body: (res.json() ?? {}) as Record<string, unknown> }
}

/** 世界状态里某个用户的行集快照(逐字节,用于「未发生副作用」比对)。 */
const snapshotOf = (userId: string): string =>
  JSON.stringify(H.signIns.filter((r) => r.userId === userId))

/** 全部 where 谓词的绑定字面量池。 */
const allLiterals = (): string[] =>
  H.wheres.filter((w) => w !== undefined).flatMap((w) => H.literalsOf(w))

const seedRow = (
  userId: string,
  signInDate: string,
  consecutiveDays: number,
): Record<string, unknown> => {
  const row: Record<string, unknown> = {
    id: `sr-seed-${H.seq++}`,
    userId,
    signInDate,
    consecutiveDays,
    rewardPoints: calcSignInReward(consecutiveDays),
  }
  H.signIns.push(row)
  return row
}

beforeEach(() => {
  H.signIns.length = 0
  H.results.length = 0
  H.wheres.length = 0
  H.reads = 0
  H.writes.length = 0
  H.insertValues.length = 0
  H.seq = 0
  H.statusOverrides.clear()
})

describe('结构锁:POST /user/check-in 的主体只由承载层显式传入', () => {
  it('处理器体内有 checkAuth 接线、取 request.userId,且不读 request.body / request.query', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8').split('\n')
    const routeRe = /^\s*server\.(get|post|put|delete|patch)\('([^']+)'/
    const starts: Array<{ idx: number; method: string; path: string }> = []
    for (let i = 0; i < src.length; i += 1) {
      const m = routeRe.exec(src[i]!)
      if (m) starts.push({ idx: i, method: m[1]!.toUpperCase(), path: m[2]! })
    }
    const hit = starts.filter((s) => s.method === 'POST' && s.path === '/user/check-in')
    expect(hit, 'POST /user/check-in 路由注册必须恰命中 1 条').toHaveLength(1)
    const next = starts.find((s) => s.idx > hit[0]!.idx)
    const body = src.slice(hit[0]!.idx, next ? next.idx : src.length).join('\n')
    expect(body).toMatch(/checkAuth\(\s*request\s*,\s*reply\s*\)/)
    expect(body).toMatch(/request\.userId/)
    // 入参不含主体:客户端自报的 userId/studentId 在源码结构上就无路可达。
    expect(body, '主体不得来自 request.body').not.toMatch(/request\.body/)
    expect(body, '主体不得来自 request.query').not.toMatch(/request\.query/)
  })
})

describe('行为成对:匿名拒绝面 ↔ 登录正向面', () => {
  it('匿名 POST ⇒ 401,且零读零写(副作用未发生)', async () => {
    const res = await call({ method: 'POST', path: '/user/check-in' })
    expect(res.statusCode).toBe(401)
    expect(H.reads, '匿名必须在任何查询之前终止').toBe(0)
    expect(H.writes, '匿名不得有任何写副作用').toEqual([])
    expect(H.signIns, '匿名不得落任何行').toEqual([])
  })

  it('登录主体本人签到 ⇒ 201,落库行只归本人,奖励取源判据 calcSignInReward', async () => {
    const res = await call({ method: 'POST', path: '/user/check-in', as: USER_A })
    expect(res.statusCode).toBe(201)
    const data = res.body.data as Record<string, unknown>
    const record = data.record as Record<string, unknown>
    expect(record.userId).toBe(USER_A)
    expect(record.signInDate).toBe(todayString())
    expect(data.consecutiveDays).toBe(1)
    expect(data.rewardPoints).toBe(calcSignInReward(1))
    expect(H.insertValues).toHaveLength(1)
    expect(H.insertValues[0]!.userId).toBe(USER_A)
    expect(H.signIns.filter((r) => r.userId === USER_A)).toHaveLength(1)
    expect(H.signIns.filter((r) => r.userId === USER_B)).toHaveLength(0)
  })
})

describe('越权用例:甲不得替乙签到(body 与 query 双路自报全部被忽略)', () => {
  it('伪造 userId=乙 ⇒ 新行归甲;乙的行集逐字节未变;连续天数不得从他人记录反推', async () => {
    // 乙昨天已连续 5 天 —— 若处理器"从记录反推主体"或采信自报 userId,
    // 甲这一笔会写成 consecutiveDays=6(甚至直接落到乙名下)。
    seedRow(USER_B, shiftDate(todayString(), -1), 5)
    seedRow(USER_A, shiftDate(todayString(), -1), 2)
    const beforeB = snapshotOf(USER_B)
    const beforeAll = H.signIns.length

    const res = await call({
      method: 'POST',
      path: '/user/check-in',
      as: USER_A,
      query: { userId: USER_B, studentId: USER_B },
      body: { userId: USER_B, studentId: USER_B },
    })
    expect(res.statusCode).toBe(201)
    const data = res.body.data as Record<string, unknown>
    const record = data.record as Record<string, unknown>
    // 新行归甲,且连续天数只由甲自己的昨天行(2→3)推得,不沾乙的 5。
    expect(record.userId).toBe(USER_A)
    expect(data.consecutiveDays).toBe(3)
    expect(data.rewardPoints).toBe(calcSignInReward(3))
    // 每一个查询谓词绑定的都是甲,乙的 uuid 从未出现在任何 where 里。
    const lits = allLiterals()
    expect(lits).toContain(USER_A)
    expect(lits, '归属外的主体不得进入任何查询谓词').not.toContain(USER_B)
    // 副作用范围收敛:全局只多出甲这一行;乙的行集逐字节不变。
    expect(H.signIns).toHaveLength(beforeAll + 1)
    expect(snapshotOf(USER_B), '乙的签到行集必须逐字节未变').toBe(beforeB)
  })

  it('同一主体当日重复 POST ⇒ 409,行集逐字节不变(第二次写没有发生)', async () => {
    seedRow(USER_A, todayString(), 1)
    const before = JSON.stringify(H.signIns)
    const writesBefore = H.writes.length
    const res = await call({ method: 'POST', path: '/user/check-in', as: USER_A })
    expect(res.statusCode).toBe(409)
    expect(JSON.stringify(H.signIns), '409 之后行集必须逐字节不变').toBe(before)
    expect(H.writes, '409 分支不得触发任何新写').toHaveLength(writesBefore)
    expect(H.insertValues, '409 分支不得有新的 values 入参').toHaveLength(0)
  })

  it('封禁主体(状态腿)⇒ 拒绝且零副作用', async () => {
    H.statusOverrides.set(USER_A, 0)
    const res = await call({ method: 'POST', path: '/user/check-in', as: USER_A })
    expect(res.statusCode).toBe(403)
    expect(H.writes, '账号被拒不得有任何写副作用').toEqual([])
    expect(H.signIns).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
