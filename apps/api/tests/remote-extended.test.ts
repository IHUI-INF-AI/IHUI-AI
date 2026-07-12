import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-0000-0000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(result).then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
      chain[m] = () => chain
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([{ id: 'mock-id', count: 0 }]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { remoteExtendedRoutes } from '../src/routes/remote-extended'
import { db } from '../src/db/index.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('remote-extended routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(remoteExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/remote/user/info 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/user/info' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/business-card/upload 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/business-card/upload',
        body: { imageUrl: 'https://example.com/card.png' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/agent/favorites 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/agent/favorites' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/agent/favorite 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/agent/favorite',
        body: { agentId: 'agent-001' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/remote/agent/favorite/:agentId 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/remote/agent/favorite/agent-001',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/tencent/asr 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/tencent/asr',
        body: { audioUrl: 'https://example.com/audio.wav' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/withdrawal/switch 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/withdrawal/switch' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/remote/withdrawal/switch 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/remote/withdrawal/switch',
        body: { enabled: false },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/user/stats 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/user/stats' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/agent/hot 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/agent/hot' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/remote/feedback 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/feedback',
        body: { type: 'bug', content: '测试反馈' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/remote/config 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/remote/config' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/remote/user/info 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/user/info',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/remote/business-card/upload 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/business-card/upload',
        headers: AUTH_HEADERS,
        body: { imageUrl: 'https://example.com/card.png', name: '张三' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/remote/agent/favorites 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/agent/favorites',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/remote/agent/favorite 返回 201', async () => {
      vi.mocked(db.execute).mockResolvedValueOnce([] as never)
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/agent/favorite',
        headers: AUTH_HEADERS,
        body: { agentId: 'agent-001' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/remote/agent/favorite/:agentId 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/remote/agent/favorite/agent-001',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/remote/tencent/asr 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/tencent/asr',
        headers: AUTH_HEADERS,
        body: { audioUrl: 'https://example.com/audio.wav' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/remote/withdrawal/switch 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/withdrawal/switch',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/remote/withdrawal/switch 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/remote/withdrawal/switch',
        headers: AUTH_HEADERS,
        body: { enabled: true, remark: '开启提现' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/remote/user/stats 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/user/stats',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/remote/agent/hot 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/agent/hot',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/remote/feedback 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/remote/feedback',
        headers: AUTH_HEADERS,
        body: { type: 'suggestion', content: '建议增加深色模式' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/remote/config 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/remote/config',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
