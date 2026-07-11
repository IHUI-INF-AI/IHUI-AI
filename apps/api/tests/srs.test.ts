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

import { srsRoutes } from '../src/routes/srs'

describe('SRS routes (M-85)', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/srs/streams 未登录返回 401', async () => {
    await server.register(srsRoutes, { prefix: '/api/srs' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/srs/streams' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/srs/streams/:key 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/srs/streams/test-key' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/srs/streams 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/srs/streams',
      body: { title: '测试直播流' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/srs/streams/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/srs/streams/00000000-0000-0000-0000-000000000000',
      body: { title: '更新标题' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/srs/streams/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/srs/streams/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/srs/streams/:key/kick 未登录返回 401', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/srs/streams/test-key/kick' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/srs/streams/:key/status 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/srs/streams/test-key/status' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/srs/servers 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/srs/servers' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/srs/servers 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/srs/servers',
      body: { name: 'SRS-1', host: '127.0.0.1' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/srs/servers/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/srs/servers/00000000-0000-0000-0000-000000000000',
      body: { name: 'SRS-Updated' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/srs/servers/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/srs/servers/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/srs/servers/:id/health 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/srs/servers/00000000-0000-0000-0000-000000000000/health',
    })
    expect(res.statusCode).toBe(401)
  })
})
