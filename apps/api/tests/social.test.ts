// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入?env 校验触发 process.exit(1)
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
  },
}))

const socialMocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  followUser: vi.fn(),
  isMutualFollowing: vi.fn(),
  createNotification: vi.fn(),
  findUserById: vi.fn(),
  queueNotificationEmail: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, checkAuth: socialMocks.checkAuth }
})
vi.mock('../src/db/social-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    followUser: socialMocks.followUser,
    isMutualFollowing: socialMocks.isMutualFollowing,
  }
})
vi.mock('../src/db/notification-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, createNotification: socialMocks.createNotification }
})
vi.mock('../src/db/queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, findUserById: socialMocks.findUserById }
})
vi.mock('../src/services/email-service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, queueNotificationEmail: socialMocks.queueNotificationEmail }
})

import { socialRoutes } from '../src/routes/social'

const MEMBER_ID = '00000000-0000-4000-8000-000000000011'
const TARGET_ID = '00000000-0000-4000-8000-000000000012'

// 认证桩:无 Bearer ⇒ 401(保持既有未登录用例语义);有 Bearer ⇒ 注入 userId
socialMocks.checkAuth.mockImplementation(
  async (
    request: { headers: Record<string, unknown>; userId?: string },
    reply: { status: (n: number) => { send: (b: unknown) => void } },
  ) => {
    if (!String(request.headers.authorization ?? '').startsWith('Bearer ')) {
      reply.status(401).send({ code: 401, message: '未登录' })
      return false
    }
    request.userId = MEMBER_ID
    return true
  },
)

describe('social routes', () => {
  const server = Fastify({ logger: false })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/follows/:userId/stats 未登录返?401', async () => {
    await server.register(socialRoutes, { prefix: '/api' })
    await server.ready()

    const res = await server.inject({
      method: 'GET',
      url: '/api/follows/00000000-0000-4000-8000-000000000000/stats',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/follows/following 未登录返?401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/follows/following' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/follows/followers 未登录返?401', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/follows/followers' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/follows/:userId/status 未登录返?401', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/follows/00000000-0000-4000-8000-000000000000/status',
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/favorites 未登录返?401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/favorites',
      payload: { resourceType: 'project', resourceId: 'r1' },
    })
    expect(res.statusCode).toBe(401)
  })

  // F-205:关注幂等语义 —— 首次 201 才触发副作用与积分,重复 200 一律 no-op
  describe('F-205 关注幂等语义', () => {
    beforeEach(() => {
      socialMocks.followUser.mockReset()
      socialMocks.isMutualFollowing.mockReset()
      socialMocks.createNotification.mockReset()
      socialMocks.findUserById.mockReset()
      socialMocks.queueNotificationEmail.mockReset()
    })

    it('首次关注 ⇒ 201 且通知一次', async () => {
      socialMocks.followUser.mockResolvedValue(true)
      socialMocks.isMutualFollowing.mockResolvedValue(false)
      socialMocks.createNotification.mockResolvedValue({ id: 'n1' })
      socialMocks.findUserById.mockResolvedValue(null)
      const res = await server.inject({
        method: 'POST',
        url: `/api/follows/${TARGET_ID}`,
        headers: { authorization: 'Bearer test' },
      })
      expect(res.statusCode).toBe(201)
      expect(socialMocks.createNotification).toHaveBeenCalledTimes(1)
    })

    it('重复关注 ⇒ 200 幂等,不重发通知/邮件', async () => {
      socialMocks.followUser.mockResolvedValue(false)
      socialMocks.isMutualFollowing.mockResolvedValue(true)
      const res = await server.inject({
        method: 'POST',
        url: `/api/follows/${TARGET_ID}`,
        headers: { authorization: 'Bearer test' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toMatchObject({
        followed: true,
        alreadyFollowing: true,
        isMutual: true,
      })
      expect(socialMocks.createNotification).not.toHaveBeenCalled()
      expect(socialMocks.queueNotificationEmail).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
