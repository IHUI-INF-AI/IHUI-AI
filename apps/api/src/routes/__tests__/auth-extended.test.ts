import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

import { authExtendedRoutes } from '../auth-extended.js'

describe('Auth Extended API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Route registration', () => {
    it('should register the route plugin without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('公开端点（不依赖 db 的配置查询）', () => {
    it('GET /api/auth/google/config 返回 200 与 configured 字段', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/google/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('configured')
    })

    it('GET /api/sms-proxy/config 返回 200 与 provider 字段（dev 模式）', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/sms-proxy/config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('configured')
      expect(body.data).toHaveProperty('provider')
    })

    it('GET /api/oauth/sms-config 返回 200 与 provider 字段', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/sms-config' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('provider')
    })

    it('GET /api/oauth/sms-login 返回 200 与页面配置', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/sms-login' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.page).toBe('sms-login')
      expect(body.data).toHaveProperty('smsConfigured')
      expect(body.data).toHaveProperty('sendCodeEndpoint')
      expect(body.data).toHaveProperty('verifyEndpoint')
    })

    it('GET /api/oauth/token/test 无 Bearer token 返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/oauth/token/test' })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/oauth/token/test 无效 token 返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/oauth/token/test',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/auth/pat 无 body 返回 400 参数错误', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/pat' })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/auth/pat/async 无 body 返回 400 参数错误', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/auth/pat/async' })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/auth/pat 空 token 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/pat',
        payload: { token: '' },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('Endpoints (401 without auth)', () => {
    const protectedEndpoints: Array<{ method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'GET', url: '/api/auth/info' },
      { method: 'PUT', url: '/api/auth/profile', payload: {} },
      { method: 'PUT', url: '/api/auth/profile/password', payload: {} },
      { method: 'DELETE', url: '/api/auth/cancel' },
      {
        method: 'POST',
        url: '/api/auth/wechat/mini/phone?code=mock',
        payload: {},
      },
      {
        method: 'POST',
        url: '/api/auth/wechat/mini/rebind?code=mock',
        payload: {},
      },
      {
        method: 'GET',
        url: '/api/auth/oauth/authorize?client_id=mock&redirect_uri=http://localhost&state=s&scope=openid',
      },
      { method: 'POST', url: '/api/auth/oauth/apps/create', payload: {} },
      { method: 'GET', url: '/api/auth/oauth/apps/list' },
      { method: 'DELETE', url: '/api/auth/oauth/apps/mock-client-id' },
      { method: 'GET', url: '/api/auth/oauth/my-authorized' },
      { method: 'DELETE', url: '/api/auth/oauth/my-authorized/mock-session-id' },
      { method: 'GET', url: '/api/auth/bindings' },
      { method: 'DELETE', url: '/api/auth/bindings/mock-id' },
      { method: 'POST', url: '/api/auth/bindings/remove', payload: { uuid: 'u', platform: 'p' } },
      { method: 'POST', url: '/api/auth/user-sk/create', payload: {} },
      { method: 'GET', url: '/api/auth/user-sk/list' },
      { method: 'PUT', url: '/api/auth/user-sk/mock-sk-id', payload: {} },
      { method: 'DELETE', url: '/api/auth/user-sk/mock-sk-id' },
      {
        method: 'POST',
        url: '/api/oauth/debug/create-test-session',
        payload: {},
      },
    ]

    for (const { method, url, payload } of protectedEndpoints) {
      it(`${method} ${url}`, async () => {
        const res = await app.inject({ method, url, payload })
        expect(res.statusCode).toBe(401)
      })
    }
  })
})
