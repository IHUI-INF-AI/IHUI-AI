import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

vi.mock('../../db/oauth-queries.js', () => ({
  findThirdPartyAccount: vi.fn().mockResolvedValue(null),
  createThirdPartyBinding: vi.fn().mockResolvedValue({ id: 'binding-1' }),
  findOAuthApp: vi.fn().mockResolvedValue(null),
  createOAuthApp: vi.fn().mockResolvedValue({ id: 'app-1' }),
  listOAuthApps: vi.fn().mockResolvedValue([]),
  listAuthorizedApps: vi.fn().mockResolvedValue([]),
  deleteOAuthApp: vi.fn().mockResolvedValue({ id: 'app-1' }),
  revokeAuthorizedApp: vi.fn().mockResolvedValue({ id: 'session-1' }),
}))

vi.mock('../../db/queries.js', () => ({
  findUserById: vi.fn().mockResolvedValue(null),
  createUser: vi.fn().mockResolvedValue({
    id: 'user-new-1',
    username: 'apple_user',
    email: 'test@apple.com',
    nickname: 'Apple用户',
    avatar: '',
    isVip: false,
    inviteCode: 'INV001',
    createdAt: new Date('2025-01-01'),
    status: 1,
  }),
  updateUser: vi.fn().mockResolvedValue({}),
  findUserByPhone: vi.fn().mockResolvedValue(null),
  findUserByEmail: vi.fn().mockResolvedValue(null),
  findUserByUsername: vi.fn().mockResolvedValue(null),
  checkPhoneExists: vi.fn().mockResolvedValue(false),
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
}))

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
import { findThirdPartyAccount, createThirdPartyBinding } from '../../db/oauth-queries.js'
import { createUser } from '../../db/queries.js'

const originalFetch = global.fetch

function mockAppleTokenResponse(idToken?: string, error?: string): Response {
  const body = idToken
    ? { access_token: 'at-xxx', id_token: idToken, refresh_token: 'rt-xxx' }
    : { error: error ?? 'invalid_grant', error_description: 'code expired' }
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('Auth Apple Callback — POST /auth/:platform/callback', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    global.fetch = originalFetch
  })

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.APPLE_CLIENT_ID
    delete process.env.APPLE_CLIENT_SECRET
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_KEY_ID
    delete process.env.APPLE_PRIVATE_KEY
    global.fetch = originalFetch
  })

  it('无效 platform 返回 400 不支持的平台', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/facebook/callback',
      payload: { code: 'test-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('不支持的平台')
  })

  it('缺少 code 字段返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { state: 'test-state' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('缺少 state 字段返回 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'test-code' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('未配置 APPLE_CLIENT_ID 返回 400 Apple OAuth 未配置', async () => {
    delete process.env.APPLE_CLIENT_ID
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'test-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('Apple OAuth 未配置')
    expect(res.json().message).toContain('APPLE_CLIENT_ID')
  })

  it('仅配置 APPLE_CLIENT_ID 无 APPLE_CLIENT_SECRET 返回框架响应', async () => {
    process.env.APPLE_CLIENT_ID = 'com.example.app'
    delete process.env.APPLE_CLIENT_SECRET

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'test-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('apple_callback_received')
    expect(body.data.code).toBe('test-code')
    expect(body.data.state).toBe('test-state')
    expect(body.data.note).toContain('APPLE_CLIENT_SECRET')
    expect(body.data.missing.clientSecret).toBe(true)
  })

  it('Apple token 交换失败(id_token 缺失)返回 400', async () => {
    process.env.APPLE_CLIENT_ID = 'com.example.app'
    process.env.APPLE_CLIENT_SECRET = 'mock-jwt-secret'
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        mockAppleTokenResponse(undefined, 'invalid_grant'),
      ) as unknown as typeof fetch

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'expired-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('Apple token 交换失败')
    expect(res.json().message).toContain('invalid_grant')
  })

  it('Apple id_token 格式无效返回 400', async () => {
    process.env.APPLE_CLIENT_ID = 'com.example.app'
    process.env.APPLE_CLIENT_SECRET = 'mock-jwt-secret'
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockAppleTokenResponse('not-a-valid-jwt')) as unknown as typeof fetch

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'test-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('id_token 格式无效')
  })

  it('Apple 回调成功(新用户)返回 token 与用户信息', async () => {
    process.env.APPLE_CLIENT_ID = 'com.example.app'
    process.env.APPLE_CLIENT_SECRET = 'mock-jwt-secret'
    const appleSub = '000123.abc.456'
    const appleEmail = 'test@privaterelay.appleid.com'
    const idToken = makeJwt({ sub: appleSub, email: appleEmail })
    global.fetch = vi
      .fn()
      .mockResolvedValue(mockAppleTokenResponse(idToken)) as unknown as typeof fetch

    vi.mocked(findThirdPartyAccount).mockResolvedValueOnce(undefined)
    vi.mocked(createUser).mockResolvedValueOnce({
      id: 'user-new-1',
      username: 'apple_user',
      email: appleEmail,
      nickname: 'Apple用户',
      avatar: '',
      isVip: false,
      inviteCode: 'INV001',
      createdAt: new Date('2025-01-01'),
      status: 1,
    } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/apple/callback',
      payload: { code: 'valid-code', state: 'test-state' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.token).toBe('mock-access-token')
    expect(body.data.refreshToken).toBe('mock-refresh-token')
    expect(body.data.user.email).toBe(appleEmail)
    expect(findThirdPartyAccount).toHaveBeenCalledWith('apple', appleSub)
    expect(createUser).toHaveBeenCalled()
    expect(createThirdPartyBinding).toHaveBeenCalledWith(
      expect.objectContaining({ openId: appleSub, platform: 'apple' }),
    )
  })
})
