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
    const chain: any = {
      then: (resolve: any) => Promise.resolve(result).then(resolve),
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

import { aiImageEditRoutes } from '../src/routes/ai-image-edit'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('ai-image-edit routes', () => {
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
    await server.register(aiImageEditRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('POST /api/ai-image/doubao/edit 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/doubao/edit',
        body: { imageUrl: 'https://example.com/img.png', prompt: '变成油画风格' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/doubao/inpaint 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/doubao/inpaint',
        body: {
          imageUrl: 'https://example.com/img.png',
          maskUrl: 'https://example.com/mask.png',
          prompt: '修复背景',
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/edit 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/edit',
        body: { imageUrl: 'https://example.com/img.png', prompt: '换成动漫风格' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/text-to-image 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/text-to-image',
        body: { prompt: '画一只猫' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/image-to-image 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/image-to-image',
        body: { imageUrl: 'https://example.com/img.png', prompt: '改成水彩风格' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/history 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/history' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/history/:id 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/history/mock-id' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/ai-image/history/:id 未登录返回 401', async () => {
      const res = await server.inject({ method: 'DELETE', url: '/api/ai-image/history/mock-id' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/doubao/models 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/doubao/models' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/tongyi/models 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/tongyi/models' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/tongyi/image2image/models 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/tongyi/image2image/models',
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/style-transfer 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/style-transfer',
        body: {
          imageUrl: 'https://example.com/img.png',
          styleRefUrl: 'https://example.com/style.png',
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/background-generation 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/background-generation',
        body: { imageUrl: 'https://example.com/img.png', prompt: '换成海滩背景' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/tongyi/virtual-try-on 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/virtual-try-on',
        body: {
          personImageUrl: 'https://example.com/person.png',
          topGarmentUrl: 'https://example.com/garment.png',
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/ai-image/user-agent 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/user-agent',
        body: { agentId: 'agent-001', imageUrl: 'https://example.com/img.png' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/user-agent/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/user-agent/list' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/ai-image/user-agent/:id 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/ai-image/user-agent/1' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/ai-image/user-agent/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/ai-image/user-agent/1',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('POST /api/ai-image/doubao/edit 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/doubao/edit',
        headers: AUTH_HEADERS,
        body: { imageUrl: 'https://example.com/img.png', prompt: '变成油画风格' },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/doubao/inpaint 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/doubao/inpaint',
        headers: AUTH_HEADERS,
        body: {
          imageUrl: 'https://example.com/img.png',
          maskUrl: 'https://example.com/mask.png',
          prompt: '修复背景',
        },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/edit 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/edit',
        headers: AUTH_HEADERS,
        body: { imageUrl: 'https://example.com/img.png', prompt: '换成动漫风格' },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/text-to-image 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/text-to-image',
        headers: AUTH_HEADERS,
        body: { prompt: '画一只猫' },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/image-to-image 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/image-to-image',
        headers: AUTH_HEADERS,
        body: { imageUrl: 'https://example.com/img.png', prompt: '改成水彩风格' },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/history 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/history',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/history/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/history/mock-id',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/ai-image/history/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/ai-image/history/mock-id',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/doubao/models 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/doubao/models',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/tongyi/models 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/tongyi/models',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/tongyi/image2image/models 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/tongyi/image2image/models',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/style-transfer 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/style-transfer',
        headers: AUTH_HEADERS,
        body: {
          imageUrl: 'https://example.com/img.png',
          styleRefUrl: 'https://example.com/style.png',
        },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/background-generation 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/background-generation',
        headers: AUTH_HEADERS,
        body: { imageUrl: 'https://example.com/img.png', prompt: '换成海滩背景' },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/tongyi/virtual-try-on 返回 200（无密钥时返回占位）', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/tongyi/virtual-try-on',
        headers: AUTH_HEADERS,
        body: {
          personImageUrl: 'https://example.com/person.png',
          topGarmentUrl: 'https://example.com/garment.png',
        },
      })
      expect([200, 503]).toContain(res.statusCode)
      if (res.statusCode === 200) expect(res.json().code).toBe(0)
    })

    it('POST /api/ai-image/user-agent 返回 200', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai-image/user-agent',
        headers: AUTH_HEADERS,
        body: { agentId: 'agent-001', imageUrl: 'https://example.com/img.png' },
      })
      expect([200, 503]).toContain(res.statusCode)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/user-agent/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/user-agent/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/ai-image/user-agent/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/ai-image/user-agent/1',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/ai-image/user-agent/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: '/api/ai-image/user-agent/1',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
