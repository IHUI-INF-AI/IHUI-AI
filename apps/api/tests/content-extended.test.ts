// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  // 2026-11-08 身份分档:content-extended 自 d050d90d10 起把 10 个内容管理端点
  // 收成 admin-only(BUG-3 收口),夹具必须用管理员身份;AIGC 两个自助端点仍是普通用户面。
  // 按 token 区分角色:user-token ⇒ roleId 0(普通用户),其余 ⇒ roleId 1(管理员)。
  verifyAccessToken: vi.fn((token: string) =>
    Promise.resolve({
      userId: '00000000-0000-4000-8000-000000000001',
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: token === 'user-token' ? 0 : 1,
    }),
  ),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// 2026-08-06 修复:auth.ts P2-14 安全加固新增 getUserStatus 查询,
// mock 返回 status=1(active),避免 401 '用户不存在'
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
// 管理员 TOTP 闸(ADMIN_TOTP_MODE 默认 enforce):夹具里的管理员视为已绑定,
// 否则 requireAdmin 在 roleId 通过后仍会 403,与本测试要验证的授权分档无关。
vi.mock('../src/services/totp-service.js', () => ({
  getTotpStatus: vi.fn().mockResolvedValue({ enabled: true, enabledAt: new Date() }),
}))

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

import { contentExtendedRoutes } from '../src/routes/content-extended'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
// 普通用户(roleId 0)身份:仅 AIGC 两个自助端点应放行
const USER_HEADERS = { authorization: 'Bearer user-token' }
const MOCK_ID = '1'
// carousels.id 是 uuid 列,路由侧 uuidIdParamSchema 已收紧成 z.uuid(防 22P02 ⇒ 500),
// banners 的 :id 走这道闸;MOCK_ID 仍服务 activities/contacts/file-storage(那些路由未收紧),
// 故此处单列合法 UUID,不动共用常量。
const BANNER_UUID = '88888888-8888-4888-8888-888888888888'

describe('content-extended routes', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : error.message,
      })
    })
    await server.register(contentExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/content/activities/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/activities/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/activities 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/activities',
        body: { title: '活动标题', content: '活动内容' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/activities/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/activities/${MOCK_ID}`,
        body: { title: '更新标题' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/activities/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/activities/${MOCK_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/contacts/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/contacts/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/contacts/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/contacts/${MOCK_ID}`,
        body: { status: 'resolved' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/file-storage/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/file-storage/list' })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/content/file-storage/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/file-storage/${MOCK_ID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/aigc/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/aigc/list' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/content/aigc 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/aigc',
        body: { type: 'text', prompt: '生成图片', resultUrl: 'https://example.com/img.png' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/content/banners/list 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/content/banners/list' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/content/banners/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/banners/${BANNER_UUID}`,
        body: { title: '更新横幅' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/content/activities/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/activities/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/content/activities 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/activities',
        headers: AUTH_HEADERS,
        body: { title: '活动标题', content: '活动内容', status: 0 },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/activities/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/activities/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { title: '更新标题', status: 1 },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/content/activities/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/activities/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/contacts/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/contacts/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/contacts/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/contacts/${MOCK_ID}`,
        headers: AUTH_HEADERS,
        body: { status: 1, value: '已处理' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/file-storage/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/file-storage/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/content/file-storage/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/content/file-storage/${MOCK_ID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/aigc/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/aigc/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/content/aigc 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/aigc',
        headers: AUTH_HEADERS,
        body: { type: 'image', prompt: '生成风景画', resultUrl: 'https://example.com/result.png' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/banners/list 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/banners/list',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/content/banners/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/content/banners/${BANNER_UUID}`,
        headers: AUTH_HEADERS,
        body: { title: '更新横幅', isActive: false },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })

  // 2026-11-08 分档钉死:d050d90d10 的 BUG-3 收口只针对 10 个「内容管理」接口;
  // AIGC 是用户自助面(小程序 getAigcList 为普通用户入口,行级主体恒为 request.userId),
  // 不能被全局 requireAdmin 连带拒掉。下面 4 例锁住这条边界。
  describe('普通用户(roleId 0)分档', () => {
    it('GET /api/content/aigc/list 普通用户可读自己的作品', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/aigc/list',
        headers: USER_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/content/aigc 普通用户可创建自己的作品', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/aigc',
        headers: USER_HEADERS,
        body: { gcType: 'text', content: '普通用户的 AIGC 作品' },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/content/activities/list 普通用户仍被拒 403', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/content/activities/list',
        headers: USER_HEADERS,
      })
      expect(res.statusCode).toBe(403)
    })

    it('POST /api/content/activities 普通用户仍被拒 403', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/content/activities',
        headers: USER_HEADERS,
        body: { title: '越权活动', content: '普通用户不应能创建' },
      })
      expect(res.statusCode).toBe(403)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
