import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

// =============================================================================
// Mock jose:decodeJwt(plugins/auth.ts 调用以检测 challenge token)
// hoisted 以便每个测试可覆盖返回值
// =============================================================================
const { mockVerifyAccessToken, mockDecodeJwt, fetchMock } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockDecodeJwt: vi.fn(() => ({})),
  fetchMock: vi.fn(),
}))

// Mock config 避免 env 校验触发 process.exit(1)
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
    AI_SERVICE_URL: 'http://ai-service.test:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// Mock @ihui/auth:verifyAccessToken(plugins/auth.ts 调用)
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// Mock jose:decodeJwt — 默认返回非 challenge token
vi.mock('jose', () => ({ decodeJwt: mockDecodeJwt }))

// P2-14 fix:authenticate 调用 getUserStatus 查询用户状态,需 mock 返回 active
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

// Mock db:避免真实 DB 连接(/koubo/generate 不读库,但模块加载时导入 db)
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

// 替换全局 fetch(/koubo/generate 代理调用)
global.fetch = fetchMock as unknown as typeof fetch

import { selfMediaRoutes } from '../src/routes/self-media-routes.js'

const AI_SERVICE_URL = 'http://ai-service.test:8803'
const USER_TOKEN = 'Bearer user-token'
const ADMIN_TOKEN = 'Bearer admin-token'

function mockRegularUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000002',
    phone: '13800000002',
    familyId: '00000000-0000-4000-8000-000000000003',
    roleId: 0,
    type: 'access',
  })
  mockDecodeJwt.mockReturnValue({ type: 'access' })
}

function mockAdmin() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 1,
    type: 'access',
  })
  mockDecodeJwt.mockReturnValue({ type: 'access' })
}

/** 构造 fetch mock 返回值,模拟 Response 的最小接口(.status / .headers.get / .text) */
function makeUpstreamResponse(body: string, status: number, contentType?: string) {
  return {
    status,
    headers: {
      get: (key: string) => (key.toLowerCase() === 'content-type' ? (contentType ?? null) : null),
    },
    text: () => Promise.resolve(body),
  }
}

