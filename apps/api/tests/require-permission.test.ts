import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockCheckPermission } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckPermission: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: mockCheckPermission,
}))

import { requirePermission, requireAuth, requireAdmin } from '../src/plugins/require-permission.js'

describe('require-permission — 权限中间件', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.get('/api/perm', { preHandler: requirePermission('rbac:manage') }, async (_req, reply) =>
      reply.send({ ok: true }),
    )
    server.get('/api/auth-only', { preHandler: requireAuth }, async (_req, reply) =>
      reply.send({ ok: true }),
    )
    server.get('/api/admin-only', { preHandler: requireAdmin }, async (_req, reply) =>
      reply.send({ ok: true }),
    )
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  function setAdmin() {
    mockAuthenticate.mockImplementation(
      async (request: { userId?: string; jwtPayload?: { roleId?: number } }) => {
        request.userId = 'admin-001'
        request.jwtPayload = {
          userId: 'admin-001',
          roleId: 1,
          phone: '13800000001',
          familyId: 'fam-001',
        }
      },
    )
  }

  function setUser(userId = 'user-001') {
    mockAuthenticate.mockImplementation(
      async (request: { userId?: string; jwtPayload?: { roleId?: number } }) => {
        request.userId = userId
        request.jwtPayload = { userId, roleId: 0, phone: '13800000002', familyId: 'fam-002' }
      },
    )
  }

  function setAuthError(message = 'Authentication required') {
    const err = new Error(message)
    ;(err as Error & { statusCode: number }).statusCode = 401
    mockAuthenticate.mockRejectedValue(err)
  }

  describe('requirePermission', () => {
    it('管理员（roleId >= 1）直接放行', async () => {
      setAdmin()
      mockCheckPermission.mockResolvedValue(false)
      const res = await server.inject({ method: 'GET', url: '/api/perm' })
      expect(res.statusCode).toBe(200)
      expect(mockCheckPermission).not.toHaveBeenCalled()
    })

    it('普通用户有权限放行', async () => {
      setUser()
      mockCheckPermission.mockResolvedValue(true)
      const res = await server.inject({ method: 'GET', url: '/api/perm' })
      expect(res.statusCode).toBe(200)
      expect(mockCheckPermission).toHaveBeenCalledWith('user-001', 'rbac:manage')
    })

    it('普通用户无权限返回 403', async () => {
      setUser()
      mockCheckPermission.mockResolvedValue(false)
      const res = await server.inject({ method: 'GET', url: '/api/perm' })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('权限')
    })

    it('未登录返回 401', async () => {
      setAuthError()
      const res = await server.inject({ method: 'GET', url: '/api/perm' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.code).toBe(401)
    })

    it('authenticate 抛非 401 错误时透传 statusCode', async () => {
      const err = new Error('Forbidden')
      ;(err as Error & { statusCode: number }).statusCode = 403
      mockAuthenticate.mockRejectedValue(err)
      const res = await server.inject({ method: 'GET', url: '/api/perm' })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('requireAuth', () => {
    it('已登录放行', async () => {
      setUser()
      const res = await server.inject({ method: 'GET', url: '/api/auth-only' })
      expect(res.statusCode).toBe(200)
    })

    it('未登录返回 401', async () => {
      setAuthError()
      const res = await server.inject({ method: 'GET', url: '/api/auth-only' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('requireAdmin', () => {
    it('管理员放行', async () => {
      setAdmin()
      const res = await server.inject({ method: 'GET', url: '/api/admin-only' })
      expect(res.statusCode).toBe(200)
    })

    it('普通用户返回 403', async () => {
      setUser()
      const res = await server.inject({ method: 'GET', url: '/api/admin-only' })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.code).toBe(403)
      expect(body.message).toContain('管理员')
    })

    it('未登录返回 401', async () => {
      setAuthError()
      const res = await server.inject({ method: 'GET', url: '/api/admin-only' })
      expect(res.statusCode).toBe(401)
    })
  })
})
