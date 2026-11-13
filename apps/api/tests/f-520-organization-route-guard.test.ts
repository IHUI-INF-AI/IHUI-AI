// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-520 回归锁(2026-11-13)。
 *
 * 病灶:routes/organization.ts 的 GET /organizations/list 只调 authenticate,
 * 任意登录用户即可枚举全部组织;该文件当时未进注册表,注册即越权。
 *
 * 本轮选保留方案:list 补 requireAdmin 并把文件正式注册到 /api。
 * 本文件锁住该决议:
 *   ① 无 token → 401;
 *   ② 普通成员(roleId 0)→ 403;
 *   ③ 源锁:list 注册处带 requireAdmin,且 routes/index.ts 确实注册了本插件
 *      (防止它退回未注册的死文件,也防止守卫被摘掉)。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 只替身鉴权入口:角色由请求头决定,便于同时演"未登录 / 普通成员"两档。
// requireAdmin 本身保持真实实现,否则本锁量不到守卫。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const roleId = Number(request.headers['x-test-role-id'] ?? 0)
    request.userId = 'f520-user'
    request.jwtPayload = { userId: 'f520-user', roleId } as never
  }),
  requireActiveUser: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([{ id: 'mock-id', count: 0 }]) },
  dbRead: { execute: vi.fn().mockResolvedValue([]) },
  dbClient: {},
  dbScoped: {},
  dbReadScoped: {},
  returningOne: vi.fn(),
  closeDbPools: vi.fn(),
}))

import { organizationRoutes } from '../src/routes/organization.js'

const USER_HEADERS = { authorization: 'Bearer f520-user-token', 'x-test-role-id': '0' }

describe('F-520 /api/organizations/list 必须要求管理员', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(organizationRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('① 无 token 返回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/organizations/list' })
    expect(res.statusCode).toBe(401)
  })

  it('② 普通成员返回 403(不再暴露全部组织)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/organizations/list',
      headers: USER_HEADERS,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(403)
  })

  it('③ 源锁:list 注册段带 requireAdmin', () => {
    const src = readFileSync('src/routes/organization.ts', 'utf-8')
    const at = src.indexOf("server.get('/organizations/list'")
    expect(at).toBeGreaterThan(-1)
    expect(src.slice(at, at + 160)).toContain('preHandler: requireAdmin')
  })

  it('④ 源锁:routes/index.ts 已注册 organizationRoutes', () => {
    const indexSrc = readFileSync('src/routes/index.ts', 'utf-8')
    expect(indexSrc).toContain("import { organizationRoutes } from './organization.js'")
    expect(indexSrc).toContain("server.register(organizationRoutes, { prefix: '/api' })")
  })
})