describe('self-media routes — POST /api/self-media/koubo/generate', () => {
  const server = Fastify({ logger: false, pluginTimeout: 60000 })

  beforeAll(async () => {
    await server.register(selfMediaRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockVerifyAccessToken.mockReset()
    mockDecodeJwt.mockReset()
    mockDecodeJwt.mockReturnValue({ type: 'access' })
    fetchMock.mockReset()
  })

  // ===========================================================================
  // 1. 鉴权验证
  // ===========================================================================
  describe('鉴权', () => {
    it('未携带 Authorization header 返回 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.code).toBe(401)
      expect(body.message).toMatch(/Authentication/i)
    })

    it('token 无效(verifyAccessToken 抛错)返回 401', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'))
      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.code).toBe(401)
      expect(body.message).toContain('Invalid or expired token')
    })

    it('challenge token 不能用于普通端点,返回 401(2FA 安全加固)', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'u1', type: 'access' })
      mockDecodeJwt.mockReturnValue({ type: 'challenge' })
      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: 'Bearer challenge-token' },
      })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body.code).toBe(401)
      expect(body.message).toContain('Challenge token')
    })

    it('未携带 token 但有 auth_token cookie 时仍走鉴权(cookie 兜底)', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'))
      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { cookie: 'auth_token=expired-token' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  // ===========================================================================
  // 2. 代理行为验证(成功路径)
  // ===========================================================================
  describe('代理行为', () => {
    it('成功转发到 ai-service 并透传上游 JSON 响应', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: { script: '口播稿内容' } }),
          200,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'AI 编程', duration: 60 },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data.script).toBe('口播稿内容')

      // 验证代理调用参数
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, opts] = fetchMock.mock.calls[0]
      expect(url).toBe(`${AI_SERVICE_URL}/api/self-media/koubo/generate`)
      expect(opts?.method).toBe('POST')
      const headers = opts?.headers as Record<string, string>
      expect(headers.authorization).toBe(USER_TOKEN)
      expect(headers['Content-Type']).toBe('application/json')
      expect(opts?.body).toBe(JSON.stringify({ topic: 'AI 编程', duration: 60 }))
    })

    it('请求体为空时转发 {}(body ?? {} 兜底)', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: {} }),
          200,
          'application/json',
        ),
      )

      await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
      })

      expect(fetchMock).toHaveBeenCalledOnce()
      const opts = fetchMock.mock.calls[0][1]
      expect(opts?.body).toBe('{}')
    })

    it('转发 Authorization header 到 ai-service(共享鉴权上下文)', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(makeUpstreamResponse('{"ok":true}', 200, 'application/json'))

      await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: 'Bearer my-jwt-token' },
      })

      const opts = fetchMock.mock.calls[0][1]
      expect((opts?.headers as Record<string, string>).authorization).toBe('Bearer my-jwt-token')
    })

    it('普通用户(roleId=0)也能访问 — 路由无 admin 限制', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: {} }),
          200,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('admin 用户(roleId=1)也能访问', async () => {
      mockAdmin()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: {} }),
          200,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: ADMIN_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(200)
    })

    it('api 层不做 schema 校验,任意请求体透传到 ai-service(参数校验由 ai-service 负责)', async () => {
      // 注:POST /koubo/generate 是纯代理,不像 /record 有 recordSchema 校验。
      // 缺字段 / 非法值的 400 由 ai-service 返回,api 层透传上游状态码。
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 400, message: 'topic is required' }),
          400,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: {/* 缺 topic */},
      })

      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      // 验证空对象也被透传
      expect(fetchMock.mock.calls[0][1]?.body).toBe('{}')
    })
  })

  // ===========================================================================
  // 3. 错误处理(ai-service 不可用 / 上游异常)
  // ===========================================================================
  describe('错误处理', () => {
    it('ai-service 不可用(fetch reject)返回 502', async () => {
      mockRegularUser()
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(502)
      const body = res.json()
      expect(body.code).toBe(502)
      expect(body.message).toBe('ai-service unavailable')
    })

    it('上游返回非 JSON 时透传原始文本', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(makeUpstreamResponse('plain text error', 500))

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(500)
      expect(res.body).toBe('plain text error')
    })

    it('上游返回 500 状态码透传(不吞错误)', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 500, message: 'upstream error' }),
          500,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(500)
      const body = res.json()
      expect(body.code).toBe(500)
      expect(body.message).toBe('upstream error')
    })

    it('上游 JSON 解析失败时透传原始文本(content-type 声明 JSON 但 body 非法)', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(makeUpstreamResponse('{not valid json', 200, 'application/json'))

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('{not valid json')
    })

    it('上游返回 201 Created 透传', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: { id: 'rec-1' } }),
          201,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.id).toBe('rec-1')
    })
  })

  // ===========================================================================
  // 4. 响应格式统一性验证
  // ===========================================================================
  describe('响应格式', () => {
    it('鉴权失败响应含 code/message 字段(error() 格式)', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(401)
    })

    it('ai-service 不可用响应含 code/message 字段(error() 格式)', async () => {
      mockRegularUser()
      fetchMock.mockRejectedValue(new Error('network down'))

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body.code).toBe(502)
    })

    it('成功路径透传上游 { code, message, data } 结构', async () => {
      mockRegularUser()
      fetchMock.mockResolvedValue(
        makeUpstreamResponse(
          JSON.stringify({ code: 0, message: 'success', data: { foo: 'bar' } }),
          200,
          'application/json',
        ),
      )

      const res = await server.inject({
        method: 'POST',
        url: '/api/self-media/koubo/generate',
        headers: { authorization: USER_TOKEN },
        payload: { topic: 'test' },
      })
      const body = res.json()
      expect(body).toHaveProperty('code')
      expect(body).toHaveProperty('message')
      expect(body).toHaveProperty('data')
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
    })
  })
})
