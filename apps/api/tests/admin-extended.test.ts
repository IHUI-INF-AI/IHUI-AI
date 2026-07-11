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

import { adminExtendedRoutes } from '../src/routes/admin-extended'

describe('admin-extended routes', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/admin/menu 未登录返回 401', async () => {
    await server.register(adminExtendedRoutes, { prefix: '/api/admin' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/admin/menu' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/menu 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/menu',
      body: { name: '测试菜单', path: '/test', sort: 0 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/admin/menu/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/menu/00000000-0000-0000-0000-000000000000',
      body: { name: '更新菜单' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/menu/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/menu/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/demand-audit 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/demand-audit' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/demand-audit/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/demand-audit/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('PUT /api/admin/demand-audit/:id/audit 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/demand-audit/00000000-0000-0000-0000-000000000000/audit',
      body: { status: 'approved', auditComment: '通过' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/online-users 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/online-users' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/online-users/:id/force-logout 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/online-users/00000000-0000-0000-0000-000000000000/force-logout',
    })
    expect(res.statusCode).toBe(401)
  })
})
