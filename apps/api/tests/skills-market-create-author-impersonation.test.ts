// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/skills/market **新建路径**的作者身份冒充回归(2026-09-25 立)。
 *
 * 立因:同日 P0 修复(commit b48acaae0 附近)把"认领/改写他人条目"那条路堵死了
 * (mayWriteMarketEntry 只看服务端身份 + 条目上已存的 ownerId,409 也移到授权之后),
 * 但**刻意没动 create 面**,留下的缺口是:
 *   任意登录用户把 author 填成 'IHUI'(内置种子作者名,MARKET_SEED_RAW 里公开可猜)
 *   ⇒ 以后缀"这是官方发布的"身份**新建**一个市场条目。
 *
 * 修法两条,缺一不可:
 *  1. **服务端推导**:source='user' 条目的 author 取调用者自己的 users 行
 *     (nickname 优先、退回 username),请求体自报值不进条目;内部通道仍可写任意 author。
 *  2. **冒充闸**:非内部通道新建时,自报 author 命中「内置作者名 ∪ 他人已归属条目在用
 *     的作者名」⇒ 403 且零副作用(闸在写动作之前,也先于 Zod)。
 *
 * 取径照 apps/api/tests/skills-market-publish-ownership.test.ts:真实 authenticate +
 * 真实授权判定全程在跑,只在最外两个出口打断(令牌验签注入 roleId 档位、用户状态)。
 * 与那个文件的唯一差别:本文件把 `db.execute` 做成**可控夹具**,因为要验的正是"users 行
 * → author"这条推导链;市场条目数据仍全在 redis mock 里。全程不连任何真实 DB / Redis
 * (AGENTS §5 测试隔离铁律)。
 *
 * 每条"拒答"用例都必须同时成立:状态码 · 整个 redis 状态指纹字节相等 · 一次 set 都没有
 * · 条目总数不变。只断状态码不算数。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { INTERNAL_SECRET } = vi.hoisted(() => ({
  INTERNAL_SECRET: 'internal-self-evolution-secret',
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
// 本文件的核心夹具:users 行由每个用例显式设定(默认查不到行 ⇒ 走兜底路径)
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_CALLBACK_SECRET: INTERNAL_SECRET,
  },
}))

import { skillsRoutes } from '../src/routes/skills.js'
import { verifyAccessToken } from '@ihui/auth'
import { db } from '../src/db/index.js'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const MARKET_KEY = 'skills-market:global'
/** 身份一律用真机形状(uuid):数字串会让 Number() 强转与存原文两种实现同样通过 */
const PUBLISHER_ID = '7f0f3f2a-1c4b-4a8e-9d21-0a3b5c7e9f01'
const OTHER_OWNER_ID = 'b21c9d47-55ae-4f30-8c72-1e6e0d2a4f02'
const ADMIN_ID = 'e5a1b7c3-0d94-4e6f-8b2a-6f1c3d5a7b03'

/** 与 MARKET_SEED_RAW 同名的内置作者名 —— 判据 1 与 2 的靶子(清单不在此另抄一份) */
const BUILTIN_AUTHOR = 'IHUI'

interface Envelope {
  code: number
  message?: string
  data?: SkillMarketEntry
}

