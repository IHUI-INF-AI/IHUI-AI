// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * P0 回归锁(2026-11-08):Apple id_token 必须验签。
 *
 * 改前:`/auth/apple/callback` 只把 id_token 第二段 base64 解出 sub,
 * 用攻击者私钥自签的 JWT 直接通过,并以伪造 sub 触达下游(findThirdPartyAccount)。
 * 改后:同一枚令牌因签名不符被 400 拒绝,下游零调用;另覆盖 alg=none、
 * kid 不存在、iss/aud 不符、exp 过期。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

const APPLE_CLIENT_ID = 'com.ihui.test.web'
const APPLE_ISSUER = 'https://appleid.apple.com'
const GENUINE_KID = 'apple-kid-1'
const FORGED_SUB = 'forged-apple-sub'
const REAL_SUB = 'real-apple-sub'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

const spies = vi.hoisted(() => ({
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  saveRefreshToken: vi.fn(),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findThirdPartyAccount: spies.findThirdPartyAccount,
  createThirdPartyBinding: spies.createThirdPartyBinding,
  findOAuthAppByClientId: vi.fn(),
  createOAuthApp: vi.fn(),
  listOAuthApps: vi.fn(),
  deleteOAuthApp: vi.fn(),
  createOAuthSession: vi.fn(),
  findSessionByCode: vi.fn(),
  markSessionUsed: vi.fn(),
  listUserSessions: vi.fn(),
  deleteSession: vi.fn(),
  listActiveScopeMeta: vi.fn(),
  listUserBindings: vi.fn(),
  removeBinding: vi.fn(),
  removeBindingByPlatform: vi.fn(),
  createUserSk: vi.fn(),
  listUserSk: vi.fn(),
  updateUserSk: vi.fn(),
  deleteUserSk: vi.fn(),
  createAuditLog: vi.fn(),
}))
vi.mock('../src/db/queries.js', () => ({
  findUserById: spies.findUserById,
  createUser: spies.createUser,
  saveRefreshToken: spies.saveRefreshToken,
}))
vi.mock('../src/routes/user/ip-whitelist-guard.js', () => ({
  gateLoginIpWhitelist: vi.fn(async () => ({ allowed: true })),
}))
// 夹具未注册 @fastify/cookie;本用例只关心归属,不关心 cookie 写入
vi.mock('../src/utils/auth-cookies.js', () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2592000,
  signAccessToken: vi.fn(async () => 'mock-access-token'),
  signRefreshToken: vi.fn(async () => 'mock-refresh-token'),
  verifyAccessToken: vi.fn(),
  createFamilyId: vi.fn(() => '00000000-0000-4000-8000-000000000002'),
}))

import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import { resetAppleJwksCacheForTest } from '../src/services/apple-id-token.js'

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>

let genuine: KeyPair
let attacker: KeyPair
let appleJwks: { keys: Array<Record<string, unknown>> }
let idTokenToReturn = ''
let jwksFetchCount = 0

const originalFetch = globalThis.fetch

function installFetch() {
  jwksFetchCount = 0
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url === 'https://appleid.apple.com/auth/token') {
      return new Response(JSON.stringify({ id_token: idTokenToReturn }), { status: 200 })
    }
    if (url === 'https://appleid.apple.com/auth/keys') {
      jwksFetchCount += 1
      return new Response(JSON.stringify(appleJwks), { status: 200 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as unknown as typeof globalThis.fetch
}

async function signToken(
  key: KeyPair,
  opts: {
    kid?: string
    alg?: string
    sub?: string
    iss?: string
    aud?: string
    iat?: number
    exp?: number | string
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jwt = new SignJWT({ email: 'u@example.com' })
    .setProtectedHeader({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? GENUINE_KID })
    .setIssuer(opts.iss ?? APPLE_ISSUER)
    .setAudience(opts.aud ?? APPLE_CLIENT_ID)
    .setSubject(opts.sub ?? REAL_SUB)
    .setIssuedAt(opts.iat ?? now)
  if (opts.exp === undefined) jwt.setExpirationTime(now + 300)
  else jwt.setExpirationTime(opts.exp)
  return jwt.sign(key.privateKey)
}

function algNoneToken(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return [
    b64({ alg: 'none', kid: GENUINE_KID }),
    b64({ sub: FORGED_SUB, iss: APPLE_ISSUER, aud: APPLE_CLIENT_ID, iat: now, exp: now + 300 }),
    '',
  ].join('.')
}

describe('Apple id_token 验签(P0)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    genuine = await generateKeyPair('RS256', { extractable: true })
    attacker = await generateKeyPair('RS256', { extractable: true })
    const jwk = await exportJWK(genuine.publicKey)
    appleJwks = { keys: [{ ...jwk, kid: GENUINE_KID, alg: 'RS256', use: 'sig' }] }
    process.env.APPLE_CLIENT_ID = APPLE_CLIENT_ID
    process.env.APPLE_CLIENT_SECRET = 'pre-signed-client-secret'
    server.decorate('redis', {
      get: vi.fn(async () => JSON.stringify({ platform: 'apple', agreementAccepted: true })),
      del: vi.fn(async () => 1),
      set: vi.fn(async () => 'OK'),
    })
    await server.register(authExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
    globalThis.fetch = originalFetch
  })
  beforeEach(() => {
    vi.clearAllMocks()
    installFetch()
    resetAppleJwksCacheForTest()
    spies.findThirdPartyAccount.mockResolvedValue({ userId: 'u-1' })
    spies.findUserById.mockResolvedValue({
      id: 'u-1',
      phone: null,
      roleId: 0,
      familyId: null,
      status: 1,
      twoFactorEnabled: false,
    })
  })

  async function callback(idToken: string) {
    idTokenToReturn = idToken
    return server.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      body: { code: 'apple-code', state: 'state-1' },
    })
  }

  it('攻击者私钥自签(同 kid)→ 400,且伪造 sub 不触达下游', async () => {
    const forged = await signToken(attacker, { sub: FORGED_SUB })
    const res = await callback(forged)
    expect(res.statusCode).toBe(400)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })

  it('Apple 私钥签名且声明齐全 → 放行真实 sub', async () => {
    const valid = await signToken(genuine, { sub: REAL_SUB })
    const res = await callback(valid)
    expect(res.statusCode, res.body).toBe(200)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledWith('apple', REAL_SUB)
  })

  it('alg=none → 拒绝且零下游', async () => {
    const res = await callback(algNoneToken())
    expect(res.statusCode).toBe(400)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })

  it('kid 不存在 → 强制刷新 JWKS 一次仍无 ⇒ 拒绝且零下游', async () => {
    const token = await signToken(attacker, { kid: 'unknown-kid', sub: FORGED_SUB })
    const res = await callback(token)
    expect(res.statusCode).toBe(400)
    expect(jwksFetchCount).toBeGreaterThanOrEqual(2)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })

  it('iss 不符 → 拒绝且零下游', async () => {
    const token = await signToken(genuine, { iss: 'https://evil.example.com' })
    const res = await callback(token)
    expect(res.statusCode).toBe(400)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })

  it('aud 不符 → 拒绝且零下游', async () => {
    const token = await signToken(genuine, { aud: 'com.other.client' })
    const res = await callback(token)
    expect(res.statusCode).toBe(400)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })

  it('exp 过期 → 拒绝且零下游', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await signToken(genuine, { iat: now - 7200, exp: now - 3600 })
    const res = await callback(token)
    expect(res.statusCode).toBe(400)
    expect(spies.findThirdPartyAccount).toHaveBeenCalledTimes(0)
  })
})
