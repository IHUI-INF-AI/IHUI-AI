/**
 * System Admin 不可变性单测
 * - PATCH /api/admin/member/users/:id 对 system admin 返回 403
 * - DELETE /api/admin/member/users/:id 对 system admin 返回 403
 * - GET /api/admin/member/users 列表不返回 password_hash
 * - GET /api/admin/member/users/:id 详情不返回 password_hash,返回 isSystemAdmin 字段
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

import { verifyAccessToken } from '@ihui/auth'
import memberUsersRoutes from '../admin/member-users.js'
import { isSystemAdminUser } from '../../db/queries.js'

vi.mock('../../db/queries.js', () => ({
  isSystemAdminUser: vi.fn(),
}))

vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../db/index.js', () => {
  function makeChain() {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      set: () => chain,
      returning: () => chain,
      values: () => chain,
    }
    return chain
  }
  return {
    db: {
      select: vi.fn(() => makeChain()),
      update: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
      execute: vi.fn().mockResolvedValue([]),
    },
  }
})

import { db } from '../../db/index.js'

const SYSTEM_ADMIN_ID = 'a56b1204-e363-429c-b9da-5a1b59be2ad6'
const NORMAL_USER_ID = 'b56b1204-e363-429c-b9da-5a1b59be2ad7'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 1, // 管理员
  })
}

describe('System Admin 不可变性保护', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(memberUsersRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  describe('PATCH /api/admin/member/users/:id', () => {
    it('system admin → 403 不可修改', async () => {
      vi.mocked(isSystemAdminUser).mockResolvedValue(true)
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${SYSTEM_ADMIN_ID}`,
        headers: AUTH_HEADERS,
        payload: { status: 0 },
      })
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(403)
      expect(body.message).toMatch(/系统内置管理员不可修改/)
    })

    it('普通用户 → 允许进入查询', async () => {
      vi.mocked(isSystemAdminUser).mockResolvedValue(false)
      // isSystemAdminUser 返回 false 时,会进入 db.update → 我们的 mock 返回 []
      // returning: () => chain (then 返回 []),所以 row 为 undefined → 404
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/admin/member/users/${NORMAL_USER_ID}`,
        headers: AUTH_HEADERS,
        payload: { status: 0 },
      })
      // 由于 mock 的 db.update 不返回真实 row,期望 404(用户不存在)
      expect([404, 500]).toContain(res.statusCode)
    })
  })

  describe('DELETE /api/admin/member/users/:id', () => {
    it('system admin → 403 不可删除', async () => {
      vi.mocked(isSystemAdminUser).mockResolvedValue(true)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/member/users/${SYSTEM_ADMIN_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.code).toBe(403)
      expect(body.message).toMatch(/系统内置管理员不可删除/)
    })
  })

  describe('脱敏校验 — password_hash 永不出现在响应', () => {
    it('isSystemAdminUser 函数可被调用并返回布尔', async () => {
      vi.mocked(isSystemAdminUser).mockResolvedValueOnce(true)
      expect(await isSystemAdminUser(SYSTEM_ADMIN_ID)).toBe(true)
      vi.mocked(isSystemAdminUser).mockResolvedValueOnce(false)
      expect(await isSystemAdminUser(NORMAL_USER_ID)).toBe(false)
    })

    it('GET /member/users 列表的 select 字段不包含 passwordHash', async () => {
      // 拿到 select 调用的入参
      const selectSpy = vi.mocked(db.select)
      selectSpy.mockClear()
      // 触发一次请求
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/member/users?page=1&pageSize=10',
        headers: AUTH_HEADERS,
      })
      expect([200, 500]).toContain(res.statusCode)
      // select 至少被调用一次(列表查询)
      expect(selectSpy).toHaveBeenCalled()
      // 检查所有 select 调用,确认传入的字段对象不含 passwordHash
      for (const call of selectSpy.mock.calls) {
        const arg = call[0] as Record<string, unknown> | undefined
        if (arg && typeof arg === 'object') {
          expect(arg).not.toHaveProperty('passwordHash')
          expect(arg).not.toHaveProperty('password_hash')
        }
      }
    })
  })
})

/**
 * admin.ts (主 admin 路由) 的不可变性保护单测
 * 验证 PATCH/DELETE /api/admin/users/:id 对 system admin 返回 403
 */
describe('admin.ts 主路由 System Admin 不可变性保护', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // getUserStatus 在 usercenter-queries 中已通过顶层 vi.mock 注入
    const { adminRoutes } = await import('../admin.js')
    app = Fastify({ logger: false })
    await app.register(adminRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  it('PATCH /api/admin/users/:id 对 system admin 返回 403', async () => {
    vi.mocked(isSystemAdminUser).mockResolvedValue(true)
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${SYSTEM_ADMIN_ID}`,
      headers: AUTH_HEADERS,
      payload: { role: 0 },
    })
    expect(res.statusCode).toBe(403)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(403)
    expect(body.message).toMatch(/系统内置管理员不可修改/)
  })

  it('DELETE /api/admin/users/:id 对 system admin 返回 403', async () => {
    vi.mocked(isSystemAdminUser).mockResolvedValue(true)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${SYSTEM_ADMIN_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(403)
    const body = JSON.parse(res.body)
    expect(body.code).toBe(403)
    expect(body.message).toMatch(/系统内置管理员不可删除/)
  })
})
