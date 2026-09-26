// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'

/** 形态合法的假 JWT:CSRF 豁免只看形态,真伪由路由侧鉴权判定。 */
const JWT_SHAPED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.ZmFrZXNpZw'

// Mock config: csrf 依赖 config.JWT_SECRET 签名
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

import csrfPlugin from '../src/plugins/csrf.js'

// @vitest-environment node
describe('csrf — 双提交 Cookie 模式', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // csrfPlugin 自 2026-08-14 P0 修复后不再自行 register @fastify/cookie,
    // 依赖父作用域(生产由 server.ts 注册)。测试 app 须手动注册真实
    // @fastify/cookie 插件,否则 reply.setCookie 为 undefined → 500。
    // 此前用 vi.mock('@fastify/cookie') 的过期 workaround 已无引用方,直接移除。
    await server.register(cookie)
    await server.register(csrfPlugin)
    server.post('/api/protected', async (_req, reply) => reply.send({ ok: true }))
    server.post('/api/auth/login', async (_req, reply) => reply.send({ ok: true }))
    // D15 GitHub App webhook 桩(本测只证 CSRF 层放行;HMAC 验签在真实路由层,见
    // github-app-webhook.test.ts)。matchesPrefix 是段边界前缀语义:精确命中 +
    // `entry/` 开头的子路径命中;**兄弟路由不连带** —— 用兄弟路径钉死这一点。
    server.post('/api/github-app/webhook', async (_req, reply) => reply.send({ ok: true }))
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
        // 形态必须是真 JWT(三段 base64url):2026-09-21 起 CSRF 只按**形态**豁免,
        // 乱码头不再当免死金牌(见 isPlausibleBearerCredential)。
        headers: { authorization: `Bearer ${JWT_SHAPED_TOKEN}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('bearer 小写也豁免', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: `bearer ${JWT_SHAPED_TOKEN}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('ihui_ 前缀 API Key 也豁免(机器凭据不受浏览器 CSRF 约束)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: 'Bearer ihui_abc123' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('乱码 Bearer 不得换取 CSRF 豁免(O17 实跑抓到的绕过)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: 'Bearer garbage' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('公开白名单 /api/auth/ 豁免', async () => {
      const res = await server.inject({ method: 'POST', url: '/api/auth/login' })
      expect(res.statusCode).toBe(200)
    })

    it('D15 GitHub App webhook 豁免(机器投递无 CSRF token,HMAC 验签自证)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/github-app/webhook',
        payload: { zen: 'Keep it simple.' },
        headers: { 'x-github-event': 'ping' },
      })
      // 不被 CSRF 403 拦截即抵达路由桩(生产上签名层 fail-closed 再拦无效签名)
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })
    })

    it('D15 豁免不连带兄弟路由:/api/github-app/ 其它路径仍被 CSRF 拦', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/github-app/installations',
        payload: {},
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('CSRF')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
