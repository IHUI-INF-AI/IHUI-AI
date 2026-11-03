// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/skills/:name/unlist 的 admin 授权面回归(2026-09-25 立)。
 *
 * 立因:该端点此前只有 checkAuth(登录即放行),而它做的是 entries.splice(...,1) 的
 * **破坏性硬删** —— 任意登录用户可永久抹掉他人乃至平台内置 skill 的市场条目
 * (installCount / 评分 / 订阅关系一并消失,不可恢复)。代码注释自称"admin 治理动作",
 * 实现里却没有任何 admin 校 —— 注释与实现分叉本身就是下一个事故源。
 * 唯一调用方是 admin 页 apps/web/app/(main)/admin/skills/SkillMarketDialog.tsx,
 * 所以收紧到 admin 不破坏任何正常路径。
 *
 * 四类断言:
 *  1. 未登录 ⇒ 401,且市场**一条都没少**
 *  2. 已登录非 admin ⇒ 403,且市场**一条都没少**(断言副作用没发生,不止状态码)
 *  3. admin ⇒ 200 且条目真的减一(正向对照,防止把功能修死)
 *  4. 顺序 ⇒ 非 admin + 会让 Zod 判 400 的非法 name,必须拿 403(先授权 → 再校参数)
 *
 * 关键取径:真实 authenticate + 真实 requireAdmin 全程在跑,只在最外两个出口打断 ——
 * 令牌验签(@ihui/auth 的 verifyAccessToken,用它注入 roleId 决定 admin 档)与用户状态
 * 查询(getUserStatus)。所以本文件测的是**路由装配本身**,不是自制 mock:把
 * `preHandler: requireAdmin` 摘掉,2/4 两组必红(已由变异取证实测)。
 * 全程 mock redis,不连任何真实 DB / Redis(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  // 缺省非管理员:每个用例显式改写,不靠这里的初值放行
  verifyAccessToken: vi.fn(),
}))
// auth.ts 的 P2-14 加固会查用户状态(status=0 封禁 403 / 3 注销 401),固定回 active
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_CALLBACK_SECRET: '',
  },
}))

import { skillsRoutes } from '../src/routes/skills.js'
import { verifyAccessToken } from '@ihui/auth'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const MARKET_KEY = 'skills-market:global'
/**
 * 真机形状的身份:users.id 是 uuid(packages/database/src/schema/users.ts),
 * 用数字串等于允许写入侧继续 Number() 强转 —— 那正是"归属永久失效"的藏身处。
 */
const CALLER_ID = '7f0f3f2a-1c4b-4a8e-9d21-0a3b5c7e9f01'
const OTHER_OWNER_ID = 'b21c9d47-55ae-4f30-8c72-1e6e0d2a4f02'
const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

/** 只实现市场相关端点用到的 KV,其余路由不参与本回归 */
function createMockRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async () => 1),
    hget: vi.fn(async () => null),
    hdel: vi.fn(async () => 1),
    del: vi.fn(async (k: string) => {
      store.delete(k)
      return 1
    }),
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
 * 五枚种子刻意覆盖三种"曾被任意登录用户可删"的形态:
 * 他人归属 / 他人归属且已下架 / 无归属 legacy / 内置(source=builtin) / 自己的。
 */
const SEED: SkillMarketEntry[] = [
  entry({
    name: 'theirs',
    ownerId: OTHER_OWNER_ID,
    author: 'someone-else',
    source: 'user',
    enabled: true,
  }),
  entry({
    name: 'theirs-hidden',
    ownerId: OTHER_OWNER_ID,
    author: 'someone-else',
    source: 'user',
    enabled: false,
  }),
  entry({ name: 'legacy' }),
  entry({ name: 'builtin-thing', source: 'builtin', enabled: true }),
  entry({ name: 'mine', ownerId: CALLER_ID, author: 'tester', source: 'user', enabled: true }),
]

let server: FastifyInstance
let redis: ReturnType<typeof createMockRedis>

/** 市场条目的当前原始快照 —— 用它证明"一次写都没发生",比只数条数更严 */
function marketSnapshot(): string {
  return redis.store.get(MARKET_KEY) ?? '<市场键缺失>'
}

function marketNames(raw: string): string[] {
  return (JSON.parse(raw) as SkillMarketEntry[]).map((e) => e.name).sort()
}

