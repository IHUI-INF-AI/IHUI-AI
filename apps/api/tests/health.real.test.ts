import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// 真实 DB 集成测试:不 mock db 和 config,让路由代码用 setup-env.ts
// 设置的 DATABASE_URL 连接 ihui_test 真实执行 SELECT 1
// 仅 mock global.fetch(AI service health check,避免依赖真实 AI service)
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch

import { healthRoutes } from '../src/routes/health'

describe('health route — 真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(healthRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/health/ready 真实连接 ihui_test 执行 SELECT 1', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health/ready' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ready')
    expect(body.checks.database.status).toBe('ok')
    expect(body.checks.database.latency).toBeGreaterThanOrEqual(0)
  })
})
