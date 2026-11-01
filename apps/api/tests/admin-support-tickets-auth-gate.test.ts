// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客服工单 admin 面的鉴权闸(2026-11-01 安全强化)。
 *
 * 立因(回源核对过,不是推测):`apps/api/src/routes/admin-support-tickets.ts` 的四条路由
 * 此前**没有任何 preHandler**,而它被 `admin-missing-routes.ts` 挂进 `/api/admin` 前缀。
 * 匿名请求看着是 401 —— 但那一声来自 `plugins/auth-default-deny.ts` 的兜底闸(名单外 + 无凭据),
 * 兜底闸对"带有效凭据"那一格打的是 `enforce-credential-ok` 并**放行到 handler**。于是任意登录用户:
 *   ① GET /api/admin/support/tickets        ⇒ 读全量他人工单(userId/标题/优先级/状态)
 *   ② PUT  /api/admin/support/tickets/:id/status ⇒ 改他人工单状态(会写 resolvedAt/closedAt)
 *   ③ POST /api/admin/support/tickets/:id/reply  ⇒ 以硬编码 `isAdmin: true` 冒充官方客服回复
 *   ④ GET  /api/admin/support/tickets/:id/replies ⇒ 读他人工单回复正文
 *
 * 本文件钉三件事:越权请求被拒、**副作用一次都没发生**(AGENTS §5「越权用例必须断言副作用没发生」),
 * 以及正向对照(admin 用户确实能走到 handler)—— 只断前两条会把"整片被写死 403"当成修好了。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// 本文件在 apps/api/tests/ ⇒ 仓根是三层上一级(硬规矩:ROOT 由脚本自身位置推导,不用 cwd)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ROUTE_FILE = 'apps/api/src/routes/admin-support-tickets.ts'

const { mockAuthenticate, mockRequireActiveUser, dbTouch } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRequireActiveUser: vi.fn(),
  dbTouch: [] as string[],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: mockRequireActiveUser,
  checkAuth: vi.fn(),
}))

// 记账用的库替身:每个方法都记下"被问过",await 时 resolve 成空数组。
// 目的是能断言"越权请求一次都没问到库"(AGENTS §5),不是模拟真实 SQL 语义。
vi.mock('../src/db/index.js', () => ({ db: chainProxy() }))

function chainProxy(): Record<string, unknown> {
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown[]) => unknown) => res([])
      return (...args: unknown[]) => {
        dbTouch.push(String(prop))
        void args
        return chainProxy()
      }
    },
  })
}

import adminSupportTicketsRoutes from '../src/routes/admin-support-tickets.js'

const ROUTES: Array<[string, string]> = [
  ['GET', '/api/admin/support/tickets'],
  ['PUT', '/api/admin/support/tickets/3b0f6b6a-1c1e-4c2b-9a7a-6d5e4f3a2b1c/status'],
  ['POST', '/api/admin/support/tickets/3b0f6b6a-1c1e-4c2b-9a7a-6d5e4f3a2b1c/reply'],
  ['GET', '/api/admin/support/tickets/3b0f6b6a-1c1e-4c2b-9a7a-6d5e4f3a2b1c/replies'],
]

async function build(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(adminSupportTicketsRoutes, { prefix: '/api/admin' })
  await app.ready()
  return app
}

function asRole(roleId: number): void {
  mockAuthenticate.mockImplementation(async (request: { jwtPayload?: object }) => {
    request.jwtPayload = { userId: 'u-attacker', roleId }
  })
}

function asAnonymous(): void {
  const err = new Error('Authentication required') as Error & { statusCode?: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('/api/admin/support/tickets 的 admin 闸', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    dbTouch.length = 0
    mockAuthenticate.mockReset()
    mockRequireActiveUser.mockReset()
    mockRequireActiveUser.mockResolvedValue(undefined)
    app = await build()
  })

  it('正向对照:admin 用户能走到 handler(否则"整片写死 403"也算修好了)', async () => {
    asRole(1)
    const res = await app.inject({ method: 'GET', url: '/api/admin/support/tickets' })
    expect(res.statusCode).toBe(200)
    expect(dbTouch.length).toBeGreaterThan(0)
  })

  it('普通登录用户(roleId=0):四条路由一律 403,且一次数据库查询都没发出', async () => {
    asRole(0)
    for (const [method, url] of ROUTES) {
      dbTouch.length = 0
      const res = await app.inject({
        method: method as 'GET' | 'PUT' | 'POST',
        url,
        body:
          method === 'PUT'
            ? { status: 'closed' }
            : method === 'POST'
              ? { content: '官方回复' }
              : undefined,
      })
      expect(res.statusCode, `${method} ${url}`).toBe(403)
      expect(dbTouch, `${method} ${url} 越权请求不得触库`).toEqual([])
    }
  })

  it('匿名:401(与修前的"看着像 401"同码,但成因必须是这一片自己的闸)', async () => {
    asAnonymous()
    for (const [method, url] of ROUTES) {
      const res = await app.inject({ method: method as 'GET' | 'PUT' | 'POST', url })
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })

  it('活动检查失败(已注销/封禁)即使 roleId 是 admin 也进不了 admin 面', async () => {
    asRole(1)
    const err = new Error('inactive') as Error & { statusCode?: number }
    err.statusCode = 403
    mockRequireActiveUser.mockRejectedValue(err)
    dbTouch.length = 0
    const res = await app.inject({ method: 'GET', url: '/api/admin/support/tickets' })
    expect(res.statusCode).toBe(403)
    expect(dbTouch).toEqual([])
  })

  it('接线锁:插件体内必须先 addHook 再注册路由(逐条补 preHandler 救不了"以后再加一条忘了挂")', () => {
    const src = readFileSync(join(ROOT, ROUTE_FILE), 'utf8')
    const hook = src.indexOf("server.addHook('preHandler', requireAdminRouteGuard)")
    expect(hook, '缺失插件级 preHandler 闸').toBeGreaterThan(-1)
    const firstRoute = src.search(/\bserver\.(get|post|put|delete|patch)\(/)
    expect(firstRoute, '找不到任何路由注册').toBeGreaterThan(-1)
    expect(hook).toBeLessThan(firstRoute)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
