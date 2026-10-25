// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * GET /api/edu/qa 契约测试(2026-10-25,r27h 席:死端点簇复量遗留收尾)。
 *
 * 判据(同族先例:tests/g962-b8-mobile-routes.test.ts 的"在册+401 闸"形态,
 * 过闸形态参考 tests/admin-circle-posts.test.ts 的真 checkAuth + mock @ihui/auth):
 * 1. 在册 —— 请求不得落 FST_ERR_NOT_FOUND(路由 404 与业务 404 以响应体 message 区分);
 * 2. 鉴权闸 —— eduFrontendRoutes 插件层 addHook(checkAuth),无 token 真 401;
 * 3. 包裹形状 —— {code:0, message:'success', data} 统一包裹,data.list 为数组、data.total 为数字;
 * 4. 分页参数 —— page/pageSize 默认 1/20 且透传给 findAllCommunityPosts;pageSize>100 被 400 拦;
 *    search 缺省时 status='published',给 search 时不强制 published(现读实现行为)。
 * 不连任何 DB(db/usercenter-queries/learn-extended-queries 均为 mock)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

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

const { mockVerifyAccessToken, mockSelectResult, mockFindAllCommunityPosts } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockFindAllCommunityPosts: vi.fn().mockResolvedValue({ list: [], total: 0 }),
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// auth.ts P2-14 验签后查用户状态,mock 返回 1(active),避免 401 '用户不存在'
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/index.js', () => {
  // 链式 db 桩:thenable 走 mockSelectResult(覆盖本插件 import 的全部查询模块)
  const chain = () => {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    const make = (): Record<string, unknown> => {
      const proxy = new Proxy({} as Record<string, unknown>, {
        get(_t, prop: string) {
          if (prop === 'then') return thenFn
          return vi.fn().mockReturnValue(make())
        },
      })
      return proxy
    }
    return make()
  }
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => chain()),
      update: vi.fn(() => chain()),
      delete: vi.fn(() => chain()),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: vi.fn(() => chain()) },
  }
})

// 只替换 GET /edu/qa 实际消费的 findAllCommunityPosts,其余导出走真模块(顶层仅 import db,已被 mock)
vi.mock('../src/db/learn-extended-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db/learn-extended-queries.js')>()
  return { ...actual, findAllCommunityPosts: mockFindAllCommunityPosts }
})

import { eduFrontendRoutes } from '../src/routes/edu-frontend-routes.js'

/** 路由级 404(Fastify 默认 not-found 体)与业务 404 区分(同族 g962-b8 判据) */
function isRouteMissing(res: { statusCode: number; body: string }): boolean {
  if (res.statusCode !== 404) return false
  try {
    return /not found/i.test((JSON.parse(res.body) as { message?: string }).message ?? '')
  } catch {
    return false
  }
}

function authAs() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
  })
}

describe('GET /api/edu/qa 契约(在册+鉴权闸+包裹形状+分页)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const e = err instanceof Error ? err : new Error(String(err))
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : e.message })
  })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts:1102 同款前缀
    await server.register(eduFrontendRoutes, { prefix: '/api' })
    await server.ready()
  })

  beforeEach(() => {
    // 只清调用记录(保留 implementation),防跨用例断言污染
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await server.close()
  })

  it('未带 token 回 401(在册且真鉴权闸,非路由 404)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/edu/qa' })
    expect(isRouteMissing(res), 'GET /api/edu/qa 未注册').toBe(false)
    expect(res.statusCode).toBe(401)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(401)
    expect(typeof body.message).toBe('string')
    expect(mockFindAllCommunityPosts).not.toHaveBeenCalled()
  })

  it('带 token 回 200,{code,message,data} 包裹且分页默认 1/20、status=published 透传', async () => {
    authAs()
    mockFindAllCommunityPosts.mockResolvedValueOnce({
      list: [{ id: 'p1', lessonId: null }],
      total: 1,
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/edu/qa',
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      message: string
      data: { list: unknown[]; total: number }
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(body.data.total).toBe(1)
    expect(mockFindAllCommunityPosts).toHaveBeenCalledTimes(1)
    expect(mockFindAllCommunityPosts).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      status: 'published',
    })
  })

  it('?page=3&pageSize=7 透传给查询;带 search 时不强制 published', async () => {
    authAs()
    mockFindAllCommunityPosts.mockResolvedValueOnce({ list: [], total: 0 })
    const res = await server.inject({
      method: 'GET',
      url: '/api/edu/qa?page=3&pageSize=7&search=%E5%85%A5%E9%97%A8',
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockFindAllCommunityPosts).toHaveBeenCalledWith({
      page: 3,
      pageSize: 7,
      search: '入门',
      status: undefined,
    })
  })

  it('pageSize>100 违反分页上限契约回 400', async () => {
    authAs()
    const res = await server.inject({
      method: 'GET',
      url: '/api/edu/qa?page=1&pageSize=101',
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { code?: number }
    expect(body.code).toBe(400)
    expect(mockFindAllCommunityPosts).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
