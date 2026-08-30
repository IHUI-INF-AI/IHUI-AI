/**
 * 小程序兼容路由空桩真实化测试(2026-08-31)
 *
 * 覆盖剩余空桩端点的实装验证:
 *  - 内部转发类(/model/chat POST、/ai/kling/image、/workflows/n8n/create):
 *    通过注册"标记型假主路由"验证兼容桩确实转发到主路由路径,而非返回空结构
 *  - 真实表操作类(/model/chat/:id DELETE、/aigc/publish):mock db 验证真实写入/删除
 *  - 无真实实现类(/distribution/wx-code、/settings/cache/*、/agent/creation/share、
 *    /workflows/n8n GET 未配置):验证响应带 notAvailable: true 标记
 *  - 鉴权对齐:全部写操作/需登录端点无 token 返回 401
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken } = vi.hoisted(() => ({ mockVerifyAccessToken: vi.fn() }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// authenticate 内部 decodeJwt 校验 challenge token,非 challenge 绕过
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))

// authenticate 查用户状态:status=1(active)
vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// mock db,聚焦路由逻辑(真实表操作走 mock 链式调用验证)
const { mockDbInsert, mockDbDelete } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    insert: mockDbInsert,
    delete: mockDbDelete,
    select: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
  },
  dbRead: { select: vi.fn(), execute: vi.fn() },
}))

import { miniappCompatRoutes } from '../miniapp-compat-routes.js'

const MEMBER_ID = '00000000-0000-4000-8000-000000000010'
const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

function mockAuth(): void {
  mockVerifyAccessToken.mockResolvedValue({ userId: MEMBER_ID, roleId: 0, type: 'access' })
}

/** db.insert(...).values(...).returning(...) 链式 mock,并记录 insert 的 values 参数 */
let lastInsertValues: Record<string, unknown> | undefined
function mockInsertReturning(rows: unknown[]): void {
  mockDbInsert.mockImplementationOnce(() => {
    const chain = {
      values: vi.fn((v: Record<string, unknown>) => {
        lastInsertValues = v
        return chain
      }),
      returning: vi.fn().mockResolvedValue(rows),
    }
    return chain
  })
}

/** db.delete(...).where(...).returning(...) 链式 mock */
function mockDeleteReturning(rows: unknown[]): void {
  mockDbDelete.mockImplementationOnce(() => {
    const chain = {
      where: vi.fn(() => chain),
      returning: vi.fn().mockResolvedValue(rows),
    }
    return chain
  })
}

