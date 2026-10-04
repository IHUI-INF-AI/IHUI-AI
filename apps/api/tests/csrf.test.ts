// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { SignJWT } from 'jose'
import type * as JoseModule from 'jose'

/**
 * 2026-10-04(G-373):本文件原先用**签名伪造**的 `JWT_SHAPED_TOKEN` 与**库里不存在**的
 * `ihui_abc123` 来断言"Bearer 一律豁免"。那正是被修掉的那一型:形态成立即豁免。
 * 现在 CSRF 钩子的判据是**凭据自证**(JWT 验签 / API Key 查库),故正向用例改用
 * 真签名 JWT 与真在库的 key;反向用例(形态成立但凭据无效 ⇒ 必须 403)见
 * tests/csrf-credential-presence-exempt.test.ts。
 */
const TEST_JWT_SECRET = 'csrf-existing-suite-secret-at-least-32-chars-0123456789'

/** 内存形态的 developer_api_keys 表:替代真库(不连生产 PG,§5 测试隔离铁律)。 */
const { apiKeyTable } = vi.hoisted(() => ({
  apiKeyTable: new Map<string, { status: string; expiresAt: Date | null }>(),
}))

/** 形态合法的假 JWT:签名乱填,**只能**用于反向对照(必须不被豁免)。 */
const JWT_SHAPED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.ZmFrZXNpZw'
/** 库里真实登记的 key（正向豁免用）。 */
const REGISTERED_API_KEY = 'ihui_0123456789abcdef01234567'

// Mock config: csrf 依赖 config.JWT_SECRET 签名
// ⚠️ 只覆盖 decodeJwt,其余(含 compactVerify)取真实 jose —— CSRF 豁免判据要用 compactVerify
// 验签,整包 mock 掉它会让"真签名也验不过",把正向用例变成假红。
vi.mock('jose', async (importOriginal) => ({
  ...(await importOriginal<typeof JoseModule>()),
  decodeJwt: () => ({}),
}))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// api-key-presence.ts 静态 import db;csrf 钩子动态加载它。桩成内存表:
// 既让"库里有没有这行"可断言,又保证本套件零真库连接(不 mock 的话会真去连库,
// 表现为该用例耗时 2.5s 且结果取决于环境可达性)。
// eq(col, v) 的字面量裹在 SQL 对象的 queryChunks 里一个 Param 形状的 chunk 上。
vi.mock('../src/db/index.js', () => {
  const literalOf = (cond: unknown): string | undefined => {
    const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks
    if (!Array.isArray(chunks)) return undefined
    for (const chunk of chunks) {
      if (typeof chunk === 'string') return chunk
      if (chunk && typeof chunk === 'object') {
        const v = (chunk as { value?: unknown }).value
        if (typeof v === 'string') return v
      }
    }
    return undefined
  }
  const db = {
    select: (_cols?: unknown) => {
      const self = {
        _key: '',
        from: () => self,
        where: (cond: unknown) => {
          self._key = literalOf(cond) ?? ''
          return self
        },
        limit: async () => {
          const row = apiKeyTable.get(self._key)
          return row ? [{ status: row.status, expiresAt: row.expiresAt }] : []
        },
      }
      return self
    },
  }
  return { db, dbRead: db, dbReader: db }
})

import csrfPlugin from '../src/plugins/csrf.js'

/** 用**本服务端密钥**现签一枚真 JWT（正向豁免用）。 */
async function signRealJwt(): Promise<string> {
  return await new SignJWT({ phone: '', familyId: 'f1', roleId: 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('ihui-ai')
    .setAudience('ihui-ai-users')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(TEST_JWT_SECRET))
}

// @vitest-environment node
describe('csrf — 双提交 Cookie 模式', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // @ihui/auth 的 getJwtSecret() 读 process.env.JWT_SECRET(不是 mock 的 config),
    // 两侧必须同源,否则上面现签的"真 JWT"也验不过,正向用例会假红。
    process.env.JWT_SECRET = TEST_JWT_SECRET
    apiKeyTable.clear()
    apiKeyTable.set(REGISTERED_API_KEY, { status: 'active', expiresAt: null })

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

    it('Bearer JWT 请求豁免（判据是凭据自证:本服务端签发的真 JWT）', async () => {
      const jwt = await signRealJwt()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: `Bearer ${jwt}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('bearer 小写也豁免（真 JWT）', async () => {
      const jwt = await signRealJwt()
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: `bearer ${jwt}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('ihui_ 前缀且**库里登记**的 API Key 也豁免(机器凭据不受浏览器 CSRF 约束)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: `Bearer ${REGISTERED_API_KEY}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('同形态但签名伪造的 JWT 不得换取豁免(G-373:形态成立≠凭据有效)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: `Bearer ${JWT_SHAPED_TOKEN}` },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('CSRF')
    })

    it('ihui_ 前缀但**库里不存在**的 Key 不得换取豁免(G-373:前缀≠凭据有效)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/protected',
        headers: { authorization: 'Bearer ihui_abc123' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('CSRF')
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
