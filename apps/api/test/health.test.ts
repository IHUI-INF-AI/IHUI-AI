import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// Mock db:避免真实 DB 连接(health/ready 调用 db.execute)
const { mockDbExecute } = vi.hoisted(() => ({ mockDbExecute: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: { execute: mockDbExecute },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://localhost:8000',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    NODE_ENV: 'test',
  },
}))

// Mock wechat-pay 配置检查(health/ready 中调用)
vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: vi.fn().mockReturnValue(true),
  isPlatformCertConfigured: vi.fn().mockReturnValue(true),
}))

// Mock resilience-extended(resilience/reset 端点调用 resetBulkhead)
const { mockResetBulkhead } = vi.hoisted(() => ({ mockResetBulkhead: vi.fn() }))
vi.mock('../src/plugins/resilience-extended.js', () => ({
  resetBulkhead: mockResetBulkhead,
}))

// Mock authenticate(控制 /resilience/reset 鉴权)
const { mockAuthenticate } = vi.hoisted(() => ({ mockAuthenticate: vi.fn() }))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

// Mock global fetch(AI service health check)
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch

import { healthRoutes } from '../src/routes/health.js'

describe('Health API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(healthRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockDbExecute.mockReset()
    mockDbExecute.mockResolvedValue([{ '?column?': 1 }])
    mockResetBulkhead.mockReset()
    mockAuthenticate.mockReset()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockReset()
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 })
  })

  describe('GET /api/health', () => {
    it('返回 200 与 status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('ok')
      expect(body.service).toBe('@ihui/api')
      expect(body).toHaveProperty('timestamp')
      expect(body).toHaveProperty('uptime')
    })
  })

  describe('GET /api/health/live', () => {
    it('返回 200 与 status alive', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health/live' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('alive')
      expect(body).toHaveProperty('uptime')
    })
  })

  describe('GET /api/health/ready', () => {
    it('无 Redis 时返回 200 ready, redis 状态为 skip', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health/ready' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('ready')
      expect(body.checks.database.status).toBe('ok')
      expect(body.checks.redis.status).toBe('skip')
      expect(body.checks.aiService.status).toBe('ok')
      expect(body.checks.wechatPay.status).toBe('ok')
    })

    it('注册 Redis 后返回 ok', async () => {
      const serverWithRedis = Fastify({ logger: false })
      serverWithRedis.decorate('redis', {
        ping: vi.fn().mockResolvedValue('PONG'),
      } as never)
      await serverWithRedis.register(healthRoutes, { prefix: '/api' })
      await serverWithRedis.ready()

      const res = await serverWithRedis.inject({ method: 'GET', url: '/api/health/ready' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('ready')
      expect(body.checks.database.status).toBe('ok')
      expect(body.checks.redis.status).toBe('ok')
      expect(body.checks.redis.latency).toBeGreaterThanOrEqual(0)
      await serverWithRedis.close()
    })

    it('Redis ping 异常时返回 503 degraded', async () => {
      const serverWithRedisErr = Fastify({ logger: false })
      serverWithRedisErr.decorate('redis', {
        ping: vi.fn().mockRejectedValue(new Error('connection refused')),
      } as never)
      await serverWithRedisErr.register(healthRoutes, { prefix: '/api' })
      await serverWithRedisErr.ready()

      const res = await serverWithRedisErr.inject({ method: 'GET', url: '/api/health/ready' })
      expect(res.statusCode).toBe(503)
      const body = res.json()
      expect(body.status).toBe('degraded')
      expect(body.checks.redis.status).toBe('error')
      await serverWithRedisErr.close()
    })

    it('DB 查询异常时返回 503 degraded', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('db down'))
      const res = await app.inject({ method: 'GET', url: '/api/health/ready' })
      expect(res.statusCode).toBe(503)
      const body = res.json()
      expect(body.status).toBe('degraded')
      expect(body.checks.database.status).toBe('error')
    })

    it('AI service 不可达时不阻塞 ready(降级为 unreachable)', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('network error'),
      )
      const res = await app.inject({ method: 'GET', url: '/api/health/ready' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.status).toBe('ready')
      expect(body.checks.aiService.status).toBe('unreachable')
    })
  })

  describe('GET /api/health/metrics', () => {
    it('未注册 metrics 插件时返回 not available', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health/metrics' })
      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('metrics not available')
    })
  })

  describe('GET /api/health/history', () => {
    it('返回 total 与 list 字段', async () => {
      // 先触发一次 /ready 以写入历史
      await app.inject({ method: 'GET', url: '/api/health/ready' })
      const res = await app.inject({ method: 'GET', url: '/api/health/history' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('list')
      expect(Array.isArray(body.list)).toBe(true)
    })
  })

  describe('所有健康检查端点响应体均包含 status 字段', () => {
    it('/health, /health/live, /health/ready 都有 status', async () => {
      const urls = ['/api/health', '/api/health/live', '/api/health/ready']
      for (const url of urls) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.statusCode).toBe(200)
        expect(res.json()).toHaveProperty('status')
      }
    })
  })

  describe('POST /api/resilience/reset/:circuitName', () => {
    it('未认证返回 401', async () => {
      mockAuthenticate.mockRejectedValueOnce(
        Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      )
      const res = await app.inject({ method: 'POST', url: '/api/resilience/reset/foo' })
      expect(res.statusCode).toBe(401)
    })

    it('非管理员返回 403', async () => {
      mockAuthenticate.mockImplementationOnce((request: { jwtPayload?: { roleId: number } }) => {
        request.jwtPayload = { userId: 'u1', roleId: 0 }
        return Promise.resolve(request.jwtPayload)
      })
      const res = await app.inject({ method: 'POST', url: '/api/resilience/reset/foo' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('管理员 + 有效隔离器返回 200', async () => {
      mockAuthenticate.mockImplementationOnce((request: { jwtPayload?: { roleId: number } }) => {
        request.jwtPayload = { userId: 'u1', roleId: 1 }
        return Promise.resolve(request.jwtPayload)
      })
      mockResetBulkhead.mockReturnValueOnce(true)
      const res = await app.inject({ method: 'POST', url: '/api/resilience/reset/foo' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.reset).toBe(true)
      expect(mockResetBulkhead).toHaveBeenCalledWith('foo')
    })

    it('管理员 + 不存在的隔离器返回 404', async () => {
      mockAuthenticate.mockImplementationOnce((request: { jwtPayload?: { roleId: number } }) => {
        request.jwtPayload = { userId: 'u1', roleId: 1 }
        return Promise.resolve(request.jwtPayload)
      })
      mockResetBulkhead.mockReturnValueOnce(false)
      const res = await app.inject({ method: 'POST', url: '/api/resilience/reset/unknown' })
      expect(res.statusCode).toBe(404)
      expect(res.json().code).toBe(404)
    })
  })
})
