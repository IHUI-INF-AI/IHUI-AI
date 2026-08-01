import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockVerifyAccessToken, mockVerifyRefreshToken, mockUser, mockPermissions, mockTokenPair } =
  vi.hoisted(() => ({
    mockVerifyAccessToken: vi.fn(),
    mockVerifyRefreshToken: vi.fn(),
    mockUser: {
      id: 'user-001',
      phone: '13800000001',
      email: 'test@example.com',
      nickname: 'Tester',
      avatar: 'https://example.com/a.png',
      passwordHash: null,
      roleId: 0,
      status: 1,
      familyId: 'fam-001',
    },
    mockPermissions: ['read:courses', 'write:notes'],
    mockTokenPair: {
      accessToken: 'real-access-token-abc123',
      refreshToken: 'real-refresh-token-xyz789',
      expiresIn: 3600,
    },
  }))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  verifyRefreshToken: mockVerifyRefreshToken,
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token-real'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token-real'),
  createFamilyId: vi.fn().mockReturnValue('fam-mock'),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
  },
}))

const {
  mockFindUserById,
  mockRevokeAllUserRefreshTokens,
  mockFindRefreshToken,
  mockRevokeRefreshToken,
  mockGetUserPermissions,
  mockIssueTokenPair,
} = vi.hoisted(() => ({
  mockFindUserById: vi.fn(),
  mockRevokeAllUserRefreshTokens: vi.fn(),
  mockFindRefreshToken: vi.fn(),
  mockRevokeRefreshToken: vi.fn(),
  mockGetUserPermissions: vi.fn(),
  mockIssueTokenPair: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mockFindUserById,
  revokeAllUserRefreshTokens: mockRevokeAllUserRefreshTokens,
  findRefreshToken: mockFindRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: mockGetUserPermissions,
}))

vi.mock('../src/services/token-service.js', () => ({
  issueTokenPair: mockIssueTokenPair,
}))

const redisStore = new Map<string, string>()
const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  getdel: vi.fn(async (k: string) => {
    const v = redisStore.get(k)
    if (v) {
      redisStore.delete(k)
      return v
    }
    return null
  }),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v)
    return 'OK'
  }),
}

import { authSsoRoutes } from '../src/routes/auth-sso.js'
import responseSanitizerPlugin from '../src/plugins/response-sanitizer.js'

const mockPayload = {
  userId: 'user-001',
  phone: '13800000001',
  roleId: 0,
  familyId: 'fam-001',
}

