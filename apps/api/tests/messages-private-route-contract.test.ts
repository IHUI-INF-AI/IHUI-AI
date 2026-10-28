// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * GET /api/messages/private/list + POST /api/messages/private 契约测试
 * (2026-10-25,r27h 席:死端点簇复量遗留收尾;private 面此前无真 401 闸契约测试)。
 *
 * 判据(同族先例:tests/g962-b8-mobile-routes.test.ts 的"在册+401 闸"形态,
 * 过闸形态参考 tests/admin-circle-posts.test.ts 的真 checkAuth + mock @ihui/auth):
 * 1. 在册 —— 请求不得落 FST_ERR_NOT_FOUND(路由 404 与业务 404 以响应体 message 区分);
 * 2. 鉴权闸 —— messageRoutes 插件层 addHook(checkAuth),无 token 真 401(GET/POST 同闸);
 * 3. 包裹形状 —— {code:0, message:'success', data} 统一包裹;
 *    GET list 的 data.list 为数组、page/pageSize 数字回显;POST 的 data.message 为落库行。
 * 不连任何 DB(db/usercenter-queries 均为 mock)。
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

const { mockVerifyAccessToken, mockSelectResult, mockInsertReturning } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertReturning: vi
    .fn()
    .mockResolvedValue([{ id: 'pm-1', senderId: 'u-001', receiverId: 'u-002', content: 'hi' }]),
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
  // select 链:thenable 走 mockSelectResult;insert 链:returning 固定回一行(POST /private 消费)
  const selectChain = () => {
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
  const insertChain = () => ({
    values: vi.fn().mockReturnValue({ returning: mockInsertReturning }),
  })
  return {
    db: {
      select: vi.fn(() => selectChain()),
      insert: vi.fn(() => insertChain()),
      update: vi.fn(() => selectChain()),
      delete: vi.fn(() => selectChain()),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: vi.fn(() => selectChain()) },
  }
})

import { messageRoutes } from '../src/routes/message.js'

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

describe('messages/private 契约(在册+鉴权闸+包裹形状)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  server.setErrorHandler((err, _req, reply) => {
    const e = err instanceof Error ? err : new Error(String(err))
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
    reply
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : e.message })
  })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts:654 同款前缀
    await server.register(messageRoutes, { prefix: '/api' })
    await server.ready()
  })

  beforeEach(() => {
    // 只清调用记录(保留 implementation),防跨用例断言污染
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/messages/private/list 未带 token 回 401(在册且真鉴权闸,非路由 404)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/messages/private/list' })
    expect(isRouteMissing(res), 'GET /api/messages/private/list 未注册').toBe(false)
    expect(res.statusCode).toBe(401)
    const body = res.json() as { code?: number; message?: string }
    expect(body.code).toBe(401)
    expect(typeof body.message).toBe('string')
  })

  it('GET list 带 token 回 200,{code,message,data} 包裹且 page/pageSize 数字回显', async () => {
    authAs()
    mockSelectResult.mockResolvedValueOnce([
      { id: 'pm-1', senderId: 'u-001', receiverId: 'u-002', content: 'hi' },
    ])
    const res = await server.inject({
      method: 'GET',
      url: '/api/messages/private/list?page=2&pageSize=6',
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      message: string
      data: { list: unknown[]; page: number; pageSize: number }
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(Array.isArray(body.data.list)).toBe(true)
    expect(body.data.page).toBe(2)
    expect(body.data.pageSize).toBe(6)
  })

  it('POST /api/messages/private 未带 token 回 401(同一鉴权闸)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/messages/private',
      payload: { receiverId: 'u-002', content: 'hi' },
    })
    expect(isRouteMissing(res), 'POST /api/messages/private 未注册').toBe(false)
    expect(res.statusCode).toBe(401)
    expect(mockInsertReturning).not.toHaveBeenCalled()
  })

  it('POST 带 token 合法 body 回 201,data.message 为落库行', async () => {
    authAs()
    const res = await server.inject({
      method: 'POST',
      url: '/api/messages/private',
      payload: { receiverId: 'u-002', content: 'hi' },
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      code: number
      message: string
      data: { message: { id: string; content: string } }
    }
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.message.id).toBe('pm-1')
    expect(body.data.message.content).toBe('hi')
    expect(mockInsertReturning).toHaveBeenCalledTimes(1)
  })

  it('POST 缺 receiverId 不落库(400/500 由错误处理器收敛,绝不 201)', async () => {
    authAs()
    const res = await server.inject({
      method: 'POST',
      url: '/api/messages/private',
      payload: { content: 'hi' },
      headers: { authorization: 'Bearer user-token' },
    })
    // 同族先例(apps/api/test/messages.test.ts POST /private 段)对 Zod throw 的收敛两态容忍
    expect([400, 500]).toContain(res.statusCode)
    expect(mockInsertReturning).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
