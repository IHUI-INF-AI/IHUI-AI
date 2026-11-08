// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-244:`POST /api/oauth/web/token` 的授权码消费必须原子。
 *
 * 缺陷:旧写法 `findSessionByCode` → 判 `isUsed` → `markSessionUsed(code)` 三步分离,
 * 且最后那次 UPDATE 不带 `is_used=false` 条件。并发两请求都读到"未使用",
 * 于是同一 code 换出两套 access+refresh(两个 refresh family),一次性语义被破坏。
 *
 * 夹具:把"库侧条件 UPDATE 的命中/未命中"显式建模成 `claimAuthorizationCode`
 * 的返回序列 —— 第一次命中(1 行),第二次 0 行(null)。同时把旧的
 * `findSessionByCode/markSessionUsed` 替身也按"两请求都读到未使用"配置,
 * 使得**未修复时第二次请求会拿到 200**(红),修复后第二次必为 400。
 *
 * 本文件只测这一个端点:其余兼容换取端点不在本票范围,仍走原两步写法。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type { Redis } from 'ioredis'

const dbMocks = vi.hoisted(() => ({
  claimAuthorizationCode: vi.fn(),
  findSessionByCode: vi.fn(),
  markSessionUsed: vi.fn(),
  findOAuthAppByClientId: vi.fn(),
  createAuditLog: vi.fn(),
  findUserById: vi.fn(),
  saveRefreshToken: vi.fn(),
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
const CODE = 'atomic-auth-code-001'

const mockApp = {
  id: 'app-row-1',
  clientId: 'test-client-001',
  clientSecret: 'test-secret-abc',
  clientSecretHash: null,
  name: 'Test OAuth App',
  redirectUris: ['https://app.example.com/callback'],
  scopes: ['read', 'write'],
  isActive: 1,
  ownerUuid: USER_ID,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
}

const mockUser = {
  id: USER_ID,
  phone: '13800000001',
  roleId: 0,
  familyId: 'fam-001',
}

/** claimAuthorizationCode 命中时返回的行(= 条件 UPDATE ... RETURNING 的一行)。 */
function claimedRow() {
  return {
    clientId: 'test-client-001',
    userId: USER_ID,
    state: null,
    scope: 'read',
    codeChallenge: null,
    codeChallengeMethod: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  }
}

describe('F-244 · /api/oauth/web/token 授权码原子消费', () => {
  let app: FastifyInstance

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
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.findOAuthAppByClientId.mockResolvedValue(mockApp)
    dbMocks.createAuditLog.mockResolvedValue(undefined)
    dbMocks.findUserById.mockResolvedValue(mockUser)
    dbMocks.saveRefreshToken.mockResolvedValue(undefined)
    // 旧两步路径的替身:模拟"两次请求都读到 isUse=false"(缺陷成立的前置条件)
    dbMocks.findSessionByCode.mockResolvedValue({
      code: CODE,
      clientId: 'test-client-001',
      userId: USER_ID,
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      codeChallenge: null,
      codeChallengeMethod: null,
    })
    dbMocks.markSessionUsed.mockResolvedValue(undefined)
    dbMocks.claimAuthorizationCode.mockResolvedValue(null)
  })

  function tokenRequest() {
    return {
      method: 'POST' as const,
      url: '/api/oauth/web/token',
      payload: { code: CODE, client_id: 'test-client-001', client_secret: 'test-secret-abc' },
    }
  }

  it('顺序正常路径:条件 UPDATE 命中一行 → 200 签发 access/refresh', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValueOnce(claimedRow())
    const res = await app.inject(tokenRequest())
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.access_token).toBeTruthy()
    expect(body.data.refresh_token).toBeTruthy()
    expect(dbMocks.claimAuthorizationCode).toHaveBeenCalledTimes(1)
    expect(dbMocks.claimAuthorizationCode).toHaveBeenCalledWith(CODE)
  })

  it('并发二次:第一次命中、第二次 0 行 → 第二请求 400 且不签发 token', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValueOnce(claimedRow()).mockResolvedValueOnce(null)

    const first = await app.inject(tokenRequest())
    expect(first.statusCode).toBe(200)
    expect(first.json().data.access_token).toBeTruthy()

    const second = await app.inject(tokenRequest())
    expect(second.statusCode).toBe(400)
    const body = second.json()
    expect(body.code).toBe(400)
    expect(body.data).toBeUndefined()
    // 0 行 = 没抢到;此时不得调用无条件置位的两步写法
    expect(dbMocks.markSessionUsed).not.toHaveBeenCalled()
    expect(dbMocks.claimAuthorizationCode).toHaveBeenCalledTimes(2)
  })

  it('抢不到一律 400:首个请求就 0 行(已消费/不存在)不签发', async () => {
    dbMocks.claimAuthorizationCode.mockResolvedValueOnce(null)
    const res = await app.inject(tokenRequest())
    expect(res.statusCode).toBe(400)
    expect(res.json().data).toBeUndefined()
    expect(dbMocks.findUserById).not.toHaveBeenCalled()
    expect(dbMocks.saveRefreshToken).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
