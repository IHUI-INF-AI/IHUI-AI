// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({ sub: 'admin', roleId: 1 }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
}))

// 2026-08-06 修复:auth.ts P2-14 安全加固新增 getUserStatus 查询,
// mock 返回 status=1(active),避免 401 '用户不存在'
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('../src/db/index.js', () => {
  // then 陷阱 mock:db.xxx() 返回可 await 对象(await 访问 .then → thenFn → resolve([]))
  // 2026-09-03 修复:原嵌套 Proxy(db.execute 返回 Proxy 而非 Promise)导致
  // live-gifts.ts 插件注册顶层 await db.execute() 永不 resolve → avvio 60s 超时。
  const make = () => {
    const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return () => make()
      },
    })
    return proxy
  }
  return { db: make(), dbRead: make() }
})

// Mock @fastify/cookie:同 csrf.test.ts,用 fastify-plugin 包装避免 encapsulation 作用域问题。
// 仅补这一项 cookie mock,验证 buildServer 是否能在最小 cookie mock 下完整 ready。
vi.mock('@fastify/cookie', async () => {
  const { default: fp } = await import('fastify-plugin')

  type CookieOpts = {
    path?: string
    domain?: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: string | boolean
    maxAge?: number
  }

  function parseCookieHeader(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {}
    for (const pair of cookieHeader.split(';')) {
      const trimmed = pair.trim()
      if (!trimmed) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const k = trimmed.slice(0, eq)
      const v = trimmed.slice(eq + 1)
      try {
        cookies[k] = decodeURIComponent(v)
      } catch {
        cookies[k] = v
      }
    }
    return cookies
  }

  function buildCookieString(name: string, value: string, opts?: CookieOpts): string {
    const parts = [`${name}=${value}`]
    if (opts?.path) parts.push(`Path=${opts.path}`)
    if (opts?.domain) parts.push(`Domain=${opts.domain}`)
    if (opts?.httpOnly) parts.push('HttpOnly')
    if (opts?.secure) parts.push('Secure')
    if (opts?.sameSite) parts.push(`SameSite=${opts.sameSite}`)
    if (opts?.maxAge !== null && opts?.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
    return parts.join('; ')
  }

  const plugin = async (instance: FastifyInstance): Promise<void> => {
    instance.decorateRequest('cookies', null)
    instance.addHook(
      'onRequest',
      (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
        const cookieHeader = request.headers.cookie
        ;(request as unknown as { cookies: Record<string, string> }).cookies =
          typeof cookieHeader === 'string' ? parseCookieHeader(cookieHeader) : {}
        done()
      },
    )
    instance.decorateReply(
      'setCookie',
      function (this: FastifyReply, name: string, value: string, opts?: CookieOpts) {
        const cookieStr = buildCookieString(name, value, opts)
        const existing = this.getHeader('set-cookie')
        if (existing === undefined) {
          this.header('set-cookie', cookieStr)
        } else if (Array.isArray(existing)) {
          this.header('set-cookie', [...existing, cookieStr])
        } else {
          this.header('set-cookie', [existing as string, cookieStr])
        }
        return this
      },
    )
    instance.decorateReply(
      'clearCookie',
      function (this: FastifyReply, name: string, opts?: CookieOpts) {
        const cookieStr = `${name}=; Path=${opts?.path ?? '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
        this.header('set-cookie', cookieStr)
        return this
      },
    )
    instance.decorate('signCookie', vi.fn())
    instance.decorate('unsignCookie', vi.fn())
    instance.decorate('unsign', vi.fn())
  }

  return { default: fp(plugin, { name: '@fastify/cookie', fastify: '5.x' }) }
})

describe('server smoke', () => {
  it('buildServer() can start without route conflicts', async () => {
    const { buildServer } = await import('../src/server.js')
    const server = await buildServer()
    expect(server).toBeDefined()
    await server.close()
    // 2026-09-03:60s→180s。单跑实测 ~40s, turbo 全量 24 包并发时资源竞争
    // 曾致 liveGiftsRoutes 插件 60s 未就绪误报超时;180s 留足并发余量(纯 smoke,无性能断言)
  }, 180000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
