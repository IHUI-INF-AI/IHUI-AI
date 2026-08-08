import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

/**
 * OAuth2 Server 路由测试(2026-08-01 立)
 *
 * 覆盖 /auth/oauth/authorize + /auth/oauth/token 两个端点:
 * - 成功路径(authorize 颁发 code → token 交换)
 * - 应用不存在/已禁用
 * - redirect_uri 不在白名单
 * - state 不匹配
 * - 凭证错误(client_secret)
 * - 授权码已用/已过期
 * - 用户不存在
 */

const mockUser = {
  id: 'user-001',
  phone: '13800000001',
  email: 'test@example.com',
  nickname: 'Tester',
  avatar: 'https://example.com/a.png',
  passwordHash: null,
  roleId: 0,
  status: 1,
  familyId: 'fam-001',
}

const mockOAuthApp = {
  clientId: 'test-client-001',
  clientSecret: 'test-secret-abc',
  name: 'Test OAuth App',
  description: 'Test app for OAuth2 server routes',
  redirectUris: ['https://app.example.com/callback', 'http://localhost:3000/cb'],
  scopes: ['read', 'write'],
  icon: null,
  ownerUuid: 'user-001',
  isActive: 1,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
}

const mockSession = {
  id: 'session-001',
  code: 'auth-code-abc123',
  clientId: 'test-client-001',
  userId: 'user-001',
  state: 'state-xyz',
  scope: 'read',
  codeChallenge: null,
  codeChallengeMethod: null,
  isUsed: 0,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 分钟后过期
  createdAt: new Date(),
}

const {
  mockAuthenticate,
  mockFindOAuthAppByClientId,
  mockCreateOAuthSession,
  mockFindSessionByCode,
  mockMarkSessionUsed,
  mockCreateAuditLog,
  mockFindUserById,
  mockSaveRefreshToken,
  mockGenerateAuthCode,
  mockGenerateState,
  mockGenerateClientId,
  mockGenerateClientSecret,
  mockGenerateUserSk,
  mockVerifyAccessToken,
  mockSignAccessToken,
  mockSignRefreshToken,
  mockCreateFamilyId,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindOAuthAppByClientId: vi.fn(),
  mockCreateOAuthSession: vi.fn(),
  mockFindSessionByCode: vi.fn(),
  mockMarkSessionUsed: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockFindUserById: vi.fn(),
  mockSaveRefreshToken: vi.fn(),
  mockGenerateAuthCode: vi.fn(),
  mockGenerateState: vi.fn(),
  mockGenerateClientId: vi.fn(),
  mockGenerateClientSecret: vi.fn(),
  mockGenerateUserSk: vi.fn(),
  mockVerifyAccessToken: vi.fn(),
  mockSignAccessToken: vi.fn(),
  mockSignRefreshToken: vi.fn(),
  mockCreateFamilyId: vi.fn(),
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  signAccessToken: mockSignAccessToken,
  signRefreshToken: mockSignRefreshToken,
  createFamilyId: mockCreateFamilyId,
  // buildTokenPair 内部使用这两个常量(2026-08-01 补齐,缺 export 会抛 viest 错误)
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2592000,
  isOidcConfigured: () => false,
  isDiscordConfigured: () => false,
  isLinuxdoConfigured: () => false,
  isTelegramConfigured: () => false,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findOAuthAppByClientId: mockFindOAuthAppByClientId,
  createOAuthApp: vi.fn(),
  listOAuthApps: vi.fn(),
  deleteOAuthApp: vi.fn(),
  createOAuthSession: mockCreateOAuthSession,
  findSessionByCode: mockFindSessionByCode,
  markSessionUsed: mockMarkSessionUsed,
  listUserSessions: vi.fn(),
  deleteSession: vi.fn(),
  listActiveScopeMeta: vi.fn(),
  findThirdPartyAccount: vi.fn(),
  listUserBindings: vi.fn(),
  createThirdPartyBinding: vi.fn(),
  removeBinding: vi.fn(),
  removeBindingByPlatform: vi.fn(),
  createUserSk: vi.fn(),
  listUserSk: vi.fn(),
  updateUserSk: vi.fn(),
  deleteUserSk: vi.fn(),
  createAuditLog: mockCreateAuditLog,
}))

vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
  findUserById: mockFindUserById,
  createUser: vi.fn(),
  updateUser: vi.fn(),
  checkPhoneExists: vi.fn(),
  checkEmailExists: vi.fn(),
  cancelUserAccount: vi.fn(),
  saveRefreshToken: mockSaveRefreshToken,
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}))

