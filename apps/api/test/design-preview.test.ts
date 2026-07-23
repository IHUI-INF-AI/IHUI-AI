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

/** 进程内 Redis mock:design 路由仅用 get/set(字符串 KV) */
function createMockRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
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
})