/** 以某个 roleId 身份发 unlist 请求;roleId=null 表示不带任何凭据(未登录) */
async function unlistAs(roleId: number | null, name: string) {
  if (roleId !== null) {
    vi.mocked(verifyAccessToken).mockResolvedValue({
      userId: CALLER_ID,
      phone: '13800000000',
      familyId: `f-${CALLER_ID}`,
      roleId,
    })
  }
  return server.inject({
    method: 'POST',
    url: `/api/skills/${encodeURIComponent(name)}/unlist`,
    headers: roleId === null ? {} : AUTH_HEADERS,
  })
}

function bodyOf<T>(res: { payload: string }): T {
  return JSON.parse(res.payload) as T
}

beforeAll(async () => {
  redis = createMockRedis()
  server = Fastify({ logger: false })
  server.decorate('redis', redis as never)
  await server.register(skillsRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  redis.store.set(MARKET_KEY, JSON.stringify(SEED))
})

describe('POST /api/skills/:name/unlist —— 破坏性硬删必须只有 admin 能按', () => {
  it('未登录 ⇒ 401,且市场一条都没少', async () => {
    const before = marketSnapshot()

    const res = await unlistAs(null, 'theirs')

    expect(res.statusCode).toBe(401)
    expect(marketSnapshot()).toBe(before)
    expect(marketNames(marketSnapshot())).toEqual(marketNames(before))
  })

  it('已登录但非 admin(roleId=0)⇒ 403,且市场一条都没少(副作用未发生)', async () => {
    const before = marketSnapshot()
    const beforeNames = marketNames(before)

    const res = await unlistAs(0, 'theirs')

    // 关键断言不只是状态码:条目必须一枚不少,连"少了一枚"都不允许
    expect(res.statusCode).toBe(403)
    expect(marketSnapshot()).toBe(before)
    expect(marketNames(marketSnapshot())).toEqual(beforeNames)
    expect(JSON.parse(marketSnapshot()) as SkillMarketEntry[]).toHaveLength(SEED.length)
  })

  it('非 admin 删他人的 / 已下架的 / 无归属的 / 内置的 —— 一律 403 且全部存活', async () => {
    // 内置条目是这里最要命的一类:种子约定"任何人都不能把平台内置技能下架后据为己有",
    // 而 source=builtin 没有 ownerId,按 owner 判根本挡不住 —— 只有 admin 档挡得住。
    for (const name of ['theirs', 'theirs-hidden', 'legacy', 'builtin-thing', 'mine']) {
      const before = marketSnapshot()
      const res = await unlistAs(0, name)
      expect(res.statusCode, `name=${name}`).toBe(403)
      expect(marketSnapshot(), `name=${name} 的条目不得有任何变化`).toBe(before)
    }
  })

  it('正向对照:admin(roleId=1)仍能正常 unlist,条目真的减一', async () => {
    const before = marketSnapshot()

    const res = await unlistAs(1, 'theirs')

    expect(res.statusCode).toBe(200)
    expect(bodyOf<{ data: { name: string; unlisted: boolean } }>(res).data).toEqual({
      name: 'theirs',
      unlisted: true,
    })
    const after = marketSnapshot()
    expect(after).not.toBe(before)
    expect(marketNames(after)).toEqual(['builtin-thing', 'legacy', 'mine', 'theirs-hidden'])
    // 只减目标一枚,其余条目不得被连带改写
    const remaining = JSON.parse(after) as SkillMarketEntry[]
    expect(remaining).toHaveLength(SEED.length - 1)
    const untouched = remaining.find((e) => e.name === 'builtin-thing')
    expect(untouched?.installCount).toBe(7)
    expect(untouched?.rating).toBe(4)
  })

  it('顺序:非 admin + 非法 name(Zod 会判 400)⇒ 必须 403,证明先授权再校参数', async () => {
    // nameParamSchema max 64 ⇒ 80 字符会让 Zod 判失败;取 80 而非 200 是因为
    // Fastify 的 maxParamLength 默认 100,超了会在框架层就 414,那就测不到顺序了。
    const illegalName = 'x'.repeat(80)
    const before = marketSnapshot()

    const forbidden = await unlistAs(0, illegalName)
    expect(forbidden.statusCode).toBe(403)

    // 反向对照:同一个 name 换成 admin 必须是 400 —— 少了这句,本用例可能因为
    // "参数本来就错得离谱"而恒真,测的就不是顺序而是别的。
    const badParam = await unlistAs(1, illegalName)
    expect(badParam.statusCode).toBe(400)
    expect(marketSnapshot()).toBe(before)
  })

  it('admin 删不存在的条目 ⇒ 404 且市场原样不动', async () => {
    const before = marketSnapshot()

    const res = await unlistAs(1, 'not-in-market')

    expect(res.statusCode).toBe(404)
    expect(marketSnapshot()).toBe(before)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