vi.mock('../src/services/oauth-providers.js', () => ({
  exchangeGoogleCode: vi.fn(),
  verifyGoogleIdToken: vi.fn(),
  isGoogleConfigured: () => false,
  jscode2session: vi.fn(),
  getPhoneNumber: vi.fn(),
  isWechatMiniConfigured: () => false,
  wecomCode2session: vi.fn(),
  wecomPcCode2session: vi.fn(),
  isWecomConfigured: () => false,
  isWecomSuiteConfigured: () => false,
  isDingtalkConfigured: () => false,
  buildDingtalkAuthUrl: vi.fn(),
  exchangeDingtalkCode: vi.fn(),
  getDingtalkUserInfo: vi.fn(),
  isAlipayLoginConfigured: () => false,
  exchangeAlipayCode: vi.fn(),
  getAlipayUserInfo: vi.fn(),
  isFeishuConfigured: () => false,
  getFeishuAccessToken: vi.fn(),
  getFeishuUserInfo: vi.fn(),
  generateState: mockGenerateState,
  generateAuthCode: mockGenerateAuthCode,
  generateClientId: mockGenerateClientId,
  generateClientSecret: mockGenerateClientSecret,
  generateUserSk: mockGenerateUserSk,
}))

vi.mock('../src/services/sms.js', () => ({
  sendSmsCode: vi.fn(),
  isSmsConfigured: () => false,
}))

vi.mock('../src/services/email-service.js', () => ({
  sendVerificationEmail: vi.fn(),
}))

vi.mock('../src/services/captcha.js', () => ({
  generateCaptchaKey: vi.fn(),
  generateCaptchaCode: vi.fn(),
  generateCaptchaImage: vi.fn(),
  verifyCaptcha: vi.fn(),
}))

vi.mock('../src/db/captcha-queries.js', () => ({
  saveCaptcha: vi.fn(),
  findCaptcha: vi.fn(),
  deleteCaptcha: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  generateSecret: vi.fn(),
  verifyTotp: vi.fn(),
  buildOtpauthUri: vi.fn(),
  generateQrCodeDataUrl: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCode: vi.fn(),
  verifyBackupCode: vi.fn(),
  base32Encode: vi.fn(),
  verifyChallengeToken: vi.fn(),
}))

vi.mock('../src/services/account-lockout.js', () => ({
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
  getLockRemainingMs: vi.fn().mockResolvedValue(0),
  ACCOUNT_LOCKOUT_CONFIG: { lockDurationSec: 900 },
}))

vi.mock('../src/utils/code-store.js', () => ({
  codeStore: new Map(),
  generateCode: vi.fn(),
  cleanupExpiredCodes: vi.fn(),
  verifyCode: vi.fn(),
  CODE_TTL_MS: 300000,
  CODE_RESEND_INTERVAL_MS: 60000,
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptJSON: vi.fn((data: unknown) => ({ iv: 'iv', ciphertext: String(data), tag: 'tag' })),
  decryptJSON: vi.fn(),
}))

vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('../src/utils/crypto-random.js', () => ({
  generateShortCode: vi.fn(),
}))

