// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'

/**
 * G-656 一次性凭据"先烧再验"定性票 · 验收测试:
 * sso_code 同码连 exchange 两次,第二次必失败(顺序重放面)。
 *
 * 定性背景(详见 .ihui-agent/tmp/g755/g656-verdict.md):
 *  - /api/auth/sso/exchange 现状是 Redis GET → DEL → 再验 clientId/用户;
 *    顺序上"先烧后验",顺序重放第二次必 401 —— 本测试固化该语义。
 *  - 已知非原子缺陷(GET+DEL 两步,并发窗口)与本测试正交:
 *    app.inject 串行调用表达不了并发交错,该缺陷归后续改造票,本票不改生产码。
 */

const { mockVerifyAccessToken, mockVerifyRefreshToken, mockUser, mockPermissions, mockTokenPair } =
  vi.hoisted(() => ({
    mockVerifyAccessToken: vi.fn(),
    mockVerifyRefreshToken: vi.fn(),
    mockUser: {
      id: 'user-001',
      phone: '13800000001',
      email: 'test@example.com',
      nickname: 'Tester',
      avatar: 'https://example.com/a.png',
      passwordHash: null,
      roleId: 0,
      status: 1,
      familyId: 'fam-001',
    },
    mockPermissions: ['read:courses'],
    mockTokenPair: {
      accessToken: 'g656-access-token',
      refreshToken: 'g656-refresh-token',
      expiresIn: 3600,
    },
  }))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  verifyRefreshToken: mockVerifyRefreshToken,
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token-real'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token-real'),
  createFamilyId: vi.fn().mockReturnValue('fam-mock'),
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    NODE_ENV: 'test',
  },
}))

const { mockFindUserById, mockGetUserPermissions, mockIssueTokenPair } = vi.hoisted(() => ({
  mockFindUserById: vi.fn(),
  mockGetUserPermissions: vi.fn(),
  mockIssueTokenPair: vi.fn(),
}))

vi.mock('../src/db/queries.js', () => ({
  findUserById: mockFindUserById,
  revokeAllUserRefreshTokens: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  getUserPermissions: mockGetUserPermissions,
}))

vi.mock('../src/services/token-service.js', () => ({
  issueTokenPair: mockIssueTokenPair,
}))

// Redis 语义 mock:GET/DEL 分离,与生产(Redis 5.x 无 GETDEL)一致
const redisStore = new Map<string, string>()
const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  getdel: vi.fn(async (k: string) => {
    const v = redisStore.get(k)
    if (v) {
      redisStore.delete(k)
      return v
    }
    return null
  }),
  del: vi.fn(async (k: string) => {
    redisStore.delete(k)
    return 1
  }),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v)
    return 'OK'
  }),
}

import { authSsoRoutes } from '../src/routes/auth-sso.js'

describe('G-656 sso_code 同码连 exchange 两次,第二次必失败(先烧再验 · 顺序重放面)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', mockRedis)
    await app.register(cookie)
    await app.register(authSsoRoutes, { prefix: '/api/auth' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    redisStore.clear()
    mockVerifyAccessToken.mockReset()
    mockVerifyAccessToken.mockResolvedValue({
      userId: 'user-001',
      phone: '13800000001',
      roleId: 0,
      familyId: 'fam-001',
    })
    mockFindUserById.mockReset()
    mockFindUserById.mockResolvedValue(mockUser)
    mockGetUserPermissions.mockReset()
    mockGetUserPermissions.mockResolvedValue(mockPermissions)
    mockIssueTokenPair.mockReset()
    mockIssueTokenPair.mockResolvedValue(mockTokenPair)
  })

  async function seedCode(clientId = 'miniapp', redirectUri = '/dashboard') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/code',
      headers: { authorization: 'Bearer valid-token' },
      payload: { clientId, redirectUri },
    })
    expect(res.statusCode).toBe(200)
    return res.json().data.code as string
  }

  it('同码连 exchange 两次:第一次 200,第二次必 401,且 token 只签发一次', async () => {
    const code = await seedCode()

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      payload: { code, clientId: 'miniapp' },
    })
    expect(res1.statusCode).toBe(200)
    expect(res1.json().data.accessToken).toBe('g656-access-token')

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      payload: { code, clientId: 'miniapp' },
    })
    expect(res2.statusCode).toBe(401)
    expect(res2.json().message).toContain('无效或已过期')
    // 第二次不得再签发 token —— "烧掉之后连验都不该走到签发"
    expect(mockIssueTokenPair).toHaveBeenCalledTimes(1)
  })

  it('第二次失败的响应体不得携带任何 token 字段', async () => {
    const code = await seedCode()
    await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      payload: { code, clientId: 'miniapp' },
    })
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/sso/exchange',
      payload: { code, clientId: 'miniapp' },
    })
    expect(res2.statusCode).toBe(401)
    const body = res2.json()
    expect(body.data?.accessToken).toBeUndefined()
    expect(body.data?.refreshToken).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('g656-access-token')
  })
})
