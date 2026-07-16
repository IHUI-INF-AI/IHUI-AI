import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('../../db/index.js', () => {
  function createChain(result: unknown[] = []): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      groupBy: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { adminSysRoutes } from '../admin-sys.js'
import { verifyAccessToken } from '@ihui/auth'
import { db } from '../../db/index.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-admin-token' }

function mockAdminAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: 'mock-admin-id',
    phone: '13800000000',
    familyId: '11111111-1111-1111-1111-111111111111',
    roleId: 1,
  })
}

function mockNoAuth(): void {
  vi.mocked(verifyAccessToken).mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )
}

describe('Admin Sys — /online endpoints', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminSysRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminAuth()
  })

  describe('GET /online/list', () => {
    it('无 auth 返回 401', async () => {
      mockNoAuth()
      const res = await app.inject({ method: 'GET', url: '/api/admin/online/list' })
      expect(res.statusCode).toBe(401)
    })

    it('管理员返回活跃会话列表', async () => {
      const mockSessions = [
        {
          tokenId: 'token-1',
          userId: 'user-1',
          username: 'admin',
          nickname: '管理员',
          avatar: null,
          roleId: 1,
          loginAt: new Date('2025-01-01'),
          expiresAt: new Date('2025-12-31'),
          familyId: 'family-1',
        },
        {
          tokenId: 'token-2',
          userId: 'user-2',
          username: 'student',
          nickname: '学生',
          avatar: 'https://example.com/a.png',
          roleId: 0,
          loginAt: new Date('2025-06-01'),
          expiresAt: new Date('2025-12-31'),
          familyId: 'family-2',
        },
      ]
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockSessions),
              }),
            }),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/online/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(2)
      expect(body.data.list[0].tokenId).toBe('token-1')
      expect(body.data.total).toBe(2)
    })

    it('无活跃会话时返回空列表', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/online/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toEqual([])
      expect(body.data.total).toBe(0)
    })
  })

  describe('DELETE /online/:tokenId', () => {
    it('无 auth 返回 401', async () => {
      mockNoAuth()
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/online/non-existent-token',
      })
      expect(res.statusCode).toBe(401)
    })

    it('撤销活跃会话返回 200', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'token-active' }]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/online/token-active',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.tokenId).toBe('token-active')
      expect(body.data.forced).toBe(true)
    })

    it('重复撤销已注销会话返回 404 (幂等性)', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/online/token-already-revoked',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toContain('不存在或已注销')
    })
  })

  describe('sys_operlog 审计埋点', () => {
    it('DELETE 请求触发后写入 sys_operlog(businessType=3)', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'token-audit' }]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/online/token-audit',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)

      // 等待 setImmediate 异步落库完成
      await new Promise((resolve) => setImmediate(resolve))

      // db.insert 在 createOperlog 中被调用(在线会话撤销也走 update,故只验证 insert 被调用)
      expect(db.insert).toHaveBeenCalled()
    })

    it('GET 请求不触发 operlog 写入(insert 调用次数不增加)', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      } as never)

      const insertCountBefore = vi.mocked(db.insert).mock.calls.length
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/online/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)

      await new Promise((resolve) => setImmediate(resolve))
      const insertCountAfter = vi.mocked(db.insert).mock.calls.length
      // GET 请求不应触发 operlog insert
      expect(insertCountAfter).toBe(insertCountBefore)
    })
  })

  describe('role/authUser 角色用户管理(5 端点)', () => {
    it('GET /role/authUser/allocatedList 无 roleId 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/role/authUser/allocatedList',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.message).toContain('roleId')
    })

    it('GET /role/authUser/allocatedList 有效 roleId 返回列表', async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () =>
                  Promise.resolve([
                    { id: 'u-1', username: 'admin', nickname: '管理员', roleId: 1 },
                  ]),
              }),
            }),
          }),
        }),
      } as never)
      vi.mocked(db.select).mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ count: 1 }]),
        }),
      } as never)

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/role/authUser/allocatedList?roleId=1',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.total).toBe(1)
      expect(body.data.list[0].id).toBe('u-1')
    })

    it('PUT /role/authUser/cancel 取消用户角色', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'u-1' }]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/role/authUser/cancel',
        headers: AUTH_HEADERS,
        payload: { roleId: 1, userId: 'u-1' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.success).toBe(true)
    })

    it('PUT /role/authUser/cancelAll 批量取消', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'u-1' }, { id: 'u-2' }]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/role/authUser/cancelAll?roleId=1&userIds=u-1,u-2',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.success).toBe(true)
      expect(body.data.affected).toBe(2)
    })

    it('PUT /role/authUser/selectAll 批量分配', async () => {
      vi.mocked(db.update).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'u-1' }, { id: 'u-2' }]),
          }),
        }),
      } as never)

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/role/authUser/selectAll?roleId=2&userIds=u-1,u-2',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.success).toBe(true)
      expect(body.data.affected).toBe(2)
    })
  })
})
