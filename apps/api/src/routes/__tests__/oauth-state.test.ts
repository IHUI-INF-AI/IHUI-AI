/**
 * OAuth state CSRF 校验测试(/auth/oauth/:provider/* 流程)。
 *
 * 覆盖场景:
 * - 正常消费:redirect 签发 state → Redis 存储 → callback 一次性消费(GET 后 DEL)→ 200
 * - 重放拒绝:同一 state 二次回调 → 401
 * - 过期/不存在拒绝:Redis 无该 key → 401
 * - provider 不匹配拒绝:存储的 provider 与回调 provider 不一致 → 401
 * - Redis 不可用降级:redirect 降级 httpOnly cookie 承载 → callback 用 cookie timingSafeEqual 比对
 * - Redis 写入失败降级:set 抛异常 → 降级 cookie
 * - 向后兼容:回调不带 state(存量链路)→ 走原逻辑放行
 *
 * Redis 通过 app.decorate('redis', mock) 注入(模拟 plugins/redis.ts 的装饰器);
 * noRedis app 不装饰,验证 Redis 缺失时的降级路径。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type { Redis } from 'ioredis'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn().mockResolvedValue(null),
  createThirdPartyBinding: vi.fn().mockResolvedValue({ id: 'binding-1' }),
  findOAuthAppByClientId: vi.fn().mockResolvedValue(null),
  createOAuthApp: vi.fn().mockResolvedValue({ id: 'app-1' }),
  listOAuthApps: vi.fn().mockResolvedValue([]),
  deleteOAuthApp: vi.fn().mockResolvedValue({ id: 'app-1' }),
  createOAuthSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  findSessionByCode: vi.fn().mockResolvedValue(null),
  markSessionUsed: vi.fn().mockResolvedValue(undefined),
  listUserSessions: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  listActiveScopeMeta: vi.fn().mockResolvedValue([]),
  listUserBindings: vi.fn().mockResolvedValue([]),
  createBinding: vi.fn().mockResolvedValue({ id: 'binding-1' }),
  removeBinding: vi.fn().mockResolvedValue(undefined),
  removeBindingByPlatform: vi.fn().mockResolvedValue(undefined),
  createUserSk: vi.fn().mockResolvedValue({ id: 'sk-1' }),
  listUserSk: vi.fn().mockResolvedValue([]),
  updateUserSk: vi.fn().mockResolvedValue(undefined),
  deleteUserSk: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/queries.js', () => ({
  findUserById: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({
    id: 'user-new-1',
    username: 'oidc_user',
    email: 'oidc@test.com',
    nickname: 'OIDC用户',
    avatar: '',
    phone: null,
    roleId: 0,
    familyId: null,
    isVip: false,
    status: 1,
    inviteCode: 'INV001',
    createdAt: new Date('2025-01-01'),
  }),
  updateUser: vi.fn().mockResolvedValue({}),
  findUserByPhone: vi.fn().mockResolvedValue(null),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserByUsername: vi.fn().mockResolvedValue(null),
  checkPhoneExists: vi.fn().mockResolvedValue(false),
  checkEmailExists: vi.fn().mockResolvedValue(false),
  cancelUserAccount: vi.fn().mockResolvedValue(undefined),
  saveRefreshToken: vi.fn().mockResolvedValue(undefined),
  findRefreshToken: vi.fn().mockResolvedValue(null),
  revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
  createFamilyId: vi.fn().mockReturnValue('mock-family-id'),
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
  // OAuth state 测试涉及的 4 个 provider 工厂/探测函数
  createOidcProvider: vi.fn(),
  createDiscordProvider: vi.fn(),
  createLinuxdoProvider: vi.fn(),
  createTelegramProvider: vi.fn(),
  isOidcConfigured: vi.fn().mockReturnValue(true),
  isDiscordConfigured: vi.fn().mockReturnValue(false),
  isLinuxdoConfigured: vi.fn().mockReturnValue(false),
  isTelegramConfigured: vi.fn().mockReturnValue(false),
  buildOidcAuthorizationUrl: vi
    .fn()
    .mockResolvedValue('https://idp.example.com/authorize?client_id=ci'),
  generateTelegramAuthToken: vi.fn().mockReturnValue('tg-auth-token'),
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[] = []): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { authExtendedRoutes } from '../auth-extended.js'
import { createOidcProvider } from '@ihui/auth'

const OAUTH_STATE_KEY_PREFIX = 'oauth:state:'

// 模拟 ioredis 客户端(仅需 state 校验用到的 get/set/del)
const redisMock = {
  get: vi.fn<(key: string) => Promise<string | null>>(),
  set: vi.fn(),
  del: vi.fn<(key: string) => Promise<number>>(),
}

// OIDC provider mock:token 交换 + 用户信息固定成功
function mockOidcProviderSuccess() {
  vi.mocked(createOidcProvider).mockReturnValue({
    exchangeCodeForToken: vi.fn().mockResolvedValue({ accessToken: 'oidc-at', idToken: 'oidc-it' }),
    fetchUserInfo: vi.fn().mockResolvedValue({
      openId: 'oidc-open-1',
      unionId: 'oidc-union-1',
      nickname: 'OIDC用户',
      avatar: 'https://cdn.example.com/a.png',
      email: 'oidc@test.com',
    }),
  } as never)
}

/** 从 redirect 响应的 redis.set 调用中提取签发的 state 与存储的 value */
function captureIssuedState(): { state: string; stored: string } {
  const [key, value] = vi.mocked(redisMock.set).mock.calls.at(-1) as [string, string]
  expect(key).toMatch(/^oauth:state:[0-9a-f]{32}$/)
  return { state: key.slice(OAUTH_STATE_KEY_PREFIX.length), stored: value }
}

