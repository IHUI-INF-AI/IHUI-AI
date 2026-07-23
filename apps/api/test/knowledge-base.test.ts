import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 鉴权 mock ----------
const { mockAuthenticate, dbQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))

// ---------- db 链式 mock(队列模式:按调用顺序返回 enqueue 的结果) ----------
vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'select',
      'groupBy',
      'having',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    insert: vi.fn(factory),
    update: vi.fn(factory),
    delete: vi.fn(factory),
  }
  return { db: dbMock, dbRead: dbMock, returningOne: vi.fn() }
})

// @ihui/database 表对象:仅作为参数传递,eq/sql 会访问其属性,提供最小桩
vi.mock('@ihui/database', () => ({
  knowledgeBase: {
    id: 'kb.id',
    title: 'kb.title',
    summary: 'kb.summary',
    content: 'kb.content',
    coverImage: 'kb.coverImage',
    categoryId: 'kb.categoryId',
    authorId: 'kb.authorId',
    isPublished: 'kb.isPublished',
    status: 'kb.status',
    viewCount: 'kb.viewCount',
    updatedAt: 'kb.updatedAt',
  },
  knowledgeBaseCategories: {
    id: 'kbc.id',
    name: 'kbc.name',
    sortOrder: 'kbc.sortOrder',
  },
}))

import { knowledgeBaseRoutes } from '../src/routes/other/knowledge-base-routes.js'
import { authenticate } from '../src/plugins/auth.js'

const UUID = '11111111-1111-1111-1111-111111111111'
const NOW = new Date('2026-07-23T00:00:00Z')

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    title: '测试知识库',
    summary: '摘要',
    content: '正文',
    coverImage: null,
    categoryId: null,
    authorId: 'user-001',
    isPublished: false,
    status: 1,
    viewCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('knowledge-base routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟生产环境 server.ts 的 errorHandler:AJV 验证错误 → 400, ZodError → 400
    app.setErrorHandler((err, _req, reply) => {
      const isZodErr =
        err.name === 'ZodError' && Array.isArray((err as { issues?: unknown[] }).issues)
      const statusCode = isZodErr
        ? 400
        : err.statusCode && err.statusCode >= 400 && err.statusCode < 600
          ? err.statusCode
          : 500
      const message = isZodErr
        ? ((err as { issues?: Array<{ message?: string }> }).issues?.[0]?.message ?? '参数错误')
        : statusCode >= 500
          ? '服务器错误'
          : err.message
      reply.status(statusCode).send({ code: statusCode, message })
    })
    // 复刻 other/index.ts 的 preHandler:authenticate 失败返回 401
    app.addHook('preHandler', async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply
          .status(statusCode)
          .send({ code: statusCode, message: (e as Error).message || 'Authentication required' })
      }
    })
    await app.register(knowledgeBaseRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbQueue.items.length = 0
    // 默认未登录
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockAuthenticate.mockImplementation(
      async (request: { userId?: string; jwtPayload?: unknown }) => {
        request.userId = userId
        request.jwtPayload = { userId, roleId }
      },
    )
  }

  function enqueue(...results: unknown[][]) {
    dbQueue.items.push(...results)
  }

  describe('GET /api/knowledge-base/categories', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/knowledge-base/categories' })
      expect(res.statusCode).toBe(401)
    })

    it('登录后返回分类列表(含文章数)', async () => {
      authAs()
      enqueue([
        { id: 'cat-1', name: '分类一', count: 3 },
        { id: 'cat-2', name: '分类二', count: 0 },
      ])
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-base/categories',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(2)
      expect(body.data.list[0].count).toBe(3)
    })

    it('空分类返回空列表', async () => {
      authAs()
      enqueue([])
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-base/categories',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.list).toEqual([])
    })
  })

  describe('POST /api/knowledge-base', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { title: 'x' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('缺少 title 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { summary: '无标题' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('title 过长(>200)返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { title: 'x'.repeat(201) },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('coverImage 过长(>500)返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { title: 'ok', coverImage: 'x'.repeat(501) },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('categoryId 非 UUID 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { title: 'ok', categoryId: 'not-uuid' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('创建成功返回 201', async () => {
      authAs()
      enqueue([makeItem({ title: '新条目' })])
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-base',
        payload: { title: '新条目', isPublished: false, status: 1 },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().data.item.title).toBe('新条目')
    })
  })

  describe('GET /api/knowledge-base/:id', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/knowledge-base/${UUID}` })
      expect(res.statusCode).toBe(401)
    })

    it('知识库不存在返回 404', async () => {
      authAs()
      enqueue([]) // dbRead.select 返回空
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-base/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('知识库不存在')
    })

    it('存在时返回详情并浏览量 +1', async () => {
      authAs()
      const item = makeItem({ viewCount: 5 })
      enqueue([item]) // dbRead.select
      enqueue([]) // db.update(viewCount + 1) 不 returning
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-base/${UUID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.item.id).toBe(UUID)
      expect(body.data.item.viewCount).toBe(5)
    })
  })

  describe('PUT /api/knowledge-base/:id', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/knowledge-base/${UUID}`,
        payload: { title: 'new' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('知识库不存在返回 404', async () => {
      authAs()
      enqueue([]) // dbRead.select 返回空
      const res = await app.inject({
        method: 'PUT',
        url: `/api/knowledge-base/${UUID}`,
        payload: { title: 'new' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('知识库不存在')
    })

    it('非作者编辑返回 403', async () => {
      authAs('user-002', 0)
      enqueue([makeItem({ authorId: 'user-001' })]) // dbRead.select 返回已有
      const res = await app.inject({
        method: 'PUT',
        url: `/api/knowledge-base/${UUID}`,
        payload: { title: 'new' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('无权编辑')
    })

    it('作者编辑成功返回 200', async () => {
      authAs('user-001', 0)
      enqueue([makeItem({ authorId: 'user-001' })]) // dbRead.select 返回已有
      enqueue([makeItem({ title: '新标题', authorId: 'user-001' })]) // db.update.returning
      const res = await app.inject({
        method: 'PUT',
        url: `/api/knowledge-base/${UUID}`,
        payload: { title: '新标题', isPublished: true },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.item.title).toBe('新标题')
    })

    it('title 空字符串返回 400(更新校验)', async () => {
      authAs('user-001', 0)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/knowledge-base/${UUID}`,
        payload: { title: '' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('参数校验 - parseIdParam', () => {
    it('id 为空时路由不匹配返回 404(Fastify 路由匹配)', async () => {
      authAs()
      const res = await app.inject({ method: 'GET', url: '/api/knowledge-base/' })
      expect(res.statusCode).toBe(404)
    })

    it('任意非空 id 字符串通过参数校验', async () => {
      authAs()
      enqueue([]) // dbRead.select 返回空
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-base/abc-not-uuid',
        headers: { authorization: 'Bearer t' },
      })
      // 路由不强制 UUID,任意非空字符串通过 parseIdParam
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('知识库不存在')
    })
  })
})
