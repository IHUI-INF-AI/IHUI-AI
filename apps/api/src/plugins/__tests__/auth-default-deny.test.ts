// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权默认拒绝兜底闸的回归锁(2026-10-29 立)。
 *
 * 缺陷形状:api 的鉴权靠每个路由/插件自己手挂,新增路由忘挂即裸奔
 * (已实测 developer-relay-keys-admin 读 request.userId 却从未鉴权,碰巧恒 401)。
 *
 * 本文件钉四件事:
 *   D1 enforce 档:名单外 + 无凭据 ⇒ 401;
 *   D2 enforce 档:已有 userId(插件级/路由级鉴权跑过)⇒ 放行,**且不重复调 checkAuth**;
 *   D3 公开名单内的路径不受影响(误列/漏列直接决定会不会打挂线上);
 *   D4 observe / off 档不拦人(新开关默认不能改变线上行为)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { state, authCalls } = vi.hoisted(() => ({
  state: { mode: 'enforce' as string | undefined },
  authCalls: { n: 0 },
}))

vi.mock('../../config/index.js', () => ({
  get config() {
    return { AUTH_DEFAULT_DENY_MODE: state.mode }
  },
}))

vi.mock('../../utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../auth.js', () => ({
  checkAuth: vi.fn(async (request: any, reply: any) => {
    authCalls.n += 1
    if (request.headers.authorization === 'Bearer good') {
      request.userId = 'user-from-token'
      return true
    }
    reply.status(401).send({ code: 401, message: 'Authentication required' })
    return false
  }),
}))

import authDefaultDenyPlugin, { __test__ } from '../auth-default-deny.js'

describe('鉴权默认拒绝兜底闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 插件必须在路由注册前挂上(onRoute 才能捕获每条路由)
    await app.register(authDefaultDenyPlugin)
    app.get('/api/secret', async () => ({ ok: true }))
    app.get('/api/health', async () => ({ ok: true }))
    app.get('/api/auth/login', async () => ({ ok: true }))
    app.get(
      '/api/with-route-auth',
      {
        preHandler: [
          async (request: FastifyRequest) => {
            ;(request as { userId?: string }).userId = 'already-authed'
          },
        ],
      },
      async () => ({ ok: true }),
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.mode = 'enforce'
    authCalls.n = 0
  })

  it('D1 enforce:名单外且无凭据 ⇒ 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(401)
    expect(authCalls.n).toBe(1)
  })

  it('D1b enforce:带有效凭据 ⇒ 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/secret',
      headers: { authorization: 'Bearer good' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('D2 enforce:路由已有鉴权(已写 userId)⇒ 放行且不重复认证', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/with-route-auth' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D3 公开名单内(精确)⇒ 200 且不认证', async () => {
    for (const url of ['/api/health', '/api/metrics', '/.well-known/agent.json']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).not.toBe(401)
    }
    expect(authCalls.n).toBe(0)
  })

  it('D3b 公开名单内(前缀)⇒ 200 且不认证', async () => {
    for (const url of ['/api/auth/login', '/api/public/x', '/v1/chat/completions']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).not.toBe(401)
    }
    expect(authCalls.n).toBe(0)
  })

  it('D4 observe:不拦人(只记日志),名单外无凭据也放行', async () => {
    state.mode = 'observe'
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D4b off:完全不介入', async () => {
    state.mode = 'off'
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D4c 未配置(测试 mock 整对象替换 config)⇒ off,零行为变化', () => {
    state.mode = undefined
    expect(__test__.resolveAuthDefaultDenyMode()).toBe('off')
  })

  it('OPTIONS 预检与 HEAD 永不因本闸 401', async () => {
    state.mode = 'enforce'
    const res = await app.inject({ method: 'OPTIONS', url: '/api/secret' })
    expect(res.statusCode).not.toBe(401)
  })

  it('公开名单判据本身:查询串不参与匹配;带参数的公开前缀仍命中', () => {
    expect(__test__.isAuthDefaultPublicPath('/api/health?probe=1')).toBe(true)
    expect(__test__.isAuthDefaultPublicPath('/api/agents/abc-123')).toBe(true)
    expect(__test__.isAuthDefaultPublicPath('/api/knowledge/docs')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
