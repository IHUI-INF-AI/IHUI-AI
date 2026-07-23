import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// ---------- 可控 mock ----------
const {
  mockVerifyRefreshToken,
  mockCreateFamilyId,
  mockIssueTokenPair,
  mockAuthenticate,
  mockFindUserByPhone,
  mockFindUserByAccount,
  mockFindUserById,
  mockCreateUser,
  mockUpdateUser,
  mockFindRefreshToken,
  mockRevokeRefreshToken,
  mockRevokeRefreshTokenFamily,
  mockIsSystemAdminUser,
  mockGetUserPermissions,
  mockGetLockRemainingMs,
  mockRecordLoginFailure,
  mockClearLoginFailures,
} = vi.hoisted(() => ({
  mockVerifyRefreshToken: vi.fn(),
  mockCreateFamilyId: vi.fn(),
  mockIssueTokenPair: vi.fn(),
  mockAuthenticate: vi.fn(),
  mockFindUserByPhone: vi.fn(),
  mockFindUserByAccount: vi.fn(),
  mockFindUserById: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockFindRefreshToken: vi.fn(),
  mockRevokeRefreshToken: vi.fn(),
  mockRevokeRefreshTokenFamily: vi.fn(),
  mockIsSystemAdminUser: vi.fn(),
  mockGetUserPermissions: vi.fn(),
  mockGetLockRemainingMs: vi.fn(),
  mockRecordLoginFailure: vi.fn(),
  mockClearLoginFailures: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyRefreshToken: mockVerifyRefreshToken,
  createFamilyId: mockCreateFamilyId,
  signAccessToken: vi.fn().mockResolvedValue('access'),
  signRefreshToken: vi.fn().mockResolvedValue('refresh'),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/services/token-service.js', () => ({
  issueTokenPair: mockIssueTokenPair,
}))

vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: mockFindUserByPhone,
  findUserByAccount: mockFindUserByAccount,
  findUserById: mockFindUserById,
  createUser: mockCreateUser,
  updateUser: mockUpdateUser,
  cancelUserAccount: vi.fn(),
  findRefreshToken: mockFindRefreshToken,
  revokeRefreshToken: mockRevokeRefreshToken,
  revokeRefreshTokenFamily: mockRevokeRefreshTokenFamily,
  isSystemAdminUser: mockIsSystemAdminUser,
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: mockGetUserPermissions,
  checkPermission: vi.fn(),
}))

vi.mock('../src/db/promotion-queries.js', () => ({
  findInvitationByCode: vi.fn().mockResolvedValue(null),
  markInvitationUsed: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn() }))

vi.mock('../src/services/account-lockout.js', () => ({
  recordLoginFailure: mockRecordLoginFailure,
  clearLoginFailures: mockClearLoginFailures,
  getLockRemainingMs: mockGetLockRemainingMs,
  ACCOUNT_LOCKOUT_CONFIG: { lockDurationSec: 900, maxFailures: 5 },
}))

