// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-56:根级 `/oauth/authorize` 与 `/oauth/userinfo` 必须叠加 access token 黑名单。
 *
 * 缺陷:两处只用 `introspectAccessToken`(纯签名/过期),登出/踢下线写入 Redis 的吊销记录
 * 被当没看见 —— 被窃 token 在剩余有效期内仍能换出全新 code → 新 access+refresh。
 *
 * 夹具成对:
 *  - 黑名单命中 → 401,且不落 oauth_sessions、不查用户(不签发/不吐 claims);
 *  - 黑名单未命中 → 正常 302 发码 / 200 返回 claims(证明收紧没把正当流程挡掉);
 *  - 无 Bearer → 仍 302 转 web 同意页(原有分支不变);
 *  - Redis 读失败 → fail-open(与 plugins/auth.ts 的既有裁决同口径)。
 *
 * 不连真 Redis:用本仓唯一内存替身 `src/testing/fake-redis.ts`,按真实 key 命名
 * (`bl:<sha256(token)>`)预置吊销记录 —— 若路由绕过黑名单,这些用例必红。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'

const redisState = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))

vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(redisState) }
})

vi.mock('../src/config/index.js', () => ({
  config: {
    CORS_ORIGIN: 'https://web.example.com',
    PUBLIC_BASE_URL: '',
    OAUTH_ISSUER: '',
    PORT: 8802,
    OAUTH_ERROR_URI_HOSTS: '',
    OAUTH_ERROR_URI_BASE: '',
    REDIS_URL: 'redis://127.0.0.1:6399/1',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
  },
}))

const authMocks = vi.hoisted(() => ({
  introspectAccessToken: vi.fn(),
}))

vi.mock('@ihui/auth', async (importOriginal) => {
  const actual = (await importOriginal<Record<string, unknown>>()) as Record<string, unknown>
  return { ...actual, introspectAccessToken: authMocks.introspectAccessToken }
})

const dbMocks = vi.hoisted(() => ({
  findOAuthAppByClientId: vi.fn(),
  createOAuthSession: vi.fn(),
  createAuditLog: vi.fn(),
  listActiveScopeMeta: vi.fn(async () => []),
  findUserById: vi.fn(),
  // auth-extended 模块级依赖:本文件只测根级 OAuth 表面,不装配它的路由,
  // 整个文件替身掉可把远端 import 面收敛到最小,避免拉进整套登录服务图。
  precheckAuthorizePkce: vi.fn(() => null),
}))

vi.mock('../src/routes/auth-extended.js', () => ({
  precheckAuthorizePkce: dbMocks.precheckAuthorizePkce,
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  findOAuthAppByClientId: dbMocks.findOAuthAppByClientId,
  createOAuthSession: dbMocks.createOAuthSession,
  createAuditLog: dbMocks.createAuditLog,
  listActiveScopeMeta: dbMocks.listActiveScopeMeta,
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: dbMocks.findUserById,
}))

vi.mock('../src/db/index.js', () => ({ db: {} }))

import { oauthAuthorizationServerRoutes } from '../src/routes/oauth-authorization-server.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const VALID_TOKEN = 'valid-access-token-for-oauth-surface'
const REVOKED_TOKEN = 'revoked-access-token-after-logout'

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
  nickname: 'Tester',
  avatar: 'https://example.com/a.png',
}

/** 与 TokenBlacklist 的真实 key 口径一致(`bl:<sha256(token)>`)。 */
function blacklistKey(token: string): string {
  return `bl:${createHash('sha256').update(token, 'utf8').digest('hex')}`
}

function seedRevoked(token: string): void {
  redisState.store.set(blacklistKey(token), { value: '1', expiresAt: 0 })
}

describe('F-56 · 根级 OAuth 表面叠加 access token 黑名单', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(oauthAuthorizationServerRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    redisState.store.clear()
    redisState.calls.length = 0
    redisState.failures.clear()
    vi.clearAllMocks()
    dbMocks.findOAuthAppByClientId.mockResolvedValue(mockApp)
    dbMocks.createOAuthSession.mockResolvedValue({ id: 'session-1' })
    dbMocks.createAuditLog.mockResolvedValue(undefined)
    dbMocks.findUserById.mockResolvedValue(mockUser)
    dbMocks.listActiveScopeMeta.mockResolvedValue([])
    dbMocks.precheckAuthorizePkce.mockReturnValue(null)
    // 关键:被吊销 token 的签名/过期仍然合法,所以 introspect 照样 active ——
    // 真实性在于"只有黑名单能识别它",若路由不看黑名单就会放行。
    authMocks.introspectAccessToken.mockImplementation(async (token: string) =>
      token === VALID_TOKEN || token === REVOKED_TOKEN
        ? { active: true, sub: USER_ID }
        : { active: false },
    )
  })

  const authorizeQuery = {
    client_id: 'test-client-001',
    redirect_uri: 'https://app.example.com/callback',
    state: 'state-xyz',
    scope: 'read',
  }

  it('黑名单命中:GET /oauth/authorize → 401,且不落 session(换不出新 code)', async () => {
    seedRevoked(REVOKED_TOKEN)
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: authorizeQuery,
      headers: { authorization: `Bearer ${REVOKED_TOKEN}` },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('invalid_token')
    expect(dbMocks.createOAuthSession).not.toHaveBeenCalled()
    expect(dbMocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('黑名单未命中:同一请求正常 302 发码(state 回显、session 落库)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: authorizeQuery,
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    })
    expect(res.statusCode).toBe(302)
    const location = new URL(res.headers.location as string)
    expect(location.searchParams.get('code')).toBeTruthy()
    expect(location.searchParams.get('state')).toBe('state-xyz')
    expect(dbMocks.createOAuthSession).toHaveBeenCalledTimes(1)
    expect(dbMocks.createOAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'test-client-001', userId: USER_ID }),
    )
  })

  it('无 Bearer:仍 302 转 web 同意页(原分支不被收紧波及)', async () => {
    const res = await app.inject({ method: 'GET', url: '/oauth/authorize', query: authorizeQuery })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('/oauth/authorize?')
    expect(dbMocks.createOAuthSession).not.toHaveBeenCalled()
  })

  it('黑名单命中:GET /oauth/userinfo → 401,且不查用户(不吐 claims)', async () => {
    seedRevoked(REVOKED_TOKEN)
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: `Bearer ${REVOKED_TOKEN}` },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('invalid_token')
    expect(dbMocks.findUserById).not.toHaveBeenCalled()
  })

  it('黑名单未命中:GET /oauth/userinfo → 200 返回同一最小 claims 集', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/userinfo',
      headers: { authorization: `Bearer ${VALID_TOKEN}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ sub: USER_ID, nickname: 'Tester' })
    expect(dbMocks.findUserById).toHaveBeenCalledWith(USER_ID)
  })

  it('Redis 读失败仍放行 —— 与 plugins/auth.ts 的 fail-open 裁决同口径', async () => {
    redisState.failures.add('exists')
    seedRevoked(REVOKED_TOKEN)
    const res = await app.inject({
      method: 'GET',
      url: '/oauth/authorize',
      query: authorizeQuery,
      headers: { authorization: `Bearer ${REVOKED_TOKEN}` },
    })
    // Blacklist.has 的 fail-open 语义:读不到 ≠ 已吊销。
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('code=')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
