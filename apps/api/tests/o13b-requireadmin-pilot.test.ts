// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13b 试点批行为契约:earnings-routes / security / health 收敛集中 requireAdmin 后,
 * 路由鉴权行为不变 —— roleId>=1 放行 / roleId<1 → 403 / 无 JWT → 401。
 *
 * 模式:真实集中封装(require-permission.ts) + mock authenticate(控制 JWT 侧输入),
 * db / config / fetch 均为 mock 或内存降级;security 服务走 null-redis 内存降级。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockDbReadExecute, mockDbExecute } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockDbReadExecute: vi.fn(),
  mockDbExecute: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: mockDbExecute },
  dbRead: { execute: mockDbReadExecute },
  dbClient: {},
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8803',
    AI_CALLBACK_SECRET: '',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    NODE_ENV: 'test',
  },
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch

import { earningsRoutes } from '../src/routes/earnings-routes.js'
import { securityRoutes } from '../src/routes/security.js'
import { healthRoutes } from '../src/routes/health.js'

interface MockJwtPayload {
  userId: string
  roleId: number
  phone: string
  familyId: string
}

interface MockAuthRequest {
  userId?: string
  jwtPayload?: MockJwtPayload
  headers: Record<string, string>
}

function setAdmin(): void {
  mockAuthenticate.mockImplementation(async (request: MockAuthRequest) => {
    request.userId = 'admin-001'
    request.jwtPayload = {
      userId: 'admin-001',
      roleId: 1,
      phone: '13800000001',
      familyId: 'fam-001',
    }
  })
}

function setUser(): void {
  mockAuthenticate.mockImplementation(async (request: MockAuthRequest) => {
    request.userId = 'user-001'
    request.jwtPayload = {
      userId: 'user-001',
      roleId: 0,
      phone: '13800000002',
      familyId: 'fam-002',
    }
  })
}

function setNoAuth(): void {
  const err = new Error('Invalid or expired token') as Error & { statusCode: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('O13b 试点批:集中 requireAdmin 行为契约', () => {
  let earnings: FastifyInstance
  let security: FastifyInstance
  let health: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch
    mockDbExecute.mockResolvedValue([{ '?column?': 1 }])
    if (!earnings) {
      earnings = Fastify({ logger: false })
      await earnings.register(earningsRoutes, { prefix: '/api/earnings' })
      await earnings.ready()
      security = Fastify({ logger: false })
      await security.register(securityRoutes, { prefix: '/api/security' })
      await security.ready()
      health = Fastify({ logger: false })
      await health.register(healthRoutes, { prefix: '/api' })
      await health.ready()
    }
  })

  afterAll(async () => {
    await earnings?.close()
    await security?.close()
    await health?.close()
  })

  describe('earnings(全 admin,preHandler 接线)', () => {
    it('无 JWT → 401', async () => {
      setNoAuth()
      const res = await earnings.inject({ method: 'GET', url: '/api/earnings/overview' })
      expect(res.statusCode).toBe(401)
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })

    it('roleId=0 → 403 且消息含管理员', async () => {
      setUser()
      const res = await earnings.inject({ method: 'GET', url: '/api/earnings/overview' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
      expect(mockDbReadExecute).not.toHaveBeenCalled()
    })

    it('roleId>=1 → 200 放行(DB 聚合正常)', async () => {
      setAdmin()
      mockDbReadExecute
        .mockResolvedValueOnce([
          { today_byok: '1000', today_relay: '500', yesterday_byok: '500', yesterday_relay: '0' },
        ])
        .mockResolvedValueOnce([
          { today_referral: '23', yesterday_referral: '20', paid_count: '10', total_count: '230' },
        ])
      const res = await earnings.inject({ method: 'GET', url: '/api/earnings/overview' })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })

  describe('security(混合路由,handler 内接线)', () => {
    it('无 JWT → 401(封禁端点)', async () => {
      setNoAuth()
      const res = await security.inject({
        method: 'POST',
        url: '/api/security/block-ip',
        payload: { ip: '1.2.3.4' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('roleId=0 → 403(异常列表端点)', async () => {
      setUser()
      const res = await security.inject({ method: 'GET', url: '/api/security/anomalies' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('roleId>=1 → 200 放行(封禁端点走内存降级)', async () => {
      setAdmin()
      const res = await security.inject({
        method: 'POST',
        url: '/api/security/block-ip',
        payload: { ip: '1.2.3.4', duration: 60 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('公开端点不受影响(challenge 无需登录)', async () => {
      setNoAuth()
      const res = await security.inject({
        method: 'POST',
        url: '/api/security/challenge',
        payload: {},
      })
      // 内存降级下应生成挑战(200)或服务侧 500,但绝不能是 401/403(鉴权闸未误伤公开端点)
      expect([200, 500]).toContain(res.statusCode)
    })
  })

  describe('health(单 admin 端点,handler 内接线)', () => {
    it('无 JWT → 401(隔离器重置端点)', async () => {
      setNoAuth()
      const res = await health.inject({
        method: 'POST',
        url: '/api/resilience/reset/unknown-circuit',
      })
      expect(res.statusCode).toBe(401)
    })

    it('roleId=0 → 403(隔离器重置端点)', async () => {
      setUser()
      const res = await health.inject({
        method: 'POST',
        url: '/api/resilience/reset/unknown-circuit',
      })
      expect(res.statusCode).toBe(403)
    })

    it('roleId>=1 → 通过鉴权(未知隔离器走 404 业务分支)', async () => {
      setAdmin()
      const res = await health.inject({
        method: 'POST',
        url: '/api/resilience/reset/unknown-circuit',
      })
      expect(res.statusCode).toBe(404)
    })

    it('公开端点不受影响(/health 无需登录)', async () => {
      setNoAuth()
      const res = await health.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