vi.mock('../src/services/oauth-providers.js', () => ({
  jscode2session: vi.fn(),
  isWechatMiniConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
  listOAuthApps: vi.fn(),
  findAuditLogList: vi.fn(),
  findAuditLogStats: vi.fn(),
  findOAuthAppByClientId: vi.fn(),
  createOAuthApp: vi.fn(),
  updateOAuthApp: vi.fn(),
  deleteOAuthApp: vi.fn(),
  regenerateOAuthAppSecret: vi.fn(),
  listActiveScopeMeta: vi.fn(),
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn().mockResolvedValue({ list: [] }),
  upsertUserPreference: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  signChallengeToken: vi.fn().mockResolvedValue('challenge-token'),
  CHALLENGE_TOKEN_TTL_SECONDS: 300,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

import { authRoutes } from '../src/routes/auth.js'
import { codeStore } from '../src/utils/code-store.js'

const NOW = new Date('2026-07-23T00:00:00Z')

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-001',
    phone: '13800000001',
    email: 'u1@example.com',
    username: 'tester',
    nickname: 'tester',
    avatar: '',
    bio: '',
    gender: 0,
    birthday: '',
    familyId: 'fam-001',
    roleId: 0,
    status: 1,
    isVip: 0,
    level: 0,
    inviteCode: '',
    parentId: '',
    passwordHash: '',
    twoFactorEnabled: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function tokenPair() {
  return { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 3600 }
}

describe('auth routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // login 路由依赖 server.riskEngine.evaluateRisk
    app.decorate('riskEngine', {
      evaluateRisk: vi.fn().mockReturnValue({ action: 'ALLOW', hits: 0 }),
    } as never)
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    codeStore.clear()
    // 默认鉴权失败(401)
    mockAuthenticate.mockImplementation(() => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    mockGetLockRemainingMs.mockResolvedValue(0)
    mockRecordLoginFailure.mockResolvedValue(4)
    mockClearLoginFailures.mockResolvedValue(undefined)
    mockIsSystemAdminUser.mockResolvedValue(false)
    mockGetUserPermissions.mockResolvedValue([])
    mockCreateFamilyId.mockReturnValue('fam-mock')
    mockIssueTokenPair.mockResolvedValue(tokenPair())
  })

  describe('POST /api/auth/send-code', () => {
    it('手机号格式不正确返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/send-code',
        payload: { phone: '123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('合法手机号返回 200 并在 dev 模式返回 code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/send-code',
        payload: { phone: '13800000001', scene: 'register' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.sent).toBe(true)
      expect(body.data.code).toMatch(/^\d{6}$/)
    })

    it('60 秒内重发返回 429', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/send-code',
        payload: { phone: '13900000000' },
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/send-code',
        payload: { phone: '13900000000' },
      })
      expect(res.statusCode).toBe(429)
      expect(res.json().message).toContain('60 秒')
    })
  })

  describe('POST /api/auth/reset-password', () => {
    it('参数校验失败(密码过短)返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { phone: '13800000001', code: '123456', newPassword: 'short' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('验证码错误返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { phone: '13800000001', code: '000000', newPassword: 'newpass12' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('验证码错误')
    })

    it('用户不存在返回 404', async () => {
      codeStore.set('13800000001', {
        code: '123456',
        expiresAt: Date.now() + 60000,
        sentAt: Date.now(),
      })
      mockFindUserByPhone.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { phone: '13800000001', code: '123456', newPassword: 'newpass12' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('系统管理员密码不可重置返回 403', async () => {
      codeStore.set('13800000001', {
        code: '123456',
        expiresAt: Date.now() + 60000,
        sentAt: Date.now(),
      })
      mockFindUserByPhone.mockResolvedValueOnce(makeUser({ id: 'admin' }))
      mockIsSystemAdminUser.mockResolvedValueOnce(true)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { phone: '13800000001', code: '123456', newPassword: 'newpass12' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('重置成功返回 200 并删除验证码', async () => {
      codeStore.set('13800000001', {
        code: '123456',
        expiresAt: Date.now() + 60000,
        sentAt: Date.now(),
      })
      mockFindUserByPhone.mockResolvedValueOnce(makeUser())
      mockUpdateUser.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { phone: '13800000001', code: '123456', newPassword: 'newpass12' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.reset).toBe(true)
      expect(mockUpdateUser).toHaveBeenCalled()
      // 验证码一次性使用
      expect(codeStore.has('13800000001')).toBe(false)
    })
  })

  describe('POST /api/auth/register', () => {
    it('参数校验失败(密码过短)返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { phone: '13800000001', password: '123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('手机号已注册返回 409', async () => {
      mockFindUserByPhone.mockResolvedValueOnce(makeUser())
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { phone: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().message).toContain('已注册')
    })

    it('注册成功返回 200 与 token + user', async () => {
      mockFindUserByPhone.mockResolvedValueOnce(null)
      mockCreateUser.mockResolvedValueOnce(makeUser())
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { phone: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBe('access-token')
      expect(body.data.user.id).toBe('user-001')
      expect(mockCreateUser).toHaveBeenCalled()
    })
  })

  describe('POST /api/auth/login', () => {
    it('参数校验失败(空账号)返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '', password: 'x' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('账号锁定返回 429', async () => {
      mockGetLockRemainingMs.mockResolvedValueOnce(60000)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(429)
      expect(res.headers['retry-after']).toBeTruthy()
    })

    it('用户不存在返回 401', async () => {
      mockFindUserByAccount.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('用户不存在或密码错误')
    })

    it('密码错误返回 401 并记录失败', async () => {
      mockFindUserByAccount.mockResolvedValueOnce(
        makeUser({ passwordHash: await bcrypt.hash('correct', 10) }),
      )
      mockRecordLoginFailure.mockResolvedValueOnce(4)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '13800000001', password: 'wrongpass' },
      })
      expect(res.statusCode).toBe(401)
      expect(mockRecordLoginFailure).toHaveBeenCalled()
    })

    it('账号被禁用返回 403', async () => {
      mockFindUserByAccount.mockResolvedValueOnce(
        makeUser({ passwordHash: await bcrypt.hash('pass1234', 10), status: 0 }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('禁用')
    })

    it('登录成功返回 200 与 token + user', async () => {
      mockFindUserByAccount.mockResolvedValueOnce(
        makeUser({ passwordHash: await bcrypt.hash('pass1234', 10) }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { account: '13800000001', password: 'pass1234' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBe('access-token')
      expect(body.data.user.id).toBe('user-001')
      expect(mockClearLoginFailures).toHaveBeenCalled()
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('参数校验失败(空 token)返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: '' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('refresh token 签名无效返回 401', async () => {
      mockVerifyRefreshToken.mockRejectedValueOnce(new Error('expired'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'bad-token' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('Invalid refresh token')
    })

    it('refresh token 已吊销返回 401', async () => {
      mockVerifyRefreshToken.mockResolvedValueOnce({
        userId: 'user-001',
        familyId: 'fam-1',
      })
      mockFindRefreshToken.mockResolvedValueOnce({ revokedAt: NOW })
      mockRevokeRefreshTokenFamily.mockResolvedValueOnce(2)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'revoked-token' },
      })
      expect(res.statusCode).toBe(401)
      // 重用检测:吊销整个 family
      expect(mockRevokeRefreshTokenFamily).toHaveBeenCalledWith('fam-1')
    })

    it('用户不存在或被禁用返回 401', async () => {
      mockVerifyRefreshToken.mockResolvedValueOnce({
        userId: 'user-001',
        familyId: 'fam-1',
      })
      mockFindRefreshToken.mockResolvedValueOnce({ revokedAt: null })
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'valid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('刷新成功返回 200 与新 token', async () => {
      mockVerifyRefreshToken.mockResolvedValueOnce({
        userId: 'user-001',
        familyId: 'fam-1',
      })
      mockFindRefreshToken.mockResolvedValueOnce({ revokedAt: null })
      mockFindUserById.mockResolvedValueOnce(makeUser())
      mockRevokeRefreshToken.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'valid-token' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBe('access-token')
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith('valid-token')
    })
  })

  describe('GET /api/auth/me', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
      expect(res.statusCode).toBe(401)
    })

    it('用户不存在返回 404', async () => {
      mockAuthenticate.mockImplementationOnce((request: { userId?: string; jwtPayload?: unknown }) => {
        request.userId = 'user-001'
        request.jwtPayload = { userId: 'user-001', roleId: 0 } as never
        return Promise.resolve(request.jwtPayload)
      })
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('登录用户返回 200 与 user 信息', async () => {
      mockAuthenticate.mockImplementationOnce((request: { userId?: string; jwtPayload?: unknown }) => {
        request.userId = 'user-001'
        request.jwtPayload = { userId: 'user-001', roleId: 0 } as never
        return Promise.resolve(request.jwtPayload)
      })
      mockFindUserById.mockResolvedValueOnce(makeUser())
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.user.id).toBe('user-001')
      expect(body.data.user.permissions).toEqual([])
    })
  })

  describe('POST /api/auth/logout', () => {
    it('参数校验失败(空 token)返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: { refreshToken: '' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('未找到 token 记录仍返回 200(幂等退出)', async () => {
      mockFindRefreshToken.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: { refreshToken: 'unknown-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.revoked).toBe(true)
      expect(mockRevokeRefreshToken).not.toHaveBeenCalled()
    })

    it('有效 token 吊销成功返回 200', async () => {
      mockFindRefreshToken.mockResolvedValueOnce({ revokedAt: null })
      mockRevokeRefreshToken.mockResolvedValueOnce(undefined)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        payload: { refreshToken: 'valid-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith('valid-token')
    })
  })
})
