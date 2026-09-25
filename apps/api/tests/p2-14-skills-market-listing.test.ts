// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P2-14 技能市场:listing 级上下架 + owner 判定 回归(2026-09-25 立)。
 *
 * 覆盖三件此前不存在的能力:
 *  1. GET  /api/skills/market       —— enabled === false 的条目对非 owner 隐身,owner 自己仍可见
 *  2. POST /api/skills/:name/listing —— 上下架切换,owner 判定在服务端按 userId 校
 *  3. GET  /api/skills/:name/ownership —— owner 判定查询
 *
 * 全程 mock redis + mock checkAuth,不连任何真实 DB / Redis(§5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockCheckAuth } = vi.hoisted(() => ({ mockCheckAuth: vi.fn() }))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-vitest-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_CALLBACK_SECRET: '',
  },
}))

vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))

import { skillsRoutes } from '../src/routes/skills.js'
import type { SkillMarketEntry } from '@ihui/shared/skills/market'

const MARKET_KEY = 'skills-market:global'
const OWNER_ID = '101'
const OTHER_ID = '303'

/** 只实现市场相关端点用到的 KV 两个方法,其余路由不参与本回归 */
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
  }
}

function entry(over: Partial<SkillMarketEntry> & { name: string }): SkillMarketEntry {
  return {
    description: `${over.name} 的描述`,
    tags: ['t'],
    author: 'tester',
    version: '1.0.0',
    license: 'MIT',
    installCount: 0,
    rating: 0,
    ratingCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}

/** 四种形态各一枚:有归属在架 / 他人归属在架 / 无归属历史条目 / 有归属但已下架 */
const SEED: SkillMarketEntry[] = [
  entry({ name: 'mine', ownerId: 101, source: 'user', enabled: true }),
  entry({ name: 'theirs', ownerId: 202, source: 'user', enabled: true }),
  entry({ name: 'legacy' }),
  entry({ name: 'mine-hidden', ownerId: 101, source: 'user', enabled: false }),
  entry({ name: 'builtin-thing', source: 'builtin', enabled: true }),
]

let server: FastifyInstance
let redis: ReturnType<typeof createMockRedis>

/** 以某个 userId 身份发请求(null = 未登录,checkAuth 直接拒) */
async function as(
  userId: string | null,
  url: string,
  init?: { method?: 'GET' | 'POST'; payload?: unknown },
) {
  mockCheckAuth.mockImplementation(
    async (
      request: { userId?: string },
      reply: { status: (n: number) => { send: (b: unknown) => unknown } },
    ) => {
      if (userId === null) {
        reply.status(401).send({ code: 401, message: '未登录', data: null })
        return false
      }
      request.userId = userId
      return true
    },
  )
  return server.inject({
    url,
    method: init?.method ?? 'GET',
    payload: init?.payload as never,
  })
}

function bodyOf<T>(res: { payload: string }): T {
  return JSON.parse(res.payload) as T
}

beforeAll(async () => {
  redis = createMockRedis()
  server = Fastify()
  server.decorate('redis', redis as never)
  await server.register(skillsRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  redis.store.set(MARKET_KEY, JSON.stringify(SEED))
  mockCheckAuth.mockReset()
})

describe('GET /api/skills/market —— listing 级下架对非 owner 隐身', () => {
  it('owner 看得见自己下架的条目,别人看不见', async () => {
    const mine = bodyOf<{ data: { items: SkillMarketEntry[] } }>(
      await as(OWNER_ID, '/api/skills/market'),
    )
    const other = bodyOf<{ data: { items: SkillMarketEntry[] } }>(
      await as(OTHER_ID, '/api/skills/market'),
    )
    const mineNames = mine.data.items.map((e) => e.name)
    const otherNames = other.data.items.map((e) => e.name)
    expect(mineNames).toContain('mine-hidden')
    expect(otherNames).not.toContain('mine-hidden')
    // 缺省字段(legacy)按"在架"解释,不能被当成已下架而误藏
    expect(otherNames).toContain('legacy')
    expect(otherNames).toContain('theirs')
  })
})

describe('POST /api/skills/:name/listing —— 上下架切换', () => {
  it('先鉴权后校验:未登录时即便 name 非法(会让 Zod 判 400)也必须先拿到 401', async () => {
    const illegalName = 'x'.repeat(80) // nameParamSchema: max 64 ⇒ 若先校参数就是 400
    // 80 而非 200:Fastify 的 maxParamLength 默认 100,超了会在框架层就 414,
    // 那样测不到"路由体内先鉴权再校参数"的顺序,等于没测。
    const res = await as(null, `/api/skills/${illegalName}/listing`, {
      method: 'POST',
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(401)
    // 反向对照:同一个 name 登录后必须是 400。少了这一句,本用例可能因为
    // "框架层就把长参数挡了"而恒真 —— 那测的就不是顺序,而是路由。
    const sameNameLoggedIn = await as(OWNER_ID, `/api/skills/${illegalName}/listing`, {
      method: 'POST',
      payload: { enabled: false },
    })
    expect(sameNameLoggedIn.statusCode).toBe(400)
  })

  it('owner 下架成功,并且条目随即对市场隐身', async () => {
    const res = await as(OWNER_ID, '/api/skills/mine/listing', {
      method: 'POST',
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(200)
    expect(bodyOf<{ data: { name: string; enabled: boolean } }>(res).data).toEqual({
      name: 'mine',
      enabled: false,
    })
    const names = bodyOf<{ data: { items: SkillMarketEntry[] } }>(
      await as(OTHER_ID, '/api/skills/market'),
    ).data.items.map((e) => e.name)
    expect(names).not.toContain('mine')
  })

  it('非 owner 一律 403 —— 不得只靠前端隐藏按钮', async () => {
    const res = await as(OTHER_ID, '/api/skills/mine/listing', {
      method: 'POST',
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(403)
    // 未发生变更
    const stored = JSON.parse(redis.store.get(MARKET_KEY) ?? '[]') as SkillMarketEntry[]
    expect(stored.find((e) => e.name === 'mine')?.enabled).toBe(true)
  })

  it('无归属条目(内置 / 契约落地前写入的 legacy)没有人是 owner ⇒ 403', async () => {
    for (const name of ['legacy', 'builtin-thing']) {
      const res = await as(OWNER_ID, `/api/skills/${name}/listing`, {
        method: 'POST',
        payload: { enabled: false },
      })
      expect(res.statusCode).toBe(403)
    }
  })

  it('body 缺 enabled / 类型不对 ⇒ 400;条目不存在 ⇒ 404', async () => {
    const bad = await as(OWNER_ID, '/api/skills/mine/listing', { method: 'POST', payload: {} })
    expect(bad.statusCode).toBe(400)
    const missing = await as(OWNER_ID, '/api/skills/nope/listing', {
      method: 'POST',
      payload: { enabled: true },
    })
    expect(missing.statusCode).toBe(404)
  })
})

describe('GET /api/skills/:name/ownership —— owner 判定', () => {
  it('owner 本人:isOwner true,ownerId 回显', async () => {
    const res = await as(OWNER_ID, '/api/skills/mine/ownership')
    expect(res.statusCode).toBe(200)
    expect(bodyOf<{ data: Record<string, unknown> }>(res).data).toEqual({
      name: 'mine',
      isOwner: true,
      ownerId: 101,
      enabled: true,
      source: 'user',
    })
  })

  it('他人:isOwner false,但仍能看到条目存在', async () => {
    const res = await as(OTHER_ID, '/api/skills/mine/ownership')
    expect(bodyOf<{ data: { isOwner: boolean } }>(res).data.isOwner).toBe(false)
  })

  it('无归属条目 ownerId 归一为 null(不是 undefined,避免 wire 形状漂移),enabled 缺省判在架', async () => {
    const res = await as(OWNER_ID, '/api/skills/legacy/ownership')
    const data = bodyOf<{ data: { ownerId: unknown; isOwner: boolean; enabled: boolean } }>(
      res,
    ).data
    expect(data.ownerId).toBeNull()
    expect(data.isOwner).toBe(false)
    expect(data.enabled).toBe(true)
  })

  it('条目不存在 ⇒ 404;未登录 ⇒ 401', async () => {
    expect((await as(OWNER_ID, '/api/skills/nope/ownership')).statusCode).toBe(404)
    expect((await as(null, '/api/skills/mine/ownership')).statusCode).toBe(401)
  })
})

describe('POST /api/skills/market —— 上架时由服务端推导归属', () => {
  it('登录用户新建条目 ⇒ source=user + ownerId=其 userId + enabled=true', async () => {
    const res = await as('404', '/api/skills/market', {
      method: 'POST',
      payload: {
        name: 'brand-new',
        description: '新条目',
        tags: ['x'],
        author: 'someone',
        version: '1.0.0',
        license: 'MIT',
        content: 'body',
      },
    })
    expect(res.statusCode).toBe(201)
    const created = bodyOf<{ data: SkillMarketEntry }>(res).data
    expect(created.ownerId).toBe(404)
    expect(created.source).toBe('user')
    expect(created.enabled).toBe(true)
  })

  it('同作者更新已有条目 ⇒ 给契约落地前的无归属条目补认领,且不动 enabled', async () => {
    const res = await as(OTHER_ID, '/api/skills/market', {
      method: 'POST',
      payload: {
        name: 'legacy',
        description: 'legacy 更新',
        tags: ['t'],
        author: 'tester',
        version: '2.0.0',
        license: 'MIT',
        content: 'body',
      },
    })
    // P0 授权修复:非 admin 不得认领无主的内置/legacy 条目 —— 旧断言这里期望 200 +
    // ownerId=调用者，等于把"任何人带 author 字符串即可认领平台资产"写成预期行为。
    // admin 侧的补认领由 tests/skills-market-publish-ownership.test.ts 覆盖。
    expect(res.statusCode).toBe(403)
    // "条目逐字段未变 + redis 未被写"由 tests/skills-market-publish-ownership.test.ts
    // 以整个 redis 状态指纹字节相等断言覆盖，此处不重复实现一套读取。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
