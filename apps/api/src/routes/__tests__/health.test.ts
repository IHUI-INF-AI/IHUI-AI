import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch

import { healthRoutes } from '../health.js'

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

  describe('Route registration', () => {
    it('should register health routes without throwing', () => {
      expect(app).toBeDefined()
    })
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
  })

  describe('所有健康检查端点响应体均包含 status 字段', () => {
    it('/api/health, /api/health/live, /api/health/ready 都有 status', async () => {
      const urls = ['/api/health', '/api/health/live', '/api/health/ready']
      for (const url of urls) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.statusCode).toBe(200)
        expect(res.json()).toHaveProperty('status')
      }
    })
  })
})
