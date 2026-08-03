import { describe, it, expect, vi } from 'vitest'

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
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

vi.mock('../src/db/index.js', () => ({
  db: new Proxy({}, { get: () => () => new Proxy({}, { get: () => () => Promise.resolve([]) }) }),
}))

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
    if (opts?.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`)
    return parts.join('; ')
  }

  const plugin = async (instance: import('fastify').FastifyInstance): Promise<void> => {
    instance.decorateRequest('cookies', null)
    instance.addHook(
      'onRequest',
      (
        request: import('fastify').FastifyRequest,
        _reply: import('fastify').FastifyReply,
        done: () => void,
      ) => {
        const cookieHeader = request.headers.cookie
        ;(request as unknown as { cookies: Record<string, string> }).cookies =
          typeof cookieHeader === 'string' ? parseCookieHeader(cookieHeader) : {}
        done()
      },
    )
    instance.decorateReply(
      'setCookie',
      function (this: import('fastify').FastifyReply, name: string, value: string, opts?: CookieOpts) {
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
      function (this: import('fastify').FastifyReply, name: string, opts?: CookieOpts) {
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
  }, 60000)
})

