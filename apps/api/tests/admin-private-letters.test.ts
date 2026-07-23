import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-user-id', roleId: 1 }),
}))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(result).then(resolve),
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

import { adminPrivateLettersRoutes } from '../src/routes/admin-private-letters'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('admin-private-letters routes', () => {
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
    await server.register(adminPrivateLettersRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/admin/private-letters 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/admin/private-letters' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('403 普通用户', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-user-id', roleId: 0 })
    })

    it('GET /api/admin/private-letters 普通用户返回 403', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/private-letters',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('带管理员认证', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({ userId: 'mock-user-id', roleId: 1 })
    })

    it('GET /api/admin/private-letters 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/admin/private-letters',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
