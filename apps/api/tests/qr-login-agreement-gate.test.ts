// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫码登录 · 协议同意闸门(2026-10-27 立)。
 *
 * 背景:扫码 tab 不触发"提交",共享 LoginForm 的协议弹窗原本只在提交时弹,
 * 访客停在扫码面板 ⇒ 从未同意条款,扫完直接换到 token。
 *
 * 判据单源:`services/qr-login-agreement.ts` 的 `isQrSessionAgreed` +
 * `QR_AGREEMENT_REQUIRED`;同意状态只落在 Redis 扫码会话的 `agreementAccepted`。
 *
 * 覆盖矩阵(每条都走真实 authRoutes handler,Redis 用内存替身):
 *  A. 生成二维码时带 agreementAccepted:true ⇒ confirm 成功签发、status 交付 token
 *     ⇒ 摘掉 confirm 的判据会翻红(A 变成 200,和 B 同形)。
 *  B. 生成时未带同意 ⇒ confirm 403 + QR_AGREEMENT_REQUIRED,且不签发 refresh token
 *     ⇒ 摘掉 confirm 的判据 ⇒ 这条拿到 200 翻红。
 *  C. 历史遗留的 confirmed 会话(无 agreementAccepted)被直接塞进 Redis ⇒
 *     status 403 + QR_AGREEMENT_REQUIRED,不交付 token 且消费掉 key
 *     ⇒ 摘掉 status 的判据 ⇒ 这条会把 mock token 回给 PC 翻红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const KEY_PREFIX = 'qr:login:'

const m = vi.hoisted(() => ({
  findUserById: vi.fn(),
  saveRefreshToken: vi.fn(),
  issueTokenPair: vi.fn(),
  authenticate: vi.fn(),
  findUserPreferences: vi.fn(),
  recordSecurityEvent: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  createFamilyId: vi.fn().mockReturnValue('fam-test'),
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2592000,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: m.authenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserByPhone: vi.fn(),
  findUserByAccount: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: m.findUserById,
  createUser: vi.fn(),
  updateUser: vi.fn(),
  cancelUserAccount: vi.fn(),
  saveRefreshToken: m.saveRefreshToken,
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  isSystemAdminUser: vi.fn(),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('../src/db/rbac-queries.js', () => ({ getUserPermissions: vi.fn().mockResolvedValue([]) }))
vi.mock('../src/db/security-logs-queries.js', () => ({
  recordSecurityEvent: m.recordSecurityEvent,
}))
vi.mock('../src/db/promotion-queries.js', () => ({
  findInvitationByCode: vi.fn(),
  markInvitationUsed: vi.fn(),
}))
vi.mock('../src/db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: m.findUserPreferences,
  upsertUserPreference: vi.fn(),
}))
vi.mock('../src/services/points-service.js', () => ({ earnPoints: vi.fn() }))
vi.mock('../src/services/token-service.js', () => ({ issueTokenPair: m.issueTokenPair }))
vi.mock('../src/services/account-lockout.js', () => ({
  getLockRemainingMs: vi.fn().mockResolvedValue(0),
  recordLoginFailure: vi.fn().mockResolvedValue(3),
  clearLoginFailures: vi.fn().mockResolvedValue(undefined),
  ACCOUNT_LOCKOUT_CONFIG: { maxFailures: 5, lockDurationSec: 900, failureWindowSec: 900 },
}))
vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$argon2id$mockedhashvalue'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  upgradeHashIfNeeded: vi.fn().mockResolvedValue(null),
}))

import { authRoutes } from '../src/routes/auth'
import { QR_AGREEMENT_REQUIRED } from '../src/services/qr-login-agreement.js'

/** Redis 内存替身:只实现 QR 会话用到的 get/set(EX)/del/ttl。 */
class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>()

  async set(key: string, value: string, _ex?: string, ttlSeconds?: number): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : null,
    })
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key)?.value ?? null
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return -2
    if (entry.expiresAt === null) return -1
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000))
  }

  clear(): void {
    this.store.clear()
  }
}