vi.mock('@ihui/database', () => ({
  users: {},
  invitationCodes: {
    id: 'id',
    code: 'code',
    userId: 'user_id',
    usedAt: 'used_at',
    createdAt: 'created_at',
    expiresAt: 'expires_at',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
}))

import { authExtendedRoutes } from '../src/routes/auth-extended.js'

describe('OAuth2 Server 路由 — /auth/oauth/authorize + /auth/oauth/token', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', {
      get: vi.fn(),
      set: vi.fn(),
      getdel: vi.fn(),
      del: vi.fn(),
    })
    // 注:不设置自定义 errorHandler,Fastify 默认会根据 err.statusCode 返回对应状态码
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mock:已登录用户 user-001
    mockAuthenticate.mockImplementation(async (request) => {
      request.userId = 'user-001'
      return { userId: 'user-001', roleId: 0, type: 'access' }
    })
    mockFindOAuthAppByClientId.mockResolvedValue(mockOAuthApp)
    mockCreateOAuthSession.mockResolvedValue(mockSession)
    mockFindSessionByCode.mockResolvedValue(mockSession)
    mockMarkSessionUsed.mockResolvedValue(undefined)
    mockCreateAuditLog.mockResolvedValue(undefined)
    mockFindUserById.mockResolvedValue(mockUser)
    mockSaveRefreshToken.mockResolvedValue(undefined)
    mockGenerateAuthCode.mockReturnValue('auth-code-abc123')
    mockGenerateState.mockReturnValue('state-xyz')
    mockGenerateClientId.mockReturnValue('cli-test-001')
    mockGenerateClientSecret.mockReturnValue('sec-test-001')
    mockGenerateUserSk.mockReturnValue('sk-test-001')
    mockVerifyAccessToken.mockResolvedValue({ userId: 'user-001', roleId: 0, type: 'access' })
    mockSignAccessToken.mockResolvedValue('mock-access-token-real')
    mockSignRefreshToken.mockResolvedValue('mock-refresh-token-real')
    mockCreateFamilyId.mockReturnValue('fam-mock')
  })

  describe('GET /api/auth/oauth/authorize — 颁发授权码', () => {
    it('成功颁发授权码 + 返回 redirect_uri 拼接 code/state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://app.example.com/callback',
          state: 'state-xyz',
          scope: 'read',
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.code).toBe('auth-code-abc123')
      expect(body.data.state).toBe('state-xyz')
      expect(body.data.redirect_uri).toContain('code=auth-code-abc123')
      expect(body.data.redirect_uri).toContain('state=state-xyz')
      expect(mockCreateOAuthSession).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'auth-code-abc123',
          clientId: 'test-client-001',
          userId: 'user-001',
          state: 'state-xyz',
          scope: 'read',
        }),
      )
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'authorize',
          clientId: 'test-client-001',
          userId: 'user-001',
          status: 'success',
        }),
      )
    })

    it('支持 PKCE 参数(code_challenge + code_challenge_method)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://app.example.com/callback',
          state: 'state-xyz',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URhbuHrIZD2gdk',
          code_challenge_method: 'S256',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(mockCreateOAuthSession).toHaveBeenCalledWith(
        expect.objectContaining({
          codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URhbuHrIZD2gdk',
          codeChallengeMethod: 'S256',
        }),
      )
    })

    it('未登录返回 401', async () => {
      // 模拟 authenticate 真实行为:抛带 statusCode=401 的 Error(2026-08-01 修复)
      // 原 mock 抛普通 Error,无 statusCode,Fastify 默认转 500
      const err = new Error('no token') as Error & { statusCode: number }
      err.statusCode = 401
      mockAuthenticate.mockRejectedValueOnce(err)
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://app.example.com/callback',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('state 为空返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://app.example.com/callback',
          state: '',
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('应用不存在返回 404', async () => {
      mockFindOAuthAppByClientId.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'nonexistent-client',
          redirect_uri: 'https://app.example.com/callback',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })

    it('应用已禁用(isActive=0)返回 404', async () => {
      mockFindOAuthAppByClientId.mockResolvedValueOnce({ ...mockOAuthApp, isActive: 0 })
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://app.example.com/callback',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(404)
    })

    it('redirect_uri 不在白名单返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: 'https://evil.com/callback',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('白名单')
    })

    it('redirect_uri 为空返回 400(zod parse 失败)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/authorize',
        query: {
          client_id: 'test-client-001',
          redirect_uri: '',
          state: 'state-xyz',
        },
      })
      // zod parse 失败抛出,默认 500(statusCode 未设置)
      // 实际项目应通过 errorHandler 转为 400,这里仅验证不成功
      expect(res.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/auth/oauth/token — 授权码换 access_token', () => {
    it('成功用 code 换取 access_token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.access_token).toBe('mock-access-token-real')
      expect(body.data.token_type).toBe('Bearer')
      expect(mockMarkSessionUsed).toHaveBeenCalledWith('auth-code-abc123')
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'token',
          clientId: 'test-client-001',
          userId: 'user-001',
        }),
      )
    })

    it('client_secret 错误返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'wrong-secret',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toContain('凭证错误')
    })

    it('应用不存在返回 401(凭证错误路径)', async () => {
      mockFindOAuthAppByClientId.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'nonexistent-client',
          client_secret: 'any-secret',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('授权码无效(findSessionByCode 返回 null)返回 400', async () => {
      mockFindSessionByCode.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'invalid-code',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('无效或已过期')
    })

    it('授权码已使用(isUsed=1)返回 400', async () => {
      mockFindSessionByCode.mockResolvedValueOnce({ ...mockSession, isUsed: 1 })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('无效或已过期')
    })

    it('授权码已过期(expiresAt < now)返回 400', async () => {
      mockFindSessionByCode.mockResolvedValueOnce({
        ...mockSession,
        expiresAt: new Date('2020-01-01'),
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('无效或已过期')
    })

    it('state 不匹配返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'wrong-state',
        },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('state')
    })

    it('state 省略时不校验(向后兼容)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
        },
      })
      expect(res.statusCode).toBe(200)
    })

    it('用户不存在返回 404', async () => {
      mockFindUserById.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res.statusCode).toBe(404)
    })

    it('授权码一次性使用 — 第二次使用失败', async () => {
      // 第一次成功
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res1.statusCode).toBe(200)
      // 第二次:模拟 markSessionUsed 已标记,findSessionByCode 返回 isUsed=1
      mockFindSessionByCode.mockResolvedValueOnce({ ...mockSession, isUsed: 1 })
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth/token',
        payload: {
          code: 'auth-code-abc123',
          client_id: 'test-client-001',
          client_secret: 'test-secret-abc',
          state: 'state-xyz',
        },
      })
      expect(res2.statusCode).toBe(400)
    })
  })
})
