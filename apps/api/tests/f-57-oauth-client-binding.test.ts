/**
 * F-57:授权码 / 刷新令牌必须与客户端绑定(RFC 6749 §4.1.3 / §6)。
 *
 * 缺陷面:
 *  1. `/oauth/web/token`、`/oauth/access_token`、`/oauth/token/exchange` 三个兼容换取端点
 *     拿到 session 后只判 isUsed / expiresAt,不判 `session.clientId` 是否等于本次认证通过的
 *     客户端 —— 甲客户端可以拿乙客户端的授权码换出 token(session 一旦被消费,真正的客户端
 *     反而作废)。
 *  2. `/oauth/token/exchange` 的 refresh 分支直接 rotate,未 authenticateOAuthClient ——
 *     任何匿名调用方都能拿别人的 refresh token 续期。
 *
 * 本套件把"session / 令牌行"显式建模成 mock 返回,不连真实 DB/Redis:
 *  - 绑定判据的正确性(同客户端 200 / 跨客户端 400 且不签发、不消费授权码)
 *  - refresh 分支的客户端认证(缺失/错误凭证 401,公开客户端免 secret 仍可用)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type { Redis } from 'ioredis'
import { PUBLIC_CLIENT_SECRET, signRefreshToken } from '@ihui/auth'

const dbMocks = vi.hoisted(() => ({
  claimAuthorizationCode: vi.fn(),
  findSessionByCode: vi.fn(),
  markSessionUsed: vi.fn(),
  findOAuthAppByClientId: vi.fn(),
  createAuditLog: vi.fn(),
  findUserById: vi.fn(),
  saveRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
}))

vi.mock('../src/db/oauth-token-queries.js', () => ({
  claimAuthorizationCode: dbMocks.claimAuthorizationCode,
  claimRefreshToken: vi.fn(),
  revokeFamilyByFamilyId: vi.fn(),
  countActiveTokensInFamily: vi.fn(async () => 0),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findOAuthAppByClientId: dbMocks.findOAuthAppByClientId,
  createOAuthSession: vi.fn(),
  findSessionByCode: dbMocks.findSessionByCode,
  markSessionUsed: dbMocks.markSessionUsed,
  createAuditLog: dbMocks.createAuditLog,
  listActiveScopeMeta: vi.fn(async () => []),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: dbMocks.findUserById,
  saveRefreshToken: dbMocks.saveRefreshToken,
  findRefreshToken: dbMocks.findRefreshToken,
  revokeRefreshToken: dbMocks.revokeRefreshToken,
  revokeRefreshTokenFamily: dbMocks.revokeRefreshTokenFamily,
}))

vi.mock('../src/db/index.js', () => ({ db: {} }))

vi.mock('../src/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
    PUBLIC_BASE_URL: '',
    OAUTH_ISSUER: '',
    OAUTH_REQUIRE_PKCE: false,
    OAUTH_ALLOW_PUBLIC_WITHOUT_SECRET: false,
    OAUTH_M2M_TOKEN_TTL_SECONDS: 900,
    CORS_ORIGIN: 'https://web.example.com',
    PORT: 8802,
    REDIS_URL: 'redis://127.0.0.1:6399/1',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

import { authExtendedRoutes } from '../src/routes/auth-extended.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const FAMILY_ID = '22222222-2222-4222-8222-222222222222'
const CODE = 'f57-auth-code-001'

function appRow(clientId: string, clientSecret: string) {
  return {
    id: `app-row-${clientId}`,
    clientId,
    clientSecret,
    clientSecretHash: null,
    name: `App ${clientId}`,
    redirectUris: ['https://app.example.com/callback'],
    scopes: ['read'],
    isActive: 1,
    ownerUuid: USER_ID,
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
  }
}

const appA = appRow('client-a', 'secret-a')
const appB = appRow('client-b', 'secret-b')
const publicApp = appRow('client-pub', PUBLIC_CLIENT_SECRET)

const mockUser = {
  id: USER_ID,
  phone: '13800000001',
  roleId: 0,
  familyId: FAMILY_ID,
  status: 1,
}

function sessionRow(clientId: string) {
  return {
    code: CODE,
    clientId,
    userId: USER_ID,
    state: null,
    scope: 'read',
    isUsed: false,
    codeChallenge: null,
    codeChallengeMethod: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  }
}

describe('F-57 · 授权码/刷新令牌客户端绑定', () => {
  let app: FastifyInstance
  let refreshToken: string

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    app.decorate('redis', {
      get: vi.fn(),
      set: vi.fn(),
      getdel: vi.fn(),
      del: vi.fn(),
    } as unknown as Redis)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
    refreshToken = await signRefreshToken({
      userId: USER_ID,
      phone: mockUser.phone,
      familyId: FAMILY_ID,
      roleId: 0,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.findOAuthAppByClientId.mockImplementation(async (clientId: string) => {
      if (clientId === appA.clientId) return appA
      if (clientId === appB.clientId) return appB
      if (clientId === publicApp.clientId) return publicApp
      return null
    })
    dbMocks.claimAuthorizationCode.mockResolvedValue(null)
    dbMocks.findSessionByCode.mockResolvedValue(null)
    dbMocks.markSessionUsed.mockResolvedValue(true)
    dbMocks.createAuditLog.mockResolvedValue(undefined)
    dbMocks.findUserById.mockResolvedValue(mockUser)
    dbMocks.saveRefreshToken.mockResolvedValue(undefined)
    dbMocks.findRefreshToken.mockResolvedValue(null)
    dbMocks.revokeRefreshToken.mockResolvedValue(undefined)
    dbMocks.revokeRefreshTokenFamily.mockResolvedValue(undefined)
  })

  describe('/api/oauth/web/token', () => {
    it('授权码属于别的客户端 → 400,不签发也不落 refresh token', async () => {
      dbMocks.claimAuthorizationCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/web/token',
        payload: { code: CODE, client_id: appB.clientId, client_secret: 'secret-b' },
      })

      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toContain('授权码与 client_id 不匹配')
      expect(body.data).toBeUndefined()
      expect(dbMocks.findUserById).not.toHaveBeenCalled()
      expect(dbMocks.saveRefreshToken).not.toHaveBeenCalled()
    })

    it('同一客户端 → 200 正常签发', async () => {
      dbMocks.claimAuthorizationCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/web/token',
        payload: { code: CODE, client_id: appA.clientId, client_secret: 'secret-a' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.access_token).toBeTruthy()
      expect(res.json().data.refresh_token).toBeTruthy()
    })
  })

  describe('/api/oauth/access_token', () => {
    it('授权码属于别的客户端 → 400,授权码不被消费', async () => {
      dbMocks.findSessionByCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/access_token',
        payload: { code: CODE, client_id: appB.clientId, client_secret: 'secret-b' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('授权码与 client_id 不匹配')
      expect(dbMocks.markSessionUsed).not.toHaveBeenCalled()
      expect(dbMocks.findUserById).not.toHaveBeenCalled()
    })

    it('同一客户端 → 200', async () => {
      dbMocks.findSessionByCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/access_token',
        payload: { code: CODE, client_id: appA.clientId, client_secret: 'secret-a' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.access_token).toBeTruthy()
    })
  })

  describe('/api/oauth/token/exchange · authorization_code', () => {
    it('授权码属于别的客户端 → 400,授权码不被消费', async () => {
      dbMocks.findSessionByCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: {
          grant_type: 'authorization_code',
          code: CODE,
          client_id: appB.clientId,
          client_secret: 'secret-b',
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('授权码与 client_id 不匹配')
      expect(dbMocks.markSessionUsed).not.toHaveBeenCalled()
      expect(dbMocks.saveRefreshToken).not.toHaveBeenCalled()
    })

    it('同一客户端 → 200', async () => {
      dbMocks.findSessionByCode.mockResolvedValue(sessionRow(appA.clientId))

      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: {
          grant_type: 'authorization_code',
          code: CODE,
          client_id: appA.clientId,
          client_secret: 'secret-a',
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.access_token).toBeTruthy()
    })
  })

  describe('/api/oauth/token/exchange · refresh_token', () => {
    beforeEach(() => {
      dbMocks.findRefreshToken.mockResolvedValue({
        token: refreshToken,
        userId: USER_ID,
        familyId: FAMILY_ID,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      })
    })

    it('未出示客户端凭证 → 401,且不触碰 refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: { grant_type: 'refresh_token', refresh_token: refreshToken },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().message).toBe('缺少 client_id')
      expect(dbMocks.findRefreshToken).not.toHaveBeenCalled()
      expect(dbMocks.saveRefreshToken).not.toHaveBeenCalled()
    })

    it('client_secret 错误 → 401,且不轮转', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appA.clientId,
          client_secret: 'wrong-secret',
        },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().message).toBe('应用凭证错误')
      expect(dbMocks.findRefreshToken).not.toHaveBeenCalled()
    })

    it('legacy 机密客户端带正确 secret → 200 正常轮转', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appA.clientId,
          client_secret: 'secret-a',
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.access_token).toBeTruthy()
      expect(dbMocks.saveRefreshToken).toHaveBeenCalledTimes(1)
    })

    it('公开客户端(无 secret)只带 client_id → 200,兼容不被一刀切', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/oauth/token/exchange',
        payload: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: publicApp.clientId,
        },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data.access_token).toBeTruthy()
    })
  })
})
