import { describe, it, expect, afterAll, vi } from 'vitest'
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
  },
}))

import { rbacRoutes } from '../src/routes/rbac'

describe('rbac routes', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/roles 未登录返回 401', async () => {
    await server.register(rbacRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({ method: 'GET', url: '/api/roles' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/roles 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/roles',
      body: { name: 'role', displayName: '角色' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/permissions 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/permissions' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/users/:id/roles 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/users/00000000-0000-0000-0000-000000000000/roles',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/rbac/check 未登录返回 401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/rbac/check' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/permissions 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/permissions',
      body: { name: 'test:perm', displayName: '测试权限', resource: 'test', action: 'perm' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/permissions/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/permissions/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })

  it('PATCH /api/permissions/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/permissions/00000000-0000-0000-0000-000000000000',
      body: { displayName: '更新权限' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/permissions/:id 未登录返回 401', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/permissions/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(401)
  })
})
