// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B35 —— GET /user/check-in/status(签到状态只读端点)权限成对用例 + 越权用例(2026-11-05 立,**全程不连库**)。
 *
 * 台账口径核正(现读):该端点的实现住在 `apps/api/src/routes/user.ts` 的 `userCheckinRoutes`,
 * 读 `sign_in_records`,注册前缀 `/api`。立票前全仓 grep:apps/api/tests 内没有任何用例
 * 引用过 `/user/check-in/status`(既有 shape 件不跑行为)。
 *
 * 两把尺子(与同族 edu-attendance-*-authz 件同一形状):
 * 1. **结构锁**(静态读路由源码):处理器体内必须出现 `checkAuth(request, reply)`,
 *    主体一律取 `request.userId`,**不得**出现 `request.body` / `request.query`
 *    (查询串里没有主体位 ⇒ 自报无处可达)。
 * 2. **行为成对 + 越权**:匿名 ⇒ 401 且零读;正向按世界状态回本人三态
 *    (signedIn / consecutiveDays / todayReward),奖励判据一律 import
 *    `src/utils/checkin-helpers.ts` 的 `calcSignInReward` 源出口(§22c,测试内不抄档位表);
 *    query 伪造 `userId=乙` 被忽略 —— 谓词字面量池含甲不含乙,乙的行集逐字节未变,
 *    且本端点全程零写(insert/update/delete 一次都不许出现)。
 *
 * 身份不走测试侧手写 `request.userId`:桩 `@ihui/auth.verifyAccessToken` +
 * `db/usercenter-queries.getUserStatus`,真三段式 JWS 经 Authorization: Bearer 传入,
 * 其余鉴权链为真。形状抄 tests/edu-attendance-parent-portal-authz.test.ts。
 *
 * 测试隔离铁律(AGENTS §5):不连 PG 8810 / Redis 8811;REDIS_URL 指 6379(无监听,
 * FAST_FAIL 快速失败按设计放行),DATABASE_URL 只是占位字面量。
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/** 夹具账本(hoisted:vi.mock 工厂要在模块求值前拿到它)。每轮用例前清零。 */
const H = vi.hoisted(() => {
  // 测试侧"签名":FNV-1a 摘要,把凭据内容(header+payload)绑进签名段。
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
    results: [] as unknown[],
    wheres: [] as unknown[],
    reads: 0,
    /** 写侧调用记账 —— 只读端点的越权用例必须让它恒空 */
    writes: [] as string[],
    seq: 0,
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
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/** db 链式桩:select 行集由 where 绑定字面值对世界状态求值;写侧一律记账(供零写断言)。 */
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

  const rowsFor = (predicate: unknown): unknown[] => {
    const lits = H.literalsOf(predicate)
    return H.signIns.filter(
      (r) => lits.includes(String(r.userId)) && lits.includes(String(r.signInDate)),
    )
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
// 判据单一真相源(§22c):今日键/昨日偏移/奖励档位一律 import 源出口,测试内不抄第二份。
import { calcSignInReward, shiftDate, todayString } from '../src/utils/checkin-helpers.js'

const PREFIX = '/api'
const ROUTE_FILE = new URL('../src/routes/user.ts', import.meta.url)

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

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

async function call(o: {
  as?: string
  query?: Record<string, string>
}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const app = await buildApp()
  const headers: Record<string, string> = {}
  if (o.as) headers.authorization = `Bearer ${accessToken(o.as)}`
  const qs = o.query ? `?${new URLSearchParams(o.query).toString()}` : ''
  const res = await app.inject({
    method: 'GET',
    url: `${PREFIX}/user/check-in/status${qs}`,
    headers,
  })
  await app.close()
  return { statusCode: res.statusCode, body: (res.json() ?? {}) as Record<string, unknown> }
}

const snapshotOf = (userId: string): string =>
  JSON.stringify(H.signIns.filter((r) => r.userId === userId))

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
  H.seq = 0
  H.statusOverrides.clear()
})

describe('结构锁:GET /user/check-in/status 的主体只由承载层显式传入', () => {
  it('处理器体内有 checkAuth 接线、取 request.userId,且不读 request.body / request.query', () => {
    const src = readFileSync(ROUTE_FILE, 'utf8').split('\n')
    const routeRe = /^\s*server\.(get|post|put|delete|patch)\('([^']+)'/
    const starts: Array<{ idx: number; method: string; path: string }> = []
    for (let i = 0; i < src.length; i += 1) {
      const m = routeRe.exec(src[i]!)
      if (m) starts.push({ idx: i, method: m[1]!.toUpperCase(), path: m[2]! })
    }
    const hit = starts.filter((s) => s.method === 'GET' && s.path === '/user/check-in/status')
    expect(hit, 'GET /user/check-in/status 路由注册必须恰命中 1 条').toHaveLength(1)
    const next = starts.find((s) => s.idx > hit[0]!.idx)
    const body = src.slice(hit[0]!.idx, next ? next.idx : src.length).join('\n')
    expect(body).toMatch(/checkAuth\(\s*request\s*,\s*reply\s*\)/)
    expect(body).toMatch(/request\.userId/)
    expect(body, '主体不得来自 request.body').not.toMatch(/request\.body/)
    expect(body, '主体不得来自 request.query').not.toMatch(/request\.query/)
  })
})

