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
// 2026-11-02 夹具跟契约(不放松闸门):af867a5db4 起 channels 四条 CRUD 已挂
// requireAdminRouteGuard,该面只认管理员(roleId >= ADMIN_ROLE_ID=1)。本文件此前把
// 登录用户钉成 roleId=0,于是闸门正确地给出 403、用例却仍按旧的"任意登录用户可写"
// 期望 200/201 —— 陈旧的是夹具,不是闸门。这里只把被访问账号换成管理员,
// 下方 requireAdminRouteGuard 与 TOTP 闸保持原样,一条都没放宽。
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  }),
  verifyRefreshToken: vi.fn().mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
  }),
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// 管理员 TOTP 闸(requireAdminRouteGuard 第 4 步)默认 enforce:管理员未绑定 TOTP 会 403。
// 本文件靶面是 channels CRUD 的状态码,不是 TOTP 闸本身;这里模拟"已绑定 TOTP 的合规管理员",
// 档位与闸门逻辑保持不变(不改成 off,也不跳过查询)。
vi.mock('../src/services/totp-service.js', async (importOriginal) => {
  // importOriginal 不带泛型时返回 unknown,先收窄成命名空间对象再展开;
  // 不用 `import()` 类型注解(会被 @typescript-eslint/consistent-type-imports 拒绝)。
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    getTotpStatus: vi.fn().mockResolvedValue({ enabled: true, enabledAt: null }),
  }
})

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

import { notificationExtendedRoutes } from '../src/routes/notification-extended'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const MOCK_UUID = '00000000-0000-4000-8000-000000000001'

describe('notification-extended routes', () => {
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
    await server.register(notificationExtendedRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('401 未授权', () => {
    it('GET /api/notifications/channels 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/channels' })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/notifications/channels 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/notifications/channels',
        body: { name: '邮件渠道', type: 'email' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/channels/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        body: { name: '更新渠道' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/notifications/channels/:id 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/notifications/channels/${MOCK_UUID}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/preferences 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/preferences' })
      expect(res.statusCode).toBe(401)
    })

    it('PUT /api/notifications/preferences 未登录返回 401', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        body: { emailEnabled: false },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/notifications/logs 未登录返回 401', async () => {
      const res = await server.inject({ method: 'GET', url: '/api/notifications/logs' })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('带认证', () => {
    it('GET /api/notifications/channels 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/channels',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('POST /api/notifications/channels 返回 201', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/notifications/channels',
        headers: AUTH_HEADERS,
        body: { name: '邮件渠道', type: 'email', isActive: true },
      })
      expect(res.statusCode).toBe(201)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/notifications/channels/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        headers: AUTH_HEADERS,
        body: { name: '更新渠道名', isActive: false },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('DELETE /api/notifications/channels/:id 返回 200', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/notifications/channels/${MOCK_UUID}`,
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/notifications/preferences 返回 200（无记录时返回默认偏好）', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/preferences',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('PUT /api/notifications/preferences 返回 200', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: '/api/notifications/preferences',
        headers: AUTH_HEADERS,
        body: { emailEnabled: false, pushEnabled: true, types: ['system', 'order'] },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })

    it('GET /api/notifications/logs 返回 200', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().code).toBe(0)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