/** Set-Cookie 头归一化为字符串数组(单个 cookie 时 Fastify inject 返回字符串) */
function toCookieList(setCookie: string[] | string | undefined): string[] {
  return Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
}

/** 从 Set-Cookie 头中提取降级签发的 state 值 */
function extractCookieState(setCookie: string[] | string | undefined): string | null {
  for (const c of toCookieList(setCookie)) {
    const m = /oauth_state_oidc=([^;]+)/.exec(c)
    if (m) return m[1] ?? null
  }
  return null
}

describe('OAuth state CSRF 校验 — /auth/oauth/oidc/*(Redis 可用)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    // 模拟 plugins/redis.ts 的 server.redis 装饰器
    app.decorate('redis', redisMock as unknown as Redis)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockOidcProviderSuccess()
    redisMock.get.mockResolvedValue(null)
    redisMock.set.mockResolvedValue('OK')
    redisMock.del.mockResolvedValue(1)
  })

  it('redirect 签发随机 state 并写入 Redis(key 前缀+TTL 600s,value 含 provider/userId/createdAt)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('idp.example.com')

    expect(redisMock.set).toHaveBeenCalledTimes(1)
    const [key, value, ex, ttl] = vi.mocked(redisMock.set).mock.calls[0] as [
      string,
      string,
      string,
      number,
    ]
    expect(key).toMatch(/^oauth:state:[0-9a-f]{32}$/) // randomBytes(16) hex
    expect(ex).toBe('EX')
    expect(ttl).toBe(600) // 10 分钟
    // value 为 JSON:provider+userId+创建时间(未登录 redirect → userId 为 null)
    const payload = JSON.parse(value)
    expect(payload.provider).toBe('oidc')
    expect(payload.userId).toBeNull()
    expect(typeof payload.createdAt).toBe('string')
    expect(new Date(payload.createdAt).getTime()).toBeGreaterThan(0)
  })

  it('正常消费:回调携带有效 state 通过校验,并一次性删除(DEL)', async () => {
    await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    const { state, stored } = captureIssuedState()
    // Redis 命中(模拟首次查询)
    redisMock.get.mockResolvedValueOnce(stored)

    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=${state}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.token).toBe('mock-access-token')
    // 一次性消费:GET 命中后立即 DEL
    expect(redisMock.get).toHaveBeenCalledWith(OAUTH_STATE_KEY_PREFIX + state)
    expect(redisMock.del).toHaveBeenCalledWith(OAUTH_STATE_KEY_PREFIX + state)
  })

  it('重放拒绝:同一 state 二次回调(第二次 GET 未命中)返回 401', async () => {
    await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    const { state, stored } = captureIssuedState()
    redisMock.get.mockResolvedValueOnce(stored)

    const first = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=${state}`,
    })
    expect(first.statusCode).toBe(200)

    // 第二次:Redis 已 DEL → GET 返回 null(默认 mock) → 拒绝
    const second = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=${state}`,
    })
    expect(second.statusCode).toBe(401)
    expect(second.json().message).toContain('state 校验失败')
  })

  it('过期/不存在拒绝:Redis 中无该 state(未签发)返回 401', async () => {
    redisMock.get.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/oidc/callback?code=some-code&state=deadbeefdeadbeefdeadbeefdeadbeef',
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('state 校验失败')
    // 不存在 → 不应触发 DEL
    expect(redisMock.del).not.toHaveBeenCalled()
  })

  it('provider 不匹配拒绝:存储的 provider 是 discord,回调 oidc 返回 401', async () => {
    await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    const { state } = captureIssuedState()
    // 篡改存储内容:provider 为 discord
    redisMock.get.mockResolvedValueOnce(
      JSON.stringify({ provider: 'discord', userId: null, createdAt: new Date().toISOString() }),
    )

    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=${state}`,
    })
    expect(res.statusCode).toBe(401)
    // provider 比对失败前已消费(DEL),防止被篡改的 state 重试
    expect(redisMock.del).toHaveBeenCalledWith(OAUTH_STATE_KEY_PREFIX + state)
  })

  it('Redis 写入失败降级:redirect set 抛异常 → 改用 httpOnly cookie 承载 state', async () => {
    redisMock.set.mockRejectedValueOnce(new Error('redis down'))
    const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    expect(res.statusCode).toBe(302)
    const state = extractCookieState(res.headers['set-cookie'])
    expect(state).toMatch(/^[0-9a-f]{32}$/)
    // Set-Cookie 需为 httpOnly
    expect(toCookieList(res.headers['set-cookie']).join('\n')).toContain('HttpOnly')
    // Redis set 失败后不应阻断流程
    expect(redisMock.set).toHaveBeenCalledTimes(1)
  })

  it('向后兼容:回调不带 state(存量链路)走原逻辑放行,返回 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/oidc/callback?code=legacy-code',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.token).toBe('mock-access-token')
    // 存量路径不触碰 Redis state 校验
    expect(redisMock.get).not.toHaveBeenCalled()
  })
})

describe('OAuth state CSRF 校验 — /auth/oauth/oidc/*(Redis 不可用降级)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    // 不装饰 redis → getRedis() 返回 null → 全链路走 cookie 降级
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockOidcProviderSuccess()
  })

  it('Redis 不可用:redirect 降级用 httpOnly cookie 承载 state(sameSite=lax, 10min)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    expect(res.statusCode).toBe(302)
    const joined = toCookieList(res.headers['set-cookie']).join('\n')
    expect(joined).toContain('oauth_state_oidc=')
    expect(joined).toContain('HttpOnly')
    expect(joined).toContain('SameSite=Lax')
    expect(joined).toContain('Max-Age=600')
  })

  it('Redis 不可用:回调 cookie 与 state 参数一致(timingSafeEqual)→ 200', async () => {
    const redirect = await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    const state = extractCookieState(redirect.headers['set-cookie'])
    expect(state).toBeTruthy()

    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=${state}`,
      headers: { cookie: `oauth_state_oidc=${state}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.token).toBe('mock-access-token')
  })

  it('Redis 不可用:cookie 与 state 参数不一致 → 401', async () => {
    const redirect = await app.inject({ method: 'GET', url: '/api/auth/oauth/oidc/redirect' })
    const state = extractCookieState(redirect.headers['set-cookie'])
    expect(state).toBeTruthy()

    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/oidc/callback?code=valid-code&state=attacker-forge-state`,
      headers: { cookie: `oauth_state_oidc=${state}` },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('state 校验失败')
  })

  it('Redis 不可用且无 cookie:仅凭伪造 state 参数 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/oauth/oidc/callback?code=valid-code&state=attacker-forge-state',
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('state 校验失败')
  })
})
