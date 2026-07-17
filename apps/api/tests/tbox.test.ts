import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { createHmac } from 'node:crypto'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8000',
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

const { mockInsert } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockInsert,
  },
}))

import tboxRoutes from '../src/routes/tbox.js'

const SECRET = 'test-secret'

function sign(body: unknown): { headers: Record<string, string>; payload: string } {
  const raw = JSON.stringify(body)
  const signature = createHmac('sha256', SECRET).update(raw).digest('hex')
  return {
    headers: { 'content-type': 'application/json', 'x-signature': signature },
    payload: raw,
  }
}

describe('TBox agent channel deploy (POST /api/tbox/agent/channel/deploy)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(tboxRoutes, { prefix: '/api/tbox' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockInsert.mockReset()
  })

  it('无签名调用返回 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/tbox/agent/channel/deploy',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ deviceId: 'DEV-001', agentId: 'agent-001', action: 'deploy' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('action 非法返回 400', async () => {
    const { headers, payload } = sign({
      deviceId: 'DEV-001',
      agentId: 'agent-001',
      action: 'invalid',
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/tbox/agent/channel/deploy',
      headers,
      payload,
    })
    expect(res.statusCode).toBe(400)
  })

  it('正常 deploy 返回 200 且 data.id 非 undefined', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'agent-ch-001', status: 'pending' }]),
      }),
    })
    const { headers, payload } = sign({
      deviceId: 'DEV-001',
      agentId: 'agent-001',
      action: 'deploy',
      payload: { foo: 'bar' },
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/tbox/agent/channel/deploy',
      headers,
      payload,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(0)
    expect(body.data.id).toBeDefined()
    expect(body.data.status).toBe('pending')
  })
})
