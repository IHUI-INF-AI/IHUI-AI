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

// 2026-09-10 修复:scheduler/queue 插件基于 BullMQ,BullMQ 命令需真实 Redis
// (maxRetriesPerRequest:null 下无 Redis 永不 resolve):
// - scheduler 注册期逐条 await upsertJobScheduler → avvio "Plugin did not start in time"
// - queue 的 onClose 逐个 await queue.close() → server.close() 永不返回
// smoke 只验证 buildServer 路由无冲突,不验证队列行为 → 均替换为 stub 队列。
vi.mock('../src/plugins/queue.js', async () => {
  const { default: fp } = await import('fastify-plugin')
  const stubQueue = () =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') return undefined
          return () => Promise.resolve(undefined)
        },
      },
    )
  const queueStub = async (server: FastifyInstance): Promise<void> => {
    server.decorate('emailQueue', stubQueue())
    server.decorate('notificationQueue', stubQueue())
    server.decorate('aiCallbackQueue', stubQueue())
    server.decorate('notificationDispatchQueue', stubQueue())
  }
  return {
    queue: fp(queueStub, { name: 'queue', fastify: '5.x' }),
    QUEUE_NAMES: {
      email: 'email',
      notification: 'notification',
      aiCallback: 'ai-callback',
      notificationDispatch: 'notification-dispatch',
    },
    createWorker: vi.fn(),
  }
})
vi.mock('../src/plugins/scheduler.js', async () => {
  const { default: fp } = await import('fastify-plugin')
  const schedulerStub = async (server: FastifyInstance): Promise<void> => {
    server.decorate('schedulerQueue', {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    })
  }
  return { scheduler: fp(schedulerStub, { name: 'scheduler', fastify: '5.x' }) }
})

// 2026-09-10 修复:CI ubuntu 无 Redis 服务。src 内多个插件(redis/ws-notifications 等)
// 直接 new IORedis(config.REDIS_URL) 并 await 命令(psubscribe 等),无 Redis 时命令永不
// resolve → avvio 插件启动超时。mock ioredis 为"立即就绪"的假客户端:任意命令返回
// Promise.resolve(null),保留 EventEmitter 语义。注:bullmq 在 node_modules 内部原生加载
// 真实 ioredis,不受此 mock 影响 —— 依赖 BullMQ 注册期 await 的 scheduler 已单独 mock。
vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('node:events')
  class FakeRedis extends EventEmitter {
    status = 'ready'
    options: Record<string, unknown> = {}
    duplicate(): FakeRedis {
      // 返回同样被代理的实例,保证 duplicate 出来的客户端任意命令也可 resolve
      return new (FakeRedisProxy as unknown as { new (): FakeRedis })()
    }
    disconnect(): void {}
  }
  // 代理实例属性访问:未显式定义的方法(psubscribe/publish/ping/get/set/quit/...)
  // 一律返回 () => Promise.resolve(null),与"立即就绪"语义一致
  const FakeRedisProxy = new Proxy(FakeRedis, {
    construct(_target, args) {
      const instance = new FakeRedis(...(args as []))
      return new Proxy(instance, {
        get(target, prop, recv) {
          if (prop in target) return Reflect.get(target, prop, recv)
          return (..._a: unknown[]) => Promise.resolve(null)
        },
      })
    },
  })
  return { default: FakeRedisProxy, Redis: FakeRedisProxy }
})

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