describe('行为成对:匿名拒绝面 ↔ 登录正向面(三态各一枚)', () => {
  it('匿名 GET ⇒ 401,且零读零写(副作用未发生)', async () => {
    const res = await call({})
    expect(res.statusCode).toBe(401)
    expect(H.reads, '匿名必须在任何查询之前终止').toBe(0)
    expect(H.writes).toEqual([])
  })

  it('本人当日已签 ⇒ 200 signedIn=true,读数取本人行,reward 即该行 rewardPoints', async () => {
    const row = seedRow(USER_A, todayString(), 3)
    const res = await call({ as: USER_A })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.signedIn).toBe(true)
    expect(data.consecutiveDays).toBe(3)
    expect(data.todayReward).toBe(row.rewardPoints)
    expect(H.reads, '当日已签时不应再查昨日行').toBe(1)
    expect(H.writes, '只读端点全程零写').toEqual([])
  })

  it('当日未签但昨日已签 ⇒ signedIn=false,连续天数沿昨日,reward=calcSignInReward(n+1)(源判据)', async () => {
    seedRow(USER_A, shiftDate(todayString(), -1), 2)
    const res = await call({ as: USER_A })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.signedIn).toBe(false)
    expect(data.consecutiveDays).toBe(2)
    expect(data.todayReward).toBe(calcSignInReward(3))
    expect(H.writes).toEqual([])
  })

  it('从未签过 ⇒ signedIn=false、连续 0、reward=calcSignInReward(1)(源判据)', async () => {
    const res = await call({ as: USER_A })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as Record<string, unknown>
    expect(data.signedIn).toBe(false)
    expect(data.consecutiveDays).toBe(0)
    expect(data.todayReward).toBe(calcSignInReward(1))
  })
})

describe('越权用例:query 自报 userId=乙 被忽略,只回甲自己的状态', () => {
  it('乙当日已签、甲未签 ⇒ 响应仍是甲的 signedIn=false;谓词不含乙;乙的行集逐字节未变;全程零写', async () => {
    seedRow(USER_B, todayString(), 9)
    const beforeB = snapshotOf(USER_B)
    const beforeAll = JSON.stringify(H.signIns)

    const res = await call({ as: USER_A, query: { userId: USER_B, studentId: USER_B } })
    expect(res.statusCode).toBe(200)
    const data = res.body.data as Record<string, unknown>
    // 若处理器采信自报主体,这里会翻成 true / 9 —— 必须不是。
    expect(data.signedIn).toBe(false)
    expect(data.consecutiveDays).toBe(0)
    const lits = allLiterals()
    expect(lits).toContain(USER_A)
    expect(lits, '归属外的主体不得进入任何查询谓词').not.toContain(USER_B)
    expect(H.writes, '只读端点不得有任何写副作用').toEqual([])
    expect(snapshotOf(USER_B), '乙的签到行集必须逐字节未变').toBe(beforeB)
    expect(JSON.stringify(H.signIns)).toBe(beforeAll)
  })

  it('封禁主体(状态腿)⇒ 403 且零读零写', async () => {
    H.statusOverrides.set(USER_A, 0)
    const res = await call({ as: USER_A })
    expect(res.statusCode).toBe(403)
    expect(H.reads).toBe(0)
    expect(H.writes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
