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

import { agentsRoutes } from '../src/routes/agents'

describe('agents extended routes (M-63)', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/oauth-apps/scopes 未登录返回 401', async () => {
    await server.register(agentsRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/oauth-apps/scopes' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/oauth-apps/:clientId 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/oauth-apps/test-client-id' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/oauth-apps 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/oauth-apps',
      body: { appName: 'test-app', scopes: ['read', 'write'] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/oauth-apps/:clientId 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/oauth-apps/test-client-id',
      body: { appName: 'updated-app' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/oauth-apps/:clientId 未登录返回 401', async () => {
    const res = await server.inject({ method: 'DELETE', url: '/api/oauth-apps/test-client-id' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/oauth-apps/:clientId/regenerate-secret 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/oauth-apps/test-client-id/regenerate-secret',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/settlement/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/settlement/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/settlement/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/settlement/00000000-0000-0000-0000-000000000000',
      body: { status: 'settled' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/agents/need-tasks 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/agents/need-tasks' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/agents/need-tasks/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/agents/need-tasks/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/agents/need-tasks 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/agents/need-tasks',
      body: { title: '测试需求', agentId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/agents/need-tasks/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/agents/need-tasks/00000000-0000-0000-0000-000000000000',
      body: { title: '更新需求' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/agents/need-tasks/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/agents/need-tasks/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })
})
