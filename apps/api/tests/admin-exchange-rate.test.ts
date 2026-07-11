import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-user-id', roleId: 1 }),
}))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: any = {
      then: (resolve: any) => Promise.resolve(result).then(resolve),
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'leftJoin',
    ]) {
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
    dbRead: {
      select: vi.fn(() => createChain()),
    },
  }
})

import {
  exchangeRatePublicRoutes,
  adminExchangeRateRoutes,
} from '../src/routes/admin-exchange-rate'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_ID = 1

describe('exchange-rate routes', () => {
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
    await server.register(exchangeRatePublicRoutes, { prefix: '/api' })
    await server.register(adminExchangeRateRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('公共路由（无需认证）', () => {
    it('GET /api/exchange-rates/rate 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/exchange-rates/rate?from=USD&to=CNY',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/exchange-rates/convert 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/exchange-rates/convert?from=USD&to=CNY&amount=100',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })

  describe('401 未授权', () => {
    it('GET /api/admin/exchange-rates 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/exchange-rates' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/admin/exchange-rates 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/exchange-rates',
        body: { fromCurrency: 'USD', toCurrency: 'CNY', rate: 7.2 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/admin/exchange-rates/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
        body: { rate: 7.3 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/admin/exchange-rates/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('403 普通用户', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-user-id', roleId: 0 })
    })

    it('GET /api/admin/exchange-rates 普通用户返回 403', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/exchange-rates',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })

    it('POST /api/admin/exchange-rates 普通用户返回 403', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/exchange-rates',
        headers: AUTH_HEADERS,
        body: { fromCurrency: 'USD', toCurrency: 'CNY', rate: 7.2 },
      })
      expect(res.statusCode).toBe(403)
    })

    it('PUT /api/admin/exchange-rates/:id 普通用户返回 403', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { rate: 7.3 },
      })
      expect(res.statusCode).toBe(403)
    })

    it('DELETE /api/admin/exchange-rates/:id 普通用户返回 403', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('带管理员认证', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-user-id', roleId: 1 })
    })

    it('GET /api/admin/exchange-rates 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/exchange-rates',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/admin/exchange-rates 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/exchange-rates',
        headers: AUTH_HEADERS,
        body: { fromCurrency: 'USD', toCurrency: 'CNY', rate: 7.2 },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/admin/exchange-rates/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { rate: 7.3 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/admin/exchange-rates/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/admin/exchange-rates/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
