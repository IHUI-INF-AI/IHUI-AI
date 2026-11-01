// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
const { authClaims } = vi.hoisted(() => ({
  // 可变主体声明:默认普通成员(roleId 0)。组织面在"安全强化第 12 批"补了 requireAdmin,
  // 本文件的替身必须能同时演"成员被拒"和"管理员放行"两档 —— 只留一档,任何一侧的回归都量不出来。
  authClaims: {
    current: {
      userId: '00000000-0000-4000-8000-000000000001',
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    } as { userId: string; phone: string; familyId: string; roleId: number },
  },
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn(async () => ({ ...authClaims.current })),
  verifyRefreshToken: vi.fn(async () => ({ ...authClaims.current })),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// 2026-08-06 修复:auth.ts P2-14 安全加固新增 getUserStatus 查询,
// mock 返回 status=1(active),避免 401 '用户不存在'
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('../src/db/index.js', () => {
  function createChain(result: unknown[] = [{ id: 'mock-id' }]) {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => Promise.resolve(result).then(resolve),
    }
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning']) {
      chain[m] = () => chain
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([{ id: 'mock-id', count: 0 }]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { organizationRoutes } from '../src/routes/organization'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_ORG_ID = 'org-001'
const MOCK_USER_ID = '00000000-0000-4000-8000-000000000002'

describe('organization routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(organizationRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/organizations/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/organizations/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organizations',
        body: { name: '测试组织' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        body: { name: '更新组织' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/members 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/organizations/:id/members 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        body: { userId: MOCK_USER_ID, role: 'member' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/organizations/:id/members/:userId 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/organizations/:id/tree 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/tree`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/organizations/:id/members/:userId/role 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}/role`,
        body: { role: 'admin' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/organizations/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/organizations/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/organizations 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/organizations',
        headers: AUTH_HEADERS,
        body: { name: '测试组织', description: '用于测试' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    // 〔改判留痕@2026-11-01〕以下三档原写"普通成员返回 200",钉的正是 fail-open 那一格:
    // 组织面的 PUT/DELETE/成员列表此前**没挂角色闸**,任何登录用户都能改删他人组织。
    // 补 requireAdmin(见 routes/organizations.ts 的 preHandler)后,成员一律 403;
    // 管理员放行由下面那条正向对照钉,而 requireAdmin 自身的三档契约由
    // tests/o13b-requireadmin-pilot.test.ts 与 o13b-batch2/3/4 系列钉住,本文件不复算判据。
    it('PUT /api/organizations/:id 普通成员返回 403', async () => {
      authClaims.current = { ...authClaims.current, roleId: 0 }
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        headers: AUTH_HEADERS,
        body: { name: '更新组织名' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('DELETE /api/organizations/:id 普通成员返回 403', async () => {
      authClaims.current = { ...authClaims.current, roleId: 0 }
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })

    it('GET /api/organizations/:id/members 普通成员返回 403', async () => {
      authClaims.current = { ...authClaims.current, roleId: 0 }
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })

    it('正向对照:同一批端点管理员不被角色闸挡(否则"整片 403"也能骗过上面三条)', async () => {
      authClaims.current = { ...authClaims.current, roleId: 1 }
      const tries: Array<[string, string, unknown?]> = [
        ['PUT', `/api/organizations/${MOCK_ORG_ID}`, { name: '管理员改名' }],
        ['GET', `/api/organizations/${MOCK_ORG_ID}/members`, undefined],
      ]
      for (const [method, url, body] of tries) {
        const res = await server.inject({
          method: method as 'PUT' | 'GET',
          url,
          headers: AUTH_HEADERS,
          ...(body ? { body } : {}),
        })
        expect(res.statusCode, `${method} ${url}`).not.toBe(403)
      }
      authClaims.current = { ...authClaims.current, roleId: 0 }
    })

    it('POST /api/organizations/:id/members 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/organizations/${MOCK_ORG_ID}/members`,
        headers: AUTH_HEADERS,
        body: { userId: MOCK_USER_ID, role: 'member' },
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('DELETE /api/organizations/:id/members/:userId 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('GET /api/organizations/:id/tree 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/organizations/${MOCK_ORG_ID}/tree`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).not.toBe(401)
    })

    it('PUT /api/organizations/:id/members/:userId/role 带认证返回非 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/organizations/${MOCK_ORG_ID}/members/${MOCK_USER_ID}/role`,
        headers: AUTH_HEADERS,
        body: { role: 'admin' },
      })
      expect(res.statusCode).not.toBe(401)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
