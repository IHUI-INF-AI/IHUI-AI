// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-55 / F-101 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * F-55:oauth-keys 是平台级 OIDC 签名密钥管理面,原本只挂 authenticate —— 任意登录用户
 *       可 generate/rotate/revoke,一次调用就能让全站 ID Token 与 JWKS 失效。
 *       修复:整插件 preHandler 换成 requireAdmin。
 * F-101:mcp_servers 是无属主全局表,POST/DELETE 会改全站共享配置且 endpoint 可指向
 *       任意地址(SSRF 面)。修复:两条写路由加 requireAdmin preHandler。
 *
 * 判据直接打在真实 requireAdmin 上(仅 authenticate 用桩注入身份),回退到 authenticate
 * 或去掉 preHandler 时,非管理员会一路走到业务层,断言随之转红。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  // 管理员 TOTP 闸置 off:本套件只验证 roleId 权限闸,不掺 TOTP 绑定态查询
  process.env.ADMIN_TOTP_MODE = 'off'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown> }) => {
    const userId = request.headers['x-test-user'] as string | undefined
    if (!userId) {
      const e = new Error('Authentication required') as Error & { statusCode?: number }
      e.statusCode = 401
      throw e
    }
    const roleId = Number(request.headers['x-test-role'] ?? 0)
    Object.assign(request, { userId, jwtPayload: { userId, roleId } })
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

/** 只读链:任何 select 链都在 await 时返回空集,避免测试触库。 */
function selectChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  chain.orderBy = () => chain
  chain.limit = () => chain
  chain.then = (resolve: (v: unknown) => void) => resolve([])
  return chain
}

vi.mock('../src/db/index.js', () => ({
  db: { select: () => selectChain(), insert: vi.fn() },
  dbRead: { select: () => selectChain() },
  dbClient: {},
}))

import { oauthKeysRoutes } from '../src/routes/oauth-keys.js'
import { aiFrontendRoutes } from '../src/routes/ai-frontend-routes.js'

const USER = '00000000-0000-4000-8000-0000000000aa'
const ADMIN = '00000000-0000-4000-8000-0000000000bb'

function authHeaders(id: string, role: number): Record<string, string> {
  return { 'x-test-user': id, 'x-test-role': String(role) }
}

describe('F-55 oauth-keys 平台密钥面仅管理员可达', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify()
    await app.register(oauthKeysRoutes, { prefix: '/oauth-keys' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('普通登录用户读 active 密钥 → 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth-keys/active',
      headers: authHeaders(USER, 0),
    })
    expect(res.statusCode).toBe(403)
  })

  it('管理员读 active 密钥 → 200(证明闸门只挡非管理员,未误伤)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/oauth-keys/active',
      headers: authHeaders(ADMIN, 1),
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('F-101 MCP 服务器写接口仅管理员可达', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify()
    await app.register(aiFrontendRoutes)
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('普通登录用户创建 MCP 服务器 → 403(不再写全局配置)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/mcp/servers',
      headers: authHeaders(USER, 0),
      payload: { name: 'evil', endpoint: 'http://169.254.169.254/latest' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('普通登录用户删除 MCP 服务器 → 403', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/ai/mcp/servers/00000000-0000-4000-8000-0000000000cc',
      headers: authHeaders(USER, 0),
    })
    expect(res.statusCode).toBe(403)
  })

  it('管理员通过闸门(非法载荷得到 400 而非 403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ai/mcp/servers',
      headers: authHeaders(ADMIN, 1),
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
