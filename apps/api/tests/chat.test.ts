import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    COZE_API_KEY: '',
  },
}))

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { chatRoutes } from '../src/routes/chat'

beforeAll(() => {
  const err = Object.assign(new Error('Authentication required'), { statusCode: 401 })
  mockAuthenticate.mockRejectedValue(err)
})

describe('chat routes', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/chat/conversations 未登录返回 401', async () => {
    await server.register(chatRoutes, { prefix: '/api/chat' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/chat/conversations' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/chat/conversations 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat/conversations',
      body: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/chat/favorites 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/chat/favorites' })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/chat/messages/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/chat/messages/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('coze/stream 越权校验', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    delete process.env.COZE_API_KEY
    await server.register(chatRoutes, { prefix: '/api/chat' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('未登录调用 /coze/stream 返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat/coze/stream',
      body: { botId: 'bot-1', userId: 'user-a', query: 'hi' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('登录用户 A 传 targetUserId=user-b 时返回 403', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-a'
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat/coze/stream',
      body: { botId: 'bot-1', userId: 'user-b', query: 'hi' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('无权操作')
  })

  it('登录用户 A 传 targetUserId=user-a 时通过越权校验,因 COZE_API_KEY 未配置返回 503', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-a'
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/chat/coze/stream',
      body: { botId: 'bot-1', userId: 'user-a', query: 'hi' },
    })
    expect(res.statusCode).toBe(503)
  })
})
