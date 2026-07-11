import { describe, it, expect, afterAll, vi } from 'vitest'
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

import { behaviorRoutes } from '../src/routes/behavior'

describe('behavior extended routes (M-63)', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('POST /api/behavior/favorite 未登录返回 401', async () => {
    await server.register(behaviorRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/api/behavior/favorite',
      body: { topicId: '00000000-0000-0000-0000-000000000000', topicType: 'article' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/behavior/favorite 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/behavior/favorite',
      body: { topicId: '00000000-0000-0000-0000-000000000000', topicType: 'article' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/behavior/favorite/check 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/behavior/favorite/check?topicId=00000000-0000-0000-0000-000000000000&topicType=article',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/behavior/favorite/list 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/behavior/favorite/list' })
    expect(res.statusCode).toBe(401)
  })
})