function createMockRedis() {
  const store = new Map<string, string>()
  const sets = new Map<string, Set<string>>()
  const lists = new Map<string, string[]>()
  return {
    store,
    sets,
    lists,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async () => 1),
    hget: vi.fn(async () => null),
    hdel: vi.fn(async () => 1),
    sadd: vi.fn(async (k: string, ...members: string[]) => {
      if (!sets.has(k)) sets.set(k, new Set())
      const s = sets.get(k)!
      for (const m of members) s.add(m)
      return members.length
    }),
    srem: vi.fn(async (k: string, ...members: string[]) => {
      const s = sets.get(k)
      if (!s) return 0
      let n = 0
      for (const m of members) if (s.delete(m)) n++
      return n
    }),
    sismember: vi.fn(async (k: string, m: string) => (sets.get(k)?.has(m) ? 1 : 0)),
    smembers: vi.fn(async (k: string) => Array.from(sets.get(k) ?? [])),
    lpush: vi.fn(async (k: string, v: string) => {
      const arr = lists.get(k) ?? []
      arr.unshift(v)
      lists.set(k, arr)
      return arr.length
    }),
    lrange: vi.fn(async (k: string, start: number, end: number) => {
      const arr = lists.get(k) ?? []
      const len = arr.length
      const s = start < 0 ? Math.max(len + start, 0) : start
      const e = end < 0 ? len + end + 1 : end + 1
      return arr.slice(s, e)
    }),
    del: vi.fn(async (k: string) => {
      const had = store.has(k) || lists.has(k) || sets.has(k)
      store.delete(k)
      lists.delete(k)
      sets.delete(k)
      return had ? 1 : 0
    }),
    expire: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  }
}

function entry(over: Partial<SkillMarketEntry> & { name: string }): SkillMarketEntry {
  return {
    description: `${over.name} 的描述`,
    tags: ['t'],
    author: 'tester',
    version: '1.0.0',
    license: 'MIT',
    installCount: 7,
    rating: 4,
    ratingCount: 2,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}

/**
 * 种子:内置(builtin,无 ownerId)+ 内部同步(hub)+ 他人已归属条目(ownerId=202,
 * 作者名 'someone-else')+ 调用者自己的条目(mine)。
 * 'theirs' 存在的意义 = 让"他人已在用的作者名"这一判据分支可达且有靶子。
 */
const SEED: SkillMarketEntry[] = [
  entry({ name: 'content_engine', author: BUILTIN_AUTHOR, source: 'builtin', version: '1.2.0' }),
  entry({ name: 'hub-sync', author: BUILTIN_AUTHOR, source: 'hub', version: '3.0.0' }),
  entry({
    name: 'theirs',
    author: 'someone-else',
    ownerId: OTHER_OWNER_ID,
    source: 'user',
    enabled: true,
  }),
  entry({ name: 'mine', author: 'tester', ownerId: PUBLISHER_ID, source: 'user', enabled: true }),
]

let server: FastifyInstance
let redis: ReturnType<typeof createMockRedis>

function fingerprint(): string {
  return JSON.stringify({
    kv: [...redis.store.entries()].sort(),
    sets: [...redis.sets.entries()].map(([k, v]) => [k, [...v].sort()] as const).sort(),
    lists: [...redis.lists.entries()].sort(),
  })
}

function market(): SkillMarketEntry[] {
  return JSON.parse(redis.store.get(MARKET_KEY) ?? '[]') as SkillMarketEntry[]
}

function entryByName(entries: SkillMarketEntry[], name: string): SkillMarketEntry {
  const found = entries.find((e) => e.name === name)
  if (!found) throw new Error(`条目 ${name} 不见了 —— 这本身就是副作用`)
  return found
}

/** 设定 users 行返回什么(dbb.execute 的返回值);传 null 表示"查不到行" */
function stubUsersRow(row: { nickname?: string | null; username?: string | null } | null): void {
  vi.mocked(db.execute).mockResolvedValue(row === null ? undefined : ([row] as never))
}

interface As {
  userId: string | null
  roleId?: number
  secret?: string
}

async function publishAs(
  who: As,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; body: Envelope }> {
  const headers: Record<string, string> = {}
  if (who.userId !== null) {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: who.userId,
      phone: '13800000000',
      familyId: `f-${who.userId}`,
      roleId: who.roleId ?? 0,
    })
    headers.authorization = 'Bearer mock-access-token'
  }
  if (who.secret !== undefined) headers['x-internal-secret'] = who.secret

  const res = await server.inject({ method: 'POST', url: '/api/skills/market', headers, payload })
  return { statusCode: res.statusCode, body: res.json() as unknown as Envelope }
}

function publishBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'brand-new',
    description: '我自己写的技能',
    tags: ['code'],
    author: BUILTIN_AUTHOR,
    version: '1.0.0',
    license: 'MIT',
    content: '# body',
    ...over,
  }
}

/** 拒答核验:整个 redis 状态指纹字节相等 + 一次 set 都没有 + 条目数不变。
 *  "该 name 不该出现在市场里"只在**它原本不在**时才成立(新建路径);更新路径的靶子
 *  本来就是既有条目,套同一条断言测的就不是"没写进去"而是"条目被删了"。 */
async function attackAndAssertRejected(
  who: As,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; code: number }> {
  const before = fingerprint()
  const countBefore = market().length
  const targetName = String(payload['name'])
  const existedBefore = market().some((e) => e.name === targetName)

  const res = await publishAs(who, payload)

  expect(res.statusCode).toBe(403)
  expect(res.body.code).toBe(403)
  expect(fingerprint()).toBe(before)
  expect(redis.set).not.toHaveBeenCalled()
  expect(market().length).toBe(countBefore)
  if (!existedBefore) {
    // 新建被拒 ⇒ 连那个 name 都不该出现在市场里
    expect(market().some((e) => e.name === targetName)).toBe(false)
  }
  return { statusCode: res.statusCode, code: res.body.code }
}

beforeAll(async () => {
  redis = createMockRedis()
  server = Fastify({ logger: false })
  server.decorate('redis', redis as never)
  await server.register(skillsRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  redis.store.clear()
  redis.sets.clear()
  redis.lists.clear()
  redis.store.set(MARKET_KEY, JSON.stringify(SEED))
  vi.clearAllMocks()
  // 默认:users 行查得到且有昵称(绝大多数用例走"服务端推导成功"这条真实生产形态)
  stubUsersRow({ nickname: '张三', username: 'zhangsan' })
})

describe('POST /api/skills/market 新建面 —— 自报 author 不再构成身份', () => {
  it('攻击复现:普通用户以 author="IHUI" 新建 ⇒ 403 且 redis 未被写、条目数不变', async () => {
    await attackAndAssertRejected({ userId: PUBLISHER_ID }, publishBody())
  })

  it('换一个内置作者名同样被拒(OpenSource / DesignTools 都在种子清单里)', async () => {
    await attackAndAssertRejected(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'new-1', author: 'OpenSource' }),
    )
    await attackAndAssertRejected(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'new-2', author: 'DesignTools' }),
    )
  })

  it('他人已归属条目在用的作者名同样被拒 ⇒ 不能把别人的身份占成新条目', async () => {
    await attackAndAssertRejected(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'new-3', author: 'someone-else' }),
    )
  })

  it('users 行查不到(兜底路径)时仍然拒 —— 判据不退化成"采信自报"', async () => {
    stubUsersRow(null)
    await attackAndAssertRejected({ userId: PUBLISHER_ID }, publishBody())
  })

  it('顺序:攻击 + 会让 Zod 判 400 的坏 description ⇒ 必须 403(授权先于校参数)', async () => {
    const before = fingerprint()
    const res = await publishAs({ userId: PUBLISHER_ID }, publishBody({ description: '' }))
    expect(res.statusCode).toBe(403)
    expect(fingerprint()).toBe(before)
    expect(redis.set).not.toHaveBeenCalled()
  })

  it('管理员经 JWT 上架也不是平台身份:author="IHUI" 同样 403', async () => {
    await attackAndAssertRejected(
      { userId: ADMIN_ID, roleId: 1 },
      publishBody({ name: 'admin-new' }),
    )
  })
})

