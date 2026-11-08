// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const BUILTIN_ADMIN = '00000000-0000-4000-8000-000000000001'
const NORMAL_USER = '00000000-0000-4000-8000-000000000003'
const ANOTHER_USER = '00000000-0000-4000-8000-000000000004'
const ACCOUNT_ID = '00000000-0000-4000-8000-000000000005'

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
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    ADMIN_TOTP_MODE: 'off',
  },
}))
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

const {
  mockVerifyAccessToken,
  mockIsSystemAdminUser,
  mockFindThirdPartyAccount,
  mockDbUpdate,
  mockDbInsert,
  selectChain,
  state,
} = vi.hoisted(() => {
  const state = {
    insertValues: null as Record<string, unknown> | null,
    selectRows: [] as unknown[],
  }
  const mockDbInsert = vi.fn((_table: unknown) => ({
    values: vi.fn((values: Record<string, unknown>) => {
      state.insertValues = values
      return { returning: vi.fn().mockResolvedValue([{ id: ACCOUNT_ID, ...values }]) }
    }),
  }))
  const mockDbUpdate = vi.fn((_table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: ACCOUNT_ID, ...values }]),
      })),
    })),
  }))
  const selectChain: Record<string, unknown> = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => selectChain,
    limit: () => selectChain,
    offset: () => selectChain,
    then: (resolve: (v: unknown) => void) => Promise.resolve(state.selectRows).then(resolve),
  }
  return {
    mockVerifyAccessToken: vi.fn(),
    mockIsSystemAdminUser: vi.fn(),
    mockFindThirdPartyAccount: vi.fn(),
    mockDbUpdate,
    mockDbInsert,
    state,
    selectChain,
  }
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/queries.js', () => ({ isSystemAdminUser: mockIsSystemAdminUser }))
vi.mock('../src/db/oauth-queries.js', () => ({ findThirdPartyAccount: mockFindThirdPartyAccount }))
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}))

import authAccountsRoutes from '../src/routes/admin/auth-accounts'

function mockAdminToken(userId: string) {
  mockVerifyAccessToken.mockResolvedValue({
    userId,
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

describe('F-126 第三方账号绑定提权守卫', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: error.message })
    })
    await server.register(authAccountsRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.insertValues = null
    state.selectRows = []
    mockAdminToken('00000000-0000-4000-8000-000000000006')
    mockIsSystemAdminUser.mockResolvedValue(false)
    mockFindThirdPartyAccount.mockResolvedValue(undefined)
  })

  it('普通 admin 为内置管理员绑定第三方账号 → 403 且不写库', async () => {
    mockIsSystemAdminUser.mockResolvedValue(true)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/auth-accounts',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: BUILTIN_ADMIN, platform: 'wechat', openId: 'attacker-open-id' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('系统内置管理员')
    expect(state.insertValues).toBeNull()
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('已绑定到他人的 openId 再次绑定 → 409 且不覆盖', async () => {
    mockFindThirdPartyAccount.mockResolvedValue({ id: ACCOUNT_ID, userId: ANOTHER_USER })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/auth-accounts',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: NORMAL_USER, platform: 'wechat', openId: 'taken-open-id' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('已绑定')
    expect(state.insertValues).toBeNull()
    expect(mockDbInsert).not.toHaveBeenCalled()
  })

  it('普通用户首次绑定 → 201 且按请求写入', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/auth-accounts',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: NORMAL_USER, platform: 'wechat', openId: 'fresh-open-id' },
    })
    expect(res.statusCode).toBe(201)
    expect(state.insertValues).toMatchObject({ userId: NORMAL_USER, openId: 'fresh-open-id' })
  })

  it('PUT 把已绑定的 openId 改写到另一用户 → 409 且不更新', async () => {
    state.selectRows = [
      { id: ACCOUNT_ID, userId: NORMAL_USER, platform: 'wechat', openId: 'old-open-id' },
    ]
    mockFindThirdPartyAccount.mockResolvedValue({ id: 'other-record', userId: ANOTHER_USER })
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/auth-accounts/${ACCOUNT_ID}`,
      headers: { authorization: 'Bearer admin-token' },
      body: { openId: 'taken-open-id' },
    })
    expect(res.statusCode, res.body).toBe(409)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })

  it('PUT 修改内置管理员的第三方绑定 → 403 且不更新', async () => {
    state.selectRows = [
      { id: ACCOUNT_ID, userId: BUILTIN_ADMIN, platform: 'wechat', openId: 'builtin-open-id' },
    ]
    mockIsSystemAdminUser.mockResolvedValue(true)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/auth-accounts/${ACCOUNT_ID}`,
      headers: { authorization: 'Bearer admin-token' },
      body: { openId: 'attacker-open-id' },
    })
    expect(res.statusCode, res.body).toBe(403)
    expect(mockDbUpdate).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
