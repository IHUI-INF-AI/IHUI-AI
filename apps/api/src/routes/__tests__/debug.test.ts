import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// mock 鉴权插件:默认注入 userId,允许单测覆盖为 reject 模拟 401
vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(),
}))

// mock ai-service fetch:隔离真实网络调用,仅测代理透传逻辑
vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(),
}))

import { debugRoutes } from '../debug.js'
import { authenticate } from '../../plugins/auth.js'
import { aiServiceFetch } from '../../utils/ai-service-fetch.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }

/**
 * 构造模拟的 ai-service 上游 Response。
 * proxyDebug 调用 upstream.text() + upstream.headers.get('content-type') + upstream.status。
 */
function makeUpstream(
  status: number,
  body: unknown,
  contentType = 'application/json',
): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    status,
    text: async () => text,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
  } as unknown as Response
}

/** 默认鉴权通过:注入 userId,与真实 authenticate 行为一致 */
function mockAuth(userId = 'test-user-id'): void {
  vi.mocked(authenticate).mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return { userId } as never
  })
}

describe('Debug API (/api/debug/*) — 代理到 ai-service', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(debugRoutes, { prefix: '/api/debug' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  describe('鉴权', () => {
    it('未鉴权(无 token)返回 401', async () => {
      vi.mocked(authenticate).mockRejectedValue(
        Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/sessions',
      })
      expect(res.statusCode).toBe(401)
      // 鉴权失败时不应调用 aiServiceFetch
      expect(aiServiceFetch).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/debug/launch — 启动调试会话', () => {
    it('成功透传:验证 aiServiceFetch 被调用且路径正确', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, { code: 0, message: 'success', data: { sessionId: 'dbg-1' } }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/debug/launch',
        headers: AUTH_HEADERS,
        payload: { language: 'python', program: 'main.py' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.sessionId).toBe('dbg-1')
      // 验证透传路径 + method
      expect(aiServiceFetch).toHaveBeenCalledWith(
        expect.anything(),
        '/api/v1/debug/launch',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('body 被透传到上游(JSON 序列化)', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(makeUpstream(200, { ok: true }))
      await app.inject({
        method: 'POST',
        url: '/api/debug/launch',
        headers: AUTH_HEADERS,
        payload: { language: 'node', program: 'app.js', args: ['--port', '3000'] },
      })
      const init = vi.mocked(aiServiceFetch).mock.calls[0]![2] as { body?: string }
      expect(init.body).toBeDefined()
      const parsed = JSON.parse(init.body!) as { program: string }
      expect(parsed.program).toBe('app.js')
    })
  })

  describe('GET /api/debug/sessions — 列出会话', () => {
    it('成功透传:GET 请求不转发 body', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, { code: 0, data: { sessions: [] } }),
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      const init = vi.mocked(aiServiceFetch).mock.calls[0]![2] as { body?: string; method: string }
      expect(init.method).toBe('GET')
      // GET 请求不应设置 body
      expect(init.body).toBeUndefined()
    })
  })

  describe('POST /api/debug/sessions/:sessionId/breakpoints — 设置断点', () => {
    it('成功透传:sessionId 编码到路径', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, { code: 0, data: { breakpoints: [] } }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/debug/sessions/dbg-1/breakpoints',
        headers: AUTH_HEADERS,
        payload: { file: 'main.py', lines: [{ line: 10 }] },
      })
      expect(res.statusCode).toBe(200)
      expect(aiServiceFetch).toHaveBeenCalledWith(
        expect.anything(),
        '/api/v1/debug/sessions/dbg-1/breakpoints',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('POST /api/debug/sessions/:sessionId/continue — 继续执行', () => {
    it('成功透传', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, { code: 0, data: { stopped: false } }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/debug/sessions/dbg-1/continue',
        headers: AUTH_HEADERS,
        payload: {},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.stopped).toBe(false)
      expect(aiServiceFetch).toHaveBeenCalledWith(
        expect.anything(),
        '/api/v1/debug/sessions/dbg-1/continue',
        expect.anything(),
      )
    })
  })

  describe('DELETE /api/debug/sessions/:sessionId — 断开会话', () => {
    it('成功透传', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, { code: 0, data: { disconnected: true } }),
      )
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/debug/sessions/dbg-1',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.disconnected).toBe(true)
      expect(aiServiceFetch).toHaveBeenCalledWith(
        expect.anything(),
        '/api/v1/debug/sessions/dbg-1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('错误透传', () => {
    it('ai-service 返回 404 时透传 404', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(404, { code: 404, message: 'session not found' }),
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/sessions/nope/stack',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toBe('session not found')
    })

    it('ai-service 返回 500 时透传 500', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(500, { code: 500, message: 'internal error' }),
      )
      const res = await app.inject({
        method: 'POST',
        url: '/api/debug/launch',
        headers: AUTH_HEADERS,
        payload: { language: 'python', program: 'main.py' },
      })
      expect(res.statusCode).toBe(500)
      expect(res.json().message).toBe('internal error')
    })

    it('ai-service 网络异常返回 502', async () => {
      vi.mocked(aiServiceFetch).mockRejectedValue(new Error('fetch failed: ECONNREFUSED'))
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toContain('ai-service unavailable')
    })

    it('非 JSON 响应体原样透传为 text', async () => {
      vi.mocked(aiServiceFetch).mockResolvedValue(
        makeUpstream(200, 'plain-text-response', 'text/plain'),
      )
      const res = await app.inject({
        method: 'GET',
        url: '/api/debug/sessions',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('plain-text-response')
    })
  })
})
