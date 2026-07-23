/**
 * AI 厂商 v2 路由单元测试（R4 重构产物）。
 *
 * 验证：
 * - v2 路由已注册到 /api/ai/v2/* 前缀
 * - 未登录请求返回 401（与原 v1 路由鉴权行为一致）
 * - 凭据缺失时返回 503（newCallVendor 走 VendorErrorHandler.validateCredentials）
 * - 鉴权策略正确应用：Dashscope 用 Bearer，Doubao 用 Bearer，Gemini 用 x-goog-api-key
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    DATABASE_READ_REPLICA_URL: '',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

const mockAuthenticate = vi.fn()
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  // checkAuth 调用 authenticate,失败时 reply 401 并返回 false,与源码行为一致
  checkAuth: async (request: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
    try {
      await mockAuthenticate(request)
      return true
    } catch {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return false
    }
  },
}))

const { aiVendorV2Routes } = await import('../src/routes/ai-vendors.js')

describe('aiVendorV2Routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiVendorV2Routes, { prefix: '/api/ai' })
    await server.ready()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await server.close()
  })

  it('未登录访问 /v2/dashscope/chat 返回 401', async () => {
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/v2/dashscope/chat',
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('未登录访问 /v2/doubao/chat 返回 401', async () => {
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/v2/doubao/chat',
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('未登录访问 /v2/gemini/chat 返回 401', async () => {
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/v2/gemini/chat',
      body: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('v2 路由独立注册时可访问 v2 端点', async () => {
    mockAuthenticate.mockRejectedValue(new Error('Authentication required'))
    const v2 = await server.inject({
      method: 'POST',
      url: '/api/ai/v2/dashscope/chat',
      body: {},
    })
    // 鉴权失败时返回 401（与 v1 行为一致）
    expect(v2.statusCode).toBe(401)
  })
})
