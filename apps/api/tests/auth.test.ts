import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  signAccessToken: vi.fn().mockResolvedValue('mock-access'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh'),
  createFamilyId: vi.fn().mockReturnValue('fam-mock'),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
  },
}))

import { authenticate } from '../src/plugins/auth.js'
import type { JWTPayload } from '@ihui/auth'

describe('auth — JWT 认证中间件', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.get('/api/test', async (request, reply) => {
      try {
        const payload = await authenticate(request)
        reply.send({ ok: true, userId: payload.userId, roleId: payload.roleId })
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
        reply.status(statusCode).send({ code: statusCode, message: (e as Error).message })
      }
    })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const mockPayload: JWTPayload = {
    userId: 'user-001',
    roleId: 0,
    phone: '13800000001',
    familyId: 'fam-001',
  }

  describe('authenticate', () => {
    beforeEach(() => {
      mockVerifyAccessToken.mockReset()
      mockVerifyAccessToken.mockRejectedValue(new Error('no token'))
    })

    it('有效 Bearer token 返回 payload', async () => {
      mockVerifyAccessToken.mockResolvedValue(mockPayload)
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer valid-token' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.ok).toBe(true)
      expect(body.userId).toBe('user-001')
    })

    it('设置 request.userId 和 request.jwtPayload', async () => {
      mockVerifyAccessToken.mockResolvedValue(mockPayload)
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer valid-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token')
    })

    it('无 Authorization header 返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/test' })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.message).toContain('Authentication required')
    })

    it('非 Bearer 前缀返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Basic abc123' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('空 Authorization header 返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: '' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('Bearer 后无 token 返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer ' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('verifyAccessToken 抛错返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('token expired'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer expired-token' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.message).toContain('Invalid or expired token')
    })

    it('token 前后空格被 trim', async () => {
      mockVerifyAccessToken.mockResolvedValue(mockPayload)
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer   valid-token   ' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-token')
    })

    it('admin roleId 正确传递', async () => {
      mockVerifyAccessToken.mockResolvedValue({ ...mockPayload, roleId: 1 })
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer admin-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().roleId).toBe(1)
    })
  })
})
