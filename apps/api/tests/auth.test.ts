// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  signAccessToken: vi.fn().mockResolvedValue('mock-access'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh'),
  createFamilyId: vi.fn().mockReturnValue('fam-mock'),
}))

// P2-14 fix:authenticate 调用 getUserStatus 查询用户状态,需 mock 返回 active
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
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

    // 票 G-396 / G-765 / G-357(机主拍板 2026-10-07)把这一格拆成两条:原用例用
    // `new Error('token expired')` 表达"token 过期",而未标注任何身份 —— 那与"驱动/依赖
    // 故障"在代码里同形,于是服务端故障会被端上读成"你要重新登录"。收紧后:
    // 真会话失效必须带 jose 的 code 才继续占 401,没身份标识的异常改 502 + 独立 errorCode。
    it('真过期(jose ERR_JWT_EXPIRED)仍返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(
        Object.assign(new Error('token expired'), { code: 'ERR_JWT_EXPIRED' }),
      )
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer expired-token' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.message).toContain('Invalid or expired token')
    })

    it('verifyAccessToken 抛无名异常(依赖故障)返回 502,不再冒充会话死亡', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('connection refused to db:5432'))
      const res = await server.inject({
        method: 'GET',
        url: '/api/test',
        headers: { authorization: 'Bearer whatever-token' },
      })
      expect(res.statusCode).toBe(502)
      // 原文只进日志:响应体里不得出现驱动/连接故障的措辞(O17 脱敏纪律)
      expect(JSON.stringify(res.json())).not.toContain('connection refused')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