describe('小程序兼容路由空桩真实化(2026-08-31)', () => {
  const server = Fastify({ logger: false })
  let savedN8nDomain: string | undefined
  let savedN8nKey: string | undefined

  // 注册"标记型假主路由":若兼容桩内部转发正确,响应 data.from 会带对应标记,
  // 以此证明响应来自主路由 handler 而非空结构
  server.post('/api/ai/chat', async () => ({
    code: 0,
    message: 'ok',
    data: { from: 'ai-chat-main-route' },
  }))
  server.post('/api/chat/kling/image/generate', async () => ({
    code: 0,
    message: 'ok',
    data: { from: 'kling-image-main-route', taskId: 'task-1' },
  }))
  server.post('/cozeZhsApi/n8n/addAgent', async () => ({
    code: 0,
    message: 'ok',
    data: { from: 'n8n-addAgent-main-route', agent_id: 'n8n_x', examine_id: 'e1' },
  }))
  server.register(miniappCompatRoutes, { prefix: '/api' })

  beforeAll(async () => {
    savedN8nDomain = process.env.N8N_DOMAIN
    savedN8nKey = process.env.N8N_API_KEY
    delete process.env.N8N_DOMAIN
    delete process.env.N8N_API_KEY
    await server.ready()
  })

  afterAll(async () => {
    if (savedN8nDomain !== undefined) process.env.N8N_DOMAIN = savedN8nDomain
    else delete process.env.N8N_DOMAIN
    if (savedN8nKey !== undefined) process.env.N8N_API_KEY = savedN8nKey
    else delete process.env.N8N_API_KEY
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    lastInsertValues = undefined
    mockAuth()
  })

  // ==========================================================================
  // 鉴权对齐:需登录端点无 token 返回 401
  // ==========================================================================
  describe('鉴权对齐(无 token → 401)', () => {
    const endpoints: Array<{
      method: 'GET' | 'POST' | 'DELETE'
      url: string
      payload?: Record<string, unknown>
    }> = [
      { method: 'GET', url: '/api/workflows/n8n' },
      {
        method: 'POST',
        url: '/api/workflows/n8n/create',
        payload: { name: 'a', description: 'b' },
      },
      { method: 'POST', url: '/api/model/chat', payload: { configId: 'c1', messages: [] } },
      { method: 'DELETE', url: '/api/model/chat/00000000-0000-4000-8000-000000000001' },
      { method: 'POST', url: '/api/aigc/publish', payload: { title: 't' } },
      { method: 'POST', url: '/api/ai/kling/image', payload: { prompt: 'p' } },
      { method: 'GET', url: '/api/distribution/wx-code' },
      { method: 'POST', url: '/api/settings/cache/clear' },
      { method: 'GET', url: '/api/settings/cache/size' },
      { method: 'POST', url: '/api/agent/creation/share', payload: { agentId: 'a1' } },
    ]

    for (const { method, url, payload } of endpoints) {
      it(`${method} ${url} 无 auth 返回 401`, async () => {
        const res = await server.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
        const body = res.json()
        expect(body).toHaveProperty('code', 401)
        expect(body).toHaveProperty('message')
      })
    }
  })

  // ==========================================================================
  // 内部转发类:响应来自主路由(带标记)而非空结构
  // ==========================================================================
  describe('内部转发到主路由', () => {
    it('POST /api/model/chat 转发到 /api/ai/chat 主路由', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/model/chat',
        headers: AUTH_HEADERS,
        payload: { configId: 'c1', messages: [{ role: 'user', content: 'hi' }] },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.from).toBe('ai-chat-main-route')
    })

    it('POST /api/ai/kling/image 转发到 /api/chat/kling/image/generate 主路由', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/kling/image',
        headers: AUTH_HEADERS,
        payload: { prompt: '一只猫' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.from).toBe('kling-image-main-route')
      expect(body.data.taskId).toBe('task-1')
    })

    it('POST /api/workflows/n8n/create 转发到 /cozeZhsApi/n8n/addAgent 主路由', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/workflows/n8n/create',
        headers: AUTH_HEADERS,
        payload: { name: '测试工作流', description: '测试描述' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.from).toBe('n8n-addAgent-main-route')
      expect(body.data.agent_id).toBe('n8n_x')
    })

    it('POST /api/workflows/n8n/create 缺 name/description 返回 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/workflows/n8n/create',
        headers: AUTH_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe(400)
    })
  })

  // ==========================================================================
  // 真实表操作类
  // ==========================================================================
  describe('真实表操作', () => {
    it('DELETE /api/model/chat/:id 删除自己的对话 → deleted:true(真实 db.delete)', async () => {
      mockDeleteReturning([{ id: '00000000-0000-4000-8000-000000000001' }])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/model/chat/00000000-0000-4000-8000-000000000001',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({
        id: '00000000-0000-4000-8000-000000000001',
        deleted: true,
      })
      expect(mockDbDelete).toHaveBeenCalledTimes(1)
    })

    it('DELETE /api/model/chat/:id 记录不存在(或非本人)→ 404', async () => {
      mockDeleteReturning([])
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/model/chat/00000000-0000-4000-8000-000000000002',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })

    it('DELETE /api/model/chat/:id 非法 id → 400', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/model/chat/not-a-uuid',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/aigc/publish 写 aiGcContent 表并返回真实 id', async () => {
      mockInsertReturning([{ id: '11111111-1111-4111-8111-111111111111' }])
      const res = await server.inject({
        method: 'POST',
        url: '/api/aigc/publish',
        headers: AUTH_HEADERS,
        payload: {
          contextId: 'ctx-1',
          title: '标题',
          subtitle: '副标题',
          coverUrl: 'https://example.com/c.png',
          problem: '问题描述',
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe('11111111-1111-4111-8111-111111111111')
      expect(body.data.status).toBe('published')
      // 验证真实入库参数:userUuid=当前用户,agentId 取 contextId,content 含标题
      expect(mockDbInsert).toHaveBeenCalledTimes(1)
      expect(lastInsertValues?.userUuid).toBe(MEMBER_ID)
      expect(lastInsertValues?.agentId).toBe('ctx-1')
      expect(String(lastInsertValues?.content)).toContain('标题')
      expect(lastInsertValues?.status).toBe(1)
    })
  })

  // ==========================================================================
  // 无真实实现类:notAvailable 标记
  // ==========================================================================
  describe('无真实实现 → notAvailable 标记', () => {
    it('GET /api/workflows/n8n 未配置 n8n 环境变量 → notAvailable:true', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/workflows/n8n',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.notAvailable).toBe(true)
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
      expect(body.data.source).toBe('unconfigured')
      expect(typeof body.data.reason).toBe('string')
    })

    it('GET /api/distribution/wx-code → notAvailable:true(微信 API 未接入)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/distribution/wx-code',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.notAvailable).toBe(true)
      expect(typeof body.data.reason).toBe('string')
    })

    it('POST /api/settings/cache/clear → notAvailable:true(客户端本地缓存)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/settings/cache/clear',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.notAvailable).toBe(true)
      expect(body.data.cleared).toBe(false)
    })

    it('GET /api/settings/cache/size → notAvailable:true', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/settings/cache/size',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.notAvailable).toBe(true)
    })

    it('POST /api/agent/creation/share → notAvailable:true 且返回 CSPRNG shareId 占位', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/agent/creation/share',
        headers: AUTH_HEADERS,
        payload: { agentId: 'agent-1' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.notAvailable).toBe(true)
      expect(body.data.id).toMatch(/^[0-9a-z]+-[0-9a-f]{8}$/)
      expect(body.data.url).toContain('agent-1')
      expect(body.data.url).toContain('share=')
    })
  })
})