describe('POST /api/skills/market 新建面 —— 两条合法路径没被修死', () => {
  it('正向:普通用户以自己身份上架 ⇒ 201,且条目 author 是服务端推导值而非自报值', async () => {
    stubUsersRow({ nickname: '李四', username: 'lisi' })
    const res = await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'my-own-skill', author: '随便写的名字' }),
    )
    expect(res.statusCode).toBe(201)
    const created = entryByName(market(), 'my-own-skill')
    expect(created.author).toBe('李四')
    expect(created.author).not.toBe('随便写的名字')
    expect(created.source).toBe('user')
    expect(created.ownerId).toBe(PUBLISHER_ID)
    expect(created.enabled).toBe(true)
    expect(redis.set).toHaveBeenCalled()
  })

  it('正向:nickname 为空时退回 username(仍是服务端推导,不吃自报值)', async () => {
    stubUsersRow({ nickname: '   ', username: 'wangwu' })
    const res = await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'fallback-username', author: 'ignored-by-server' }),
    )
    expect(res.statusCode).toBe(201)
    expect(entryByName(market(), 'fallback-username').author).toBe('wangwu')
  })

  it('正向:users 行取不到显示名 ⇒ 201 不阻断上架,非内置的自报值仍可用作 author', async () => {
    stubUsersRow({ nickname: null, username: null })
    const res = await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'no-display-name', author: '自填的名字' }),
    )
    expect(res.statusCode).toBe(201)
    expect(entryByName(market(), 'no-display-name').author).toBe('自填的名字')
    expect(entryByName(market(), 'no-display-name').source).toBe('user')
  })

  it('正向:自己已有的作者名可以再用(同一人第二次上架不被"他人已有"误伤)', async () => {
    stubUsersRow({ nickname: null, username: null })
    const first = await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'my-first', author: 'same-name' }),
    )
    expect(first.statusCode).toBe(201)
    const second = await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'my-second', author: 'same-name' }),
    )
    expect(second.statusCode).toBe(201)
    expect(entryByName(market(), 'my-second').author).toBe('same-name')
  })

  it('正向:内部自进化通道仍可写 hub 条目与任意 author ⇒ 201 且 author 原样', async () => {
    const res = await publishAs(
      { userId: null, secret: INTERNAL_SECRET },
      publishBody({ name: 'hub-new', author: BUILTIN_AUTHOR }),
    )
    expect(res.statusCode).toBe(201)
    const created = entryByName(market(), 'hub-new')
    expect(created.author).toBe(BUILTIN_AUTHOR)
    expect(created.source).toBe('hub')
    expect(created.ownerId).toBeUndefined()
  })

  it('正向:更新他人条目仍是 403(今天 P0 那道闸没被本票绕过)', async () => {
    await attackAndAssertRejected(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'theirs', author: 'someone-else', version: '9.9.9' }),
    )
  })

  it('正向:内置条目本身没被动过(种子隔离与 author 都保持原值)', async () => {
    const before = entryByName(market(), 'content_engine')
    await attackAndAssertRejected({ userId: PUBLISHER_ID }, publishBody())
    const after = entryByName(market(), 'content_engine')
    expect(after).toEqual(before)
    expect(after.author).toBe(BUILTIN_AUTHOR)
    expect(after.source).toBe('builtin')
    expect(after.ownerId).toBeUndefined()
  })
})

describe('POST /api/skills/market 新建面 —— 推导链本身在跑(不是恒放行)', () => {
  it('users 表确实被按调用者 id 查过:execute 的 SQL 含 nickname/username 且带参数', async () => {
    stubUsersRow({ nickname: '赵六', username: 'zhaoliu' })
    await publishAs(
      { userId: PUBLISHER_ID },
      publishBody({ name: 'query-probe', author: 'whatever' }),
    )
    const calls = vi.mocked(db.execute).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const fragment = JSON.stringify(calls[0]?.[0] ?? '')
    expect(fragment).toContain('nickname')
    expect(fragment).toContain('username')
    expect(fragment).toContain('users')
  })

  it('内部通道不查 users 表(它写 hub 传来的 author,推导链只挂 JWT 档)', async () => {
    await publishAs(
      { userId: null, secret: INTERNAL_SECRET },
      publishBody({ name: 'hub-no-query', author: 'anything' }),
    )
    expect(db.execute).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
