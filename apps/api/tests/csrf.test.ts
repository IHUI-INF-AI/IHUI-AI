import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config: csrf 依赖 config.JWT_SECRET 签名
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8000',
  },
}))

import csrfPlugin from '../src/plugins/csrf.js'

describe('csrf — 双提交 Cookie 模式', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // csrfPlugin 内部已 register @fastify/cookie，无需在此重复注册
    await server.register(csrfPlugin)
    server.post('/api/protected', async (_req, reply) => reply.send({ ok: true }))
    server.post('/api/auth/login', async (_req, reply) => reply.send({ ok: true }))
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  async function obtainToken(): Promise<{ token: string; cookieValue: string }> {
    const res = await server.inject({ method: 'GET', url: '/api/csrf-token' })
    const body = res.json()
    const setCookie = res.headers['set-cookie'] as string | string[]
    const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie
    const match = /XSRF-TOKEN=([^;]+)/.exec(cookieStr)
    return { token: body.data.csrfToken, cookieValue: match![1]! }
  }

  describe('GET /api/csrf-token 签发', () => {
    it('返回 csrfToken', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/csrf-token' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.csrfToken).toBeTruthy()
      expect(body.data.csrfToken.split('.')).toHaveLength(3)
    })

    it('set-cookie XSRF-TOKEN (httpOnly)', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/csrf-token' })
      const setCookie = res.headers['set-cookie']
      expect(setCookie).toBeDefined()
      const cookieStr = Array.isArray(setCookie) ? setCookie[0]! : setCookie
      expect(cookieStr).toContain('XSRF-TOKEN=')
      expect(cookieStr.toLowerCase()).toContain('httponly')
    })
  })

  describe('写请求校验', () => {
    it('无 token + 无 cookie → 403', async () => {
      const res = await server.inject({ method: 'POST', url: '/api/protected' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('CSRF')
    })

    it('有 token + 有 cookie 且匹配 → 200', async () => {
      const { token, cookieValue } = await obtainToken()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: {
          'x-csrf-token': token,
          cookie: `XSRF-TOKEN=${cookieValue}`,
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().ok).toBe(true)
    })

    it('有 token 但无 cookie → 403', async () => {
      const { token } = await obtainToken()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { 'x-csrf-token': token },
      })
      expect(res.statusCode).toBe(403)
    })

    it('有 cookie 但无 token → 403', async () => {
      const { cookieValue } = await obtainToken()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { cookie: `XSRF-TOKEN=${cookieValue}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('token 与 cookie 不匹配 → 403', async () => {
      const { token } = await obtainToken()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: {
          'x-csrf-token': token,
          cookie: `XSRF-TOKEN=00${'ff'.repeat(40)}`,
        },
      })
      expect(res.statusCode).toBe(403)
    })

    it('伪造的 token（格式错误）→ 403', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: {
          'x-csrf-token': 'fake.token.value',
          cookie: `XSRF-TOKEN=00ff`,
        },
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET 请求豁免（安全方法）', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/csrf-token' })
      expect(res.statusCode).toBe(200)
    })

    it('Bearer JWT 请求豁免', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: 'Bearer fake-jwt-token' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('bearer 小写也豁免', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: 'bearer fake-jwt-token' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('公开白名单 /api/auth/ 豁免', async () => {
      const res = await server.inject({ method: 'POST', url: '/api/auth/login' })
      expect(res.statusCode).toBe(200)
    })
  })
})
