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

import { designRoutes } from '../src/routes/design.js'

/** 进程内 Redis mock:design 路由用 get/set(预览 KV)+ lpush/lrange(评论 List) */
function createMockRedis() {
  const store = new Map<string, string>()
  const lists = new Map<string, string[]>()
  return {
    store,
    lists,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
    // LPUSH:把 value 插入到 list 头部(返回新长度)
    lpush: vi.fn(async (k: string, v: string) => {
      const arr = lists.get(k) ?? []
      arr.unshift(v)
      lists.set(k, arr)
      return arr.length
    }),
    // LRANGE:start..end(支持 0..-1 取全部)
    lrange: vi.fn(async (k: string, start: number, end: number) => {
      const arr = lists.get(k) ?? []
      const len = arr.length
      const s = start < 0 ? Math.max(len + start, 0) : start
      const e = end < 0 ? len + end + 1 : end + 1
      return arr.slice(s, e)
    }),
  }
}

const mockRedis = createMockRedis()

describe('Design Preview API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', mockRedis as never)
    await app.register(designRoutes, { prefix: '/api' })
    await app.ready()
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockRedis.store.clear()
    mockRedis.lists.clear()
    mockCheckAuth.mockReset()
    mockCheckAuth.mockImplementation((req: { userId?: string }) => {
      req.userId = '1'
      return Promise.resolve(true)
    })
  })

  // ===================== POST /design/preview =====================
  describe('POST /api/design/preview', () => {
    it('保存预览并返回 preview', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/preview',
        payload: { name: '登录页', html: '<div>hello</div>' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.preview).toMatchObject({
        name: '登录页',
        html: '<div>hello</div>',
        userId: 1,
      })
      expect(body.data.preview.id).toBeTruthy()
      expect(body.data.preview.createdAt).toBeTruthy()
      expect(body.data.preview.updatedAt).toBeTruthy()
    })

    it('缺少 name 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/preview',
        payload: { html: '<div></div>' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('缺少 html 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/preview',
        payload: { name: '页面' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // ===================== GET /design/previews =====================
  describe('GET /api/design/previews', () => {
    it('列出用户已保存的预览', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/design/preview',
        payload: { name: '页面A', html: '<a/>' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/design/preview',
        payload: { name: '页面B', html: '<b/>' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/design/previews' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(2)
      expect(body.data.previews).toHaveLength(2)
    })

    it('无预览时返回空列表', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/design/previews' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(0)
      expect(body.data.previews).toHaveLength(0)
    })
  })

  // ===================== POST /design/comments =====================
  describe('POST /api/design/comments', () => {
    it('创建评论并返回 comment(LPUSH 到 Redis List)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { previewId: 'preview-abc', content: '按钮颜色太亮', elementId: 'cta' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toMatchObject({
        previewId: 'preview-abc',
        content: '按钮颜色太亮',
        elementId: 'cta',
        userId: 1,
      })
      expect(body.data.id).toBeTruthy()
      expect(body.data.createdAt).toBeTruthy()
      expect(body.data.userName).toBeTruthy()
      // 验证 LPUSH 被调用,且 key 为 design-comments:preview-abc
      expect(mockRedis.lpush).toHaveBeenCalled()
      const lpushArgs = mockRedis.lpush.mock.calls.at(-1)!
      expect(lpushArgs[0]).toBe('design-comments:preview-abc')
      // 验证 List 中确实有 1 条
      expect(mockRedis.lists.get('design-comments:preview-abc')).toHaveLength(1)
    })

    it('缺少 content 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { previewId: 'p1' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })

    it('缺少 previewId 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { content: 'hi' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('elementId 可选,缺省时为空字符串', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { previewId: 'p2', content: '整体不错' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.elementId).toBe('')
    })
  })

  // ===================== GET /design/comments/:previewId =====================
  describe('GET /api/design/comments/:previewId', () => {
    it('列出指定预览的所有评论(最新在头部)', async () => {
      // 先创建 2 条评论
      await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { previewId: 'pv1', content: '第一条' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/design/comments',
        payload: { previewId: 'pv1', content: '第二条' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/design/comments/pv1' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(2)
      expect(body.data.comments).toHaveLength(2)
      // LPUSH 头部 → 最新在前
      expect(body.data.comments[0].content).toBe('第二条')
      expect(body.data.comments[1].content).toBe('第一条')
    })

    it('无评论时返回空列表', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/design/comments/no-comments' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.total).toBe(0)
      expect(body.data.comments).toHaveLength(0)
    })
  })
})
