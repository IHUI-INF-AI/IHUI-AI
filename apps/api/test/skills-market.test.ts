import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockCheckAuth } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
}))

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
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
}))

import { skillsRoutes } from '../src/routes/skills.js'

const MARKET_KEY = 'skills-market:global'

/** 进程内 Redis mock:store(字符串 KV)+ hashes(Hash 结构,本文件未用但保持一致) */
function createMockRedis() {
  const store = new Map<string, string>()
  const hashes = new Map<string, Map<string, string>>()
  return {
    store,
    hashes,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    hset: vi.fn(async (k: string, f: string, v: string) => {
      if (!hashes.has(k)) hashes.set(k, new Map())
      hashes.get(k)!.set(f, v)
      return 1
    }),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k)
      if (!h) return {} as Record<string, string>
      const o: Record<string, string> = {}
      for (const [f, v] of h) o[f] = v
      return o
    }),
    hdel: vi.fn(async (k: string, ...fs: string[]) => {
      const h = hashes.get(k)
      if (!h) return 0
      let n = 0
      for (const f of fs) if (h.delete(f)) n++
      return n
    }),
    expire: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  }
}

const mockRedis = createMockRedis()
let cleanMarketJson = ''

describe('Skills Market API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', mockRedis as never)
    await app.register(skillsRoutes, { prefix: '/api' })
    await app.ready()
    // 鉴权放行 + userId=1
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
    // 预热:触发 readMarket 自动落种,捕获干净种子 JSON 供 beforeEach 还原
    // (避免 install/rate 测试修改 MARKET_SEED 引用导致跨用例污染)
    await app.inject({ method: 'GET', url: '/api/skills/market' })
    cleanMarketJson = mockRedis.store.get(MARKET_KEY) ?? ''
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockRedis.store.clear()
    mockRedis.hashes.clear()
    if (cleanMarketJson) mockRedis.store.set(MARKET_KEY, cleanMarketJson)
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
  })

  // ===================== GET /skills/market =====================
  describe('GET /api/skills/market', () => {
    it('默认返回 7 种子 skill', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills/market' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(7)
      expect(body.data.items).toHaveLength(7)
      expect(body.data.page).toBe(1)
      expect(body.data.pageSize).toBe(20)
    })

    it('q 过滤按 name/description 匹配', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/market?q=figma',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(1)
      expect(body.data.items[0].name).toBe('figma-to-code')
    })

    it('tag 过滤按 tags 匹配', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/market?tag=content',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // content tag: content_engine, koubo_workflow, doc-summarizer
      expect(body.data.total).toBe(3)
      const names = body.data.items.map((e: { name: string }) => e.name)
      expect(names).toEqual(
        expect.arrayContaining(['content_engine', 'koubo_workflow', 'doc-summarizer']),
      )
    })

    it('分页 page/pageSize 生效', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/market?page=1&pageSize=2',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(7)
      expect(body.data.items).toHaveLength(2)
      expect(body.data.page).toBe(1)
      expect(body.data.pageSize).toBe(2)

      // 末页:7 - 3*2 = 1 条
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/skills/market?page=4&pageSize=2',
      })
      const body2 = res2.json()
      expect(body2.data.items).toHaveLength(1)
    })
  })

  // ===================== POST /skills/:name/install =====================
  describe('POST /api/skills/:name/install', () => {
    it('installCount 自增并返回 installed=true', async () => {
      // 先拿原始 installCount
      const before = await app.inject({
        method: 'GET',
        url: '/api/skills/market?q=code-reviewer',
      })
      const beforeCount = before.json().data.items[0].installCount

      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/code-reviewer/install',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({
        name: 'code-reviewer',
        installed: true,
        installCount: beforeCount + 1,
      })
    })

    it('不存在的 skill 返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/not-exist-skill/install',
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('install 同时写入用户私有库 Hash skills:<userId>', async () => {
      // 清空用户库 Hash,确保干净
      mockRedis.hashes.delete('skills:1')
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/code-reviewer/install',
      })
      expect(res.statusCode).toBe(200)
      // 验证用户私有库 Hash 已写入
      const userLib = mockRedis.hashes.get('skills:1')
      expect(userLib).toBeTruthy()
      expect(userLib!.has('code-reviewer')).toBe(true)
      const stored = JSON.parse(userLib!.get('code-reviewer')!)
      expect(stored.name).toBe('code-reviewer')
      expect(stored.installCount).toBeGreaterThan(0)
    })

    it('install 不破坏 installCount++ 行为', async () => {
      const before = await app.inject({
        method: 'GET',
        url: '/api/skills/market?q=figma-to-code',
      })
      const beforeCount = before.json().data.items[0].installCount

      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/figma-to-code/install',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.installCount).toBe(beforeCount + 1)
      // 用户库 Hash 也写入
      expect(mockRedis.hashes.get('skills:1')?.has('figma-to-code')).toBe(true)
    })
  })

  // ===================== POST /skills/market =====================
  describe('POST /api/skills/market', () => {
    it('发布新 skill 到市场,返回 201 + 条目(初始 0)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/market',
        payload: {
          name: 'my-custom-skill',
          description: '我自己的技能',
          tags: ['code', 'custom'],
          author: 'tester',
          version: '0.1.0',
          license: 'MIT',
          content: '# skill body\nstep1 ...',
        },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({
        name: 'my-custom-skill',
        description: '我自己的技能',
        tags: ['code', 'custom'],
        author: 'tester',
        version: '0.1.0',
        license: 'MIT',
        installCount: 0,
        rating: 0,
        ratingCount: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })

      // 验证可被市场搜索到
      const list = await app.inject({
        method: 'GET',
        url: '/api/skills/market?q=my-custom-skill',
      })
      expect(list.json().data.total).toBe(1)
      expect(list.json().data.items[0].name).toBe('my-custom-skill')
    })

    it('与市场已有 name 冲突返回 409', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/market',
        payload: {
          name: 'code-reviewer',
          description: 'dup',
          tags: [],
          author: 'x',
          version: '1.0.0',
          license: 'MIT',
          content: 'x',
        },
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe(409)
    })

    it('name 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/market',
        payload: {
          description: 'no name',
          tags: [],
          author: 'x',
          version: '1.0.0',
          license: 'MIT',
          content: 'x',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('content 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/market',
        payload: {
          name: 'no-content',
          description: 'd',
          tags: [],
          author: 'x',
          version: '1.0.0',
          license: 'MIT',
        },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===================== POST /skills/:name/rate =====================
  describe('POST /api/skills/:name/rate', () => {
    it('评分入库并重算平均分与评分人数', async () => {
      // 第一次评分 5 分
      const r1 = await app.inject({
        method: 'POST',
        url: '/api/skills/content_engine/rate',
        payload: { score: 5, comment: '很好用' },
      })
      expect(r1.statusCode).toBe(201)
      const b1 = r1.json()
      expect(b1.code).toBe(0)
      expect(b1.data.score).toBe(5)
      expect(b1.data.comment).toBe('很好用')
      expect(b1.data.skillName).toBe('content_engine')
      expect(b1.data.userId).toBe(1)
      expect(b1.data.id).toBeTruthy()

      // 第二次评分 3 分,验证平均分重算
      await app.inject({
        method: 'POST',
        url: '/api/skills/content_engine/rate',
        payload: { score: 3 },
      })

      // 校验市场条目平均分 = (5+3)/2 = 4,评分人数 = 2
      const market = await app.inject({
        method: 'GET',
        url: '/api/skills/market?q=content_engine',
      })
      const entry = market.json().data.items[0]
      expect(entry.ratingCount).toBe(2)
      expect(entry.rating).toBe(4)
    })

    it('score 缺失或越界返回 400', async () => {
      const missing = await app.inject({
        method: 'POST',
        url: '/api/skills/content_engine/rate',
        payload: { comment: '无分数' },
      })
      expect(missing.statusCode).toBe(400)
      expect(missing.json().code).toBe(400)

      const overflow = await app.inject({
        method: 'POST',
        url: '/api/skills/content_engine/rate',
        payload: { score: 6 },
      })
      expect(overflow.statusCode).toBe(400)

      const underflow = await app.inject({
        method: 'POST',
        url: '/api/skills/content_engine/rate',
        payload: { score: 0 },
      })
      expect(underflow.statusCode).toBe(400)
    })

    it('不存在的 skill 返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/skills/no-such-skill/rate',
        payload: { score: 3 },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ===================== GET /skills/:name/ratings =====================
  describe('GET /api/skills/:name/ratings', () => {
    it('先评分后返回评分列表', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/skills/test-writer/rate',
        payload: { score: 4 },
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/test-writer/ratings',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(1)
      expect(body.data.ratings[0].score).toBe(4)
      expect(body.data.ratings[0].skillName).toBe('test-writer')
    })

    it('未评分的 skill 返回空列表', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/skills/api-mock-gen/ratings',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(0)
      expect(body.data.ratings).toHaveLength(0)
    })
  })
})