describe('auth-sso — SSO 4 端点 + skipResponseSanitization', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 注入 mock redis(模拟 server.decorate('redis', ...))
    app.decorate('redis', mockRedis)
    // 注册真实 response-sanitizer,用于验证 skipResponseSanitization 实际生效
    await app.register(responseSanitizerPlugin)
    await app.register(authSsoRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    redisStore.clear()
    mockVerifyAccessToken.mockReset()
    mockVerifyAccessToken.mockResolvedValue(mockPayload)
    mockVerifyRefreshToken.mockReset()
    mockVerifyRefreshToken.mockResolvedValue(mockPayload)
    mockFindUserById.mockReset()
    mockFindUserById.mockResolvedValue(mockUser)
    mockRevokeAllUserRefreshTokens.mockReset()
    mockRevokeAllUserRefreshTokens.mockResolvedValue(undefined)
    mockFindRefreshToken.mockReset()
    mockFindRefreshToken.mockResolvedValue({
      token: 'real-refresh-token-xyz789',
      userId: 'user-001',
      familyId: 'fam-001',
      revokedAt: null,
    })
    mockRevokeRefreshToken.mockReset()
    mockRevokeRefreshToken.mockResolvedValue(undefined)
    mockGetUserPermissions.mockReset()
    mockGetUserPermissions.mockResolvedValue(mockPermissions)
    mockIssueTokenPair.mockReset()
    mockIssueTokenPair.mockResolvedValue(mockTokenPair)
  })

  describe('POST /api/auth/sso/code — 生成一次性授权码', () => {
    it('成功生成 30 秒一次性 code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'miniapp', redirectUri: '/dashboard' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.code).toMatch(/^[A-Za-z0-9_-]+$/) // base64url
      expect(body.data.redirectUri).toBe('/dashboard')
      expect(body.data.expiresIn).toBe(30)
      // redis 中已存储
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^sso:code:/),
        expect.any(String),
        'EX',
        30,
      )
    })

    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('no token'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        payload: { clientId: 'miniapp', redirectUri: '/dashboard' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('redirectUri 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 协议相对路径(//)被拒(防 open redirect)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'miniapp', redirectUri: '//evil.com' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 绝对 URL 被拒(必须以 / 开头)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'miniapp', redirectUri: 'https://evil.com' },
      })
      expect(res.statusCode).toBe(400)
    })

    // === 2026-08-01 新增:跨端 redirectUri 扩展(localhost + 配置化 origins)===

    it('redirectUri localhost(http://localhost:1738/callback)通过(CLI 本地回调服务器)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'cli', redirectUri: 'http://localhost:1738/callback' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.redirectUri).toBe('http://localhost:1738/callback')
    })

    it('redirectUri 127.0.0.1 通过(loopback 地址)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'cli', redirectUri: 'http://127.0.0.1:1738/cb' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('redirectUri 非 loopback IP 被拒(防外网回调)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'cli', redirectUri: 'http://192.168.1.1:1738/cb' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 0.0.0.0 被拒(仅允许 loopback)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'cli', redirectUri: 'http://0.0.0.0:1738/cb' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 非允许 origin 的 https URL 被拒', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'ext', redirectUri: 'https://evil.com/cb' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri javascript: scheme 被拒(防 XSS)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'ext', redirectUri: 'javascript:alert(1)' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri data: scheme 被拒', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'ext', redirectUri: 'data:text/html,<script>alert(1)</script>' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 含控制字符被拒(防 CRLF 注入)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'ext', redirectUri: '/cb\r\nSet-Cookie: evil=1' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('redirectUri 超长(>2048)被拒', async () => {
      const longUri = '/' + 'a'.repeat(2048)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'ext', redirectUri: longUri },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/sso/exchange — code 换 token', () => {
    async function seedCode(clientId = 'miniapp', redirectUri = '/dashboard') {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId, redirectUri },
      })
      return res.json().data.code as string
    }

    it('成功用 code 换取 accessToken + refreshToken', async () => {
      const code = await seedCode()
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.accessToken).toBe('real-access-token-abc123')
      expect(body.data.refreshToken).toBe('real-refresh-token-xyz789')
      expect(body.data.expiresIn).toBe(3600)
      expect(body.data.refreshExpiresIn).toBe(30 * 24 * 60 * 60)
      expect(body.data.user.id).toBe('user-001')
      expect(body.data.user.permissions).toEqual(['read:courses', 'write:notes'])
    })

    it('无效/过期 code 返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code: 'nonexistent-code', clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('无效或已过期')
    })

    it('code 一次性使用(getdel 原子取出)— 第二次使用失败', async () => {
      const code = await seedCode()
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res1.statusCode).toBe(200)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res2.statusCode).toBe(401)
    })

    it('clientId 不匹配返回 401', async () => {
      const code = await seedCode('miniapp')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'admin-panel' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('clientId 不匹配')
    })

    it('用户已被禁用返回 403', async () => {
      // 整个测试期间:findUserById 一致返回禁用用户
      mockFindUserById.mockImplementation(async () => ({ ...mockUser, status: 0 }))
      const code = await seedCode()
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('已被禁用')
    })

    it('用户不存在返回 404', async () => {
      // 先用正常用户生成 code,然后在 exchange 时切换为 null
      const code = await seedCode()
      mockFindUserById.mockImplementation(async () => null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // === 2026-08-01 新增:/sso/refresh 端点测试 ===
  describe('POST /api/auth/sso/refresh — 刷新 token(轮换)', () => {
    it('成功刷新并轮换 refresh token(旧 token 吊销,新 token 颁发)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'real-refresh-token-xyz789' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.accessToken).toBe('real-access-token-abc123')
      expect(body.data.refreshToken).toBe('real-refresh-token-xyz789')
      expect(body.data.expiresIn).toBe(3600)
      expect(body.data.refreshExpiresIn).toBe(30 * 24 * 60 * 60)
      expect(body.data.user.id).toBe('user-001')
      expect(body.data.user.permissions).toEqual(['read:courses', 'write:notes'])
      // 旧 token 被吊销
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith('real-refresh-token-xyz789')
    })

    it('refreshToken 缺失返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('refreshToken 签名无效/过期返回 401', async () => {
      mockVerifyRefreshToken.mockRejectedValueOnce(new Error('jwt expired'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'invalid-token' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('无效或已过期')
    })

    it('refreshToken 已被吊销(库中查不到)返回 401', async () => {
      mockFindRefreshToken.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'revoked-token' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('已被吊销')
    })

    it('refreshToken 已被标记 revokedAt 返回 401', async () => {
      mockFindRefreshToken.mockResolvedValueOnce({
        token: 'revoked-token',
        userId: 'user-001',
        familyId: 'fam-001',
        revokedAt: new Date('2026-07-01'),
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'revoked-token' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('已被吊销')
    })

    it('用户不存在返回 404', async () => {
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'real-refresh-token-xyz789' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('用户已被禁用返回 403', async () => {
      mockFindUserById.mockResolvedValueOnce({ ...mockUser, status: 0 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'real-refresh-token-xyz789' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('已被禁用')
    })

    it('admin 用户(roleId>=1)刷新返回通配权限 *:*:* — 不调用 getUserPermissions', async () => {
      mockFindUserById.mockResolvedValueOnce({ ...mockUser, roleId: 1 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'real-refresh-token-xyz789' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.user.permissions).toEqual(['*:*:*'])
      expect(mockGetUserPermissions).not.toHaveBeenCalled()
    })

    it('刷新响应 token 不被脱敏(skipResponseSanitization 旁路)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/refresh',
        payload: { refreshToken: 'real-refresh-token-xyz789' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBe('real-access-token-abc123')
      expect(body.data.accessToken).not.toBe('***')
      expect(body.data.refreshToken).toBe('real-refresh-token-xyz789')
      expect(body.data.refreshToken).not.toBe('***')
    })
  })

  describe('POST /api/auth/sso/logout — 统一登出', () => {
    it('成功吊销所有 refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/logout',
        headers: { authorization: 'Bearer valid-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.loggedOut).toBe(true)
      expect(mockRevokeAllUserRefreshTokens).toHaveBeenCalledWith('user-001')
    })

    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('no token'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/logout',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /api/auth/sso/validate — 验证 token 有效性', () => {
    it('有效 token 返回用户信息 + permissions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/sso/validate',
        headers: { authorization: 'Bearer valid-token' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.valid).toBe(true)
      expect(body.data.user.id).toBe('user-001')
      expect(body.data.user.permissions).toEqual(['read:courses', 'write:notes'])
    })

    it('未登录返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('no token'))
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/sso/validate',
      })
      expect(res.statusCode).toBe(401)
    })

    it('用户不存在返回 404', async () => {
      mockFindUserById.mockImplementation(async () => null)
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/sso/validate',
        headers: { authorization: 'Bearer valid-token' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('skipResponseSanitization 旁路生效验证(核心安全断言)', () => {
    it('exchange 响应中 accessToken / refreshToken 不被脱敏为 ***', async () => {
      // 生成 code
      const codeRes = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'miniapp', redirectUri: '/dashboard' },
      })
      const code = codeRes.json().data.code as string

      // 注册了真实 response-sanitizer;若旁路失效,token 会被脱敏为 ***
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'miniapp' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBe('real-access-token-abc123')
      expect(body.data.accessToken).not.toBe('***')
      expect(body.data.refreshToken).toBe('real-refresh-token-xyz789')
      expect(body.data.refreshToken).not.toBe('***')
    })

    it('未设置旁路时(对照组)— token 字段会被脱敏', async () => {
      // 构造一个未设置 skipResponseSanitization 的对照端点
      const ctrl = Fastify({ logger: false })
      await ctrl.register(responseSanitizerPlugin)
      ctrl.get('/ctrl/token', async (_req, reply) => {
        return reply.send({
          code: 0,
          data: {
            accessToken: 'should-be-masked-abc',
            refreshToken: 'should-be-masked-xyz',
            public: 'visible',
          },
        })
      })
      await ctrl.ready()
      const res = await ctrl.inject({ method: 'GET', url: '/ctrl/token' })
      const body = res.json()
      // 对照组:未旁路,token 字段被脱敏
      expect(body.data.accessToken).toBe('***')
      expect(body.data.refreshToken).toBe('***')
      expect(body.data.public).toBe('visible')
      await ctrl.close()
    })
  })

  describe('admin 用户权限解析', () => {
    it('roleId >= 1 返回通配权限 *:*:* — 不调用 getUserPermissions', async () => {
      // 整个测试期间:findUserById 一致返回 admin 用户
      mockFindUserById.mockImplementation(async () => ({ ...mockUser, roleId: 1 }))
      const codeRes = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/code',
        headers: { authorization: 'Bearer valid-token' },
        payload: { clientId: 'admin-panel', redirectUri: '/admin' },
      })
      const code = codeRes.json().data.code as string

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sso/exchange',
        payload: { code, clientId: 'admin-panel' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.user.permissions).toEqual(['*:*:*'])
      expect(mockGetUserPermissions).not.toHaveBeenCalled()
    })
  })
})