const redis = new FakeRedis()

const mockUser = {
  id: USER_ID,
  phone: '13800000001',
  roleId: 0,
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('扫码登录 · 协议同意闸门', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    server.decorate('riskEngine', {
      evaluateRisk: () => ({ action: 'ALLOW' as const, hits: [], score: 0 }),
    })
    server.decorate('recordFunnel', () => {})
    ;(server as unknown as { redis: FakeRedis }).redis = redis
    await server.register(cookie)
    await server.register(authRoutes, { prefix: '/api/auth' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    redis.clear()
    m.findUserById.mockResolvedValue(mockUser)
    m.findUserPreferences.mockResolvedValue({ list: [], total: 0 })
    m.saveRefreshToken.mockResolvedValue(undefined)
    m.issueTokenPair.mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 900,
    })
    m.authenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
      return { userId: USER_ID, roleId: 0 }
    })
  })

  async function generateTicket(body: Record<string, unknown>): Promise<string> {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/qr/generate',
      body,
    })
    expect(res.statusCode).toBe(200)
    return res.json().data.ticket as string
  }

  async function readSession(ticket: string): Promise<Record<string, unknown> | null> {
    const raw = await redis.get(KEY_PREFIX + ticket)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  }

  it('A. 同意后扫码确认成功发 token,PC 轮询拿到 token 对', async () => {
    const ticket = await generateTicket({ agreementAccepted: true })

    // 同意状态确实落在扫码会话这个唯一真相源里
    expect(await readSession(ticket)).toMatchObject({ status: 'pending', agreementAccepted: true })

    const confirm = await server.inject({
      method: 'POST',
      url: '/api/auth/qr/confirm',
      body: { ticket },
    })
    expect(confirm.statusCode).toBe(200)
    expect(confirm.json().data.confirmed).toBe(true)
    expect(m.issueTokenPair).toHaveBeenCalledTimes(1)

    expect(await readSession(ticket)).toMatchObject({
      status: 'confirmed',
      userId: USER_ID,
      agreementAccepted: true,
    })

    const status = await server.inject({
      method: 'GET',
      url: `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
    })
    expect(status.statusCode).toBe(200)
    expect(status.json().data).toMatchObject({
      status: 'confirmed',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      userId: USER_ID,
    })
  })

  it('B. 未同意 ⇒ 扫码确认被拒,错误码可判且不签发 token', async () => {
    const ticket = await generateTicket({})

    expect(await readSession(ticket)).toMatchObject({ status: 'pending', agreementAccepted: false })

    const confirm = await server.inject({
      method: 'POST',
      url: '/api/auth/qr/confirm',
      body: { ticket },
    })
    expect(confirm.statusCode).toBe(403)
    expect(confirm.json()).toMatchObject({
      code: 403,
      errorCode: QR_AGREEMENT_REQUIRED,
    })
    expect(m.issueTokenPair).not.toHaveBeenCalled()
    // 会话保持 pending,没有被写成可领取 token 的 confirmed
    expect(await readSession(ticket)).toMatchObject({ status: 'pending' })
  })

  it('C. 历史遗留的 confirmed 会话未同意 ⇒ /qr/status 拒发 token 并消费 key', async () => {
    const ticket = `legacy_${Date.now()}`
    await redis.set(
      KEY_PREFIX + ticket,
      JSON.stringify({
        status: 'confirmed',
        userId: USER_ID,
        tokens: {
          accessToken: 'legacy-access',
          refreshToken: 'legacy-refresh',
          expiresIn: 900,
          refreshExpiresIn: 2592000,
        },
        createdAt: new Date().toISOString(),
      }),
      'EX',
      300,
    )

    const status = await server.inject({
      method: 'GET',
      url: `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
    })
    expect(status.statusCode).toBe(403)
    const body = status.json()
    expect(body).toMatchObject({ code: 403, errorCode: QR_AGREEMENT_REQUIRED })
    expect(JSON.stringify(body)).not.toContain('legacy-access')
    expect(await redis.get(KEY_PREFIX + ticket)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
