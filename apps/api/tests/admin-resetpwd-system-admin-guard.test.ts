// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'
import { requireAdmin } from '../src/plugins/require-permission.js'

const BUILTIN_ADMIN = '00000000-0000-4000-8000-000000000001'
const OTHER_ADMIN = '00000000-0000-4000-8000-000000000002'

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
  mockFindUserByIdAdmin,
  mockIsSystemAdminUser,
  mockRevokeAllUserRefreshTokens,
  mockDbUpdate,
  mockUpdateReturning,
  mockHashPassword,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn()
  const mockDbUpdate = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: mockUpdateReturning,
        then: (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve),
      })),
    })),
  }))
  return {
    mockVerifyAccessToken: vi.fn(),
    mockFindUserByIdAdmin: vi.fn(),
    mockIsSystemAdminUser: vi.fn(),
    mockRevokeAllUserRefreshTokens: vi.fn().mockResolvedValue(undefined),
    mockDbUpdate,
    mockUpdateReturning,
    mockHashPassword: vi.fn().mockResolvedValue('new-hash'),
  }
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
  // 2026-11-11:生产 authenticateInner 已改 fail-closed——getTokenBlacklist() 返回 null
  // 即判 token「已吊销」⇒ 401。测试环境 createBlacklist 内部 new IORedis 恒连不上 ⇒ null
  // ⇒ 合法 token 被 401。覆盖为内存假黑名单(has 恒 false)。不回退生产 fail-closed 语义。
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/admin-queries.js', () => ({
  countUsers: vi.fn(),
  countProjects: vi.fn(),
  countActiveSessions: vi.fn(),
  findUsers: vi.fn(),
  findUserByIdAdmin: mockFindUserByIdAdmin,
  updateUserRole: vi.fn(),
  updateUserStatus: vi.fn(),
  updateUserDept: vi.fn(),
  findProjectsWithOwner: vi.fn(),
  findProjectByIdWithOwner: vi.fn(),
  createProjectAdmin: vi.fn(),
  updateProjectAdmin: vi.fn(),
  deleteProjectAdmin: vi.fn(),
}))
vi.mock('../src/db/queries.js', () => ({
  createUser: vi.fn(),
  isSystemAdminUser: mockIsSystemAdminUser,
  revokeAllUserRefreshTokens: mockRevokeAllUserRefreshTokens,
}))
vi.mock('../src/db/index.js', () => ({ db: { update: mockDbUpdate } }))
vi.mock('../src/utils/password-crypto.js', () => ({ hashPassword: mockHashPassword }))
vi.mock('../src/services/litellm-price-sync.js', () => ({ syncLiteLLMPricing: vi.fn() }))
vi.mock('../src/services/pricing-service.js', () => ({ upsertPricing: vi.fn() }))

import { adminRoutes } from '../src/routes/admin'
import { userRoutes } from '../src/routes/admin-sys/user-routes'

function mockAdminToken(userId: string) {
  mockVerifyAccessToken.mockResolvedValue({
    userId,
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  })
}

describe('F-125 系统内置管理员密码重置守卫', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({ code: statusCode, message: error.message })
    })
    await server.register(adminRoutes, { prefix: '/api/admin' })
    // admin-sys 的主插件在父层注入 requireAdmin;此处复刻同一装配(仅注册 user 子路由)
    await server.register(
      async (scope) => {
        scope.addHook('preHandler', requireAdmin)
        await scope.register(userRoutes, { prefix: '/users' })
      },
      { prefix: '/api/admin' },
    )
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateReturning.mockResolvedValue([{ id: BUILTIN_ADMIN }])
    mockHashPassword.mockResolvedValue('new-hash')
    mockRevokeAllUserRefreshTokens.mockResolvedValue(undefined)
    mockFindUserByIdAdmin.mockResolvedValue({
      id: BUILTIN_ADMIN,
      isSystemAdmin: true,
    })
    mockIsSystemAdminUser.mockResolvedValue(true)
  })

  it('POST /users/:id/resetPwd — 普通管理员重置内置管理员:403 且不落库', async () => {
    mockAdminToken(OTHER_ADMIN)
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/users/${BUILTIN_ADMIN}/resetPwd`,
      headers: { authorization: 'Bearer admin-token' },
      body: { newPassword: 'newpass123' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('系统内置管理员')
    expect(mockDbUpdate).not.toHaveBeenCalled()
    expect(mockRevokeAllUserRefreshTokens).not.toHaveBeenCalled()
  })

  it('POST /users/:id/resetPwd — 内置管理员重置自己:200 且吊销 refresh token', async () => {
    mockAdminToken(BUILTIN_ADMIN)
    const res = await server.inject({
      method: 'POST',
      url: `/api/admin/users/${BUILTIN_ADMIN}/resetPwd`,
      headers: { authorization: 'Bearer admin-token' },
      body: { newPassword: 'newpass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    expect(mockRevokeAllUserRefreshTokens).toHaveBeenCalledWith(BUILTIN_ADMIN)
  })

  it('PUT /users/resetPwd — 普通管理员重置内置管理员:403 且不落库', async () => {
    mockAdminToken(OTHER_ADMIN)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: BUILTIN_ADMIN, password: 'newpass123' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('系统内置管理员')
    expect(mockDbUpdate).not.toHaveBeenCalled()
    expect(mockRevokeAllUserRefreshTokens).not.toHaveBeenCalled()
  })

  it('PUT /users/resetPwd — 内置管理员重置自己:200 且吊销 refresh token', async () => {
    mockAdminToken(BUILTIN_ADMIN)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/users/resetPwd',
      headers: { authorization: 'Bearer admin-token' },
      body: { userId: BUILTIN_ADMIN, password: 'newpass123' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockDbUpdate).toHaveBeenCalledTimes(1)
    expect(mockRevokeAllUserRefreshTokens).toHaveBeenCalledWith(BUILTIN_ADMIN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
