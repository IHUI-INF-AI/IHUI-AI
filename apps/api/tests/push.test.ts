import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

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
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../src/services/push-provider.js', () => ({
  detectPushProvider: vi.fn(() => 'stub'),
  sendPushBatch: vi
    .fn()
    .mockResolvedValue([{ provider: 'stub', success: true, messageId: 'stub-1' }]),
}))

import { pushRoutes, adminPushRoutes } from '../src/routes/push'

describe('push routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(pushRoutes, { prefix: '/api' })
    await server.register(adminPushRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/push/provider 公开端点返回 200 + provider=stub', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/push/provider' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.provider).toBe('stub')
  })

  it('POST /api/push/devices/register 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/push/devices/register',
      body: { deviceToken: 'token-abc' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/push/devices/unregister 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/push/devices/unregister',
      body: { deviceToken: 'token-abc' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/push/send 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      body: { title: 't', body: 'b', tokens: ['t1'] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/push/devices 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/push/devices' })
    expect(res.statusCode).toBe(401)
  })
})
