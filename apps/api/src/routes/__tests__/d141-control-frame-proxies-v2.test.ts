// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控制帧补齐票(2026-11-06)· api 代理层四帧的落地证明
 *
 * 覆盖 `mcp_reconnect` / `mcp_toggle` 的 MCP 上游转发,以及
 * `get_context_usage` / `stop_task` / `seed_read_state` 的引擎 JSON-RPC 白名单代理。
 * 判据与 D141 首册一致,另加一条**白名单**锁:网关不是 ai-service 的通用代理,
 * 未登记的方法必须 400 且一次都不转发。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceFetch } = vi.hoisted(() => ({
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
  __esModule: true,
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import { mcpExtendedRoutes } from '../mcp-extended.js'
import engineControlFrameRoutes from '../engine-control-frames.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '11111111-1111-4111-8111-111111111111'

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000000',
    roleId: 0,
  } as never)
}

function upstreamJson(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json; charset=utf-8' },
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

type FetchCall = [unknown, string, { method?: string; body?: string }]

describe('2026-11-06 控制帧 · api 代理层', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(mcpExtendedRoutes, { prefix: '/api' })
    await app.register(engineControlFrameRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    mockAiServiceFetch.mockReset()
  })

  // ==========================================================================
  // mcp_reconnect
  // ==========================================================================

  describe('mcp_reconnect: POST /api/mcp/external/servers/:name/reconnect', () => {
    it('转发到上游 /connect 并原样带回 server 摘要', async () => {
      const upstream = { connected: true, name: 'my-svr', tools: ['t1'] }
      mockAiServiceFetch.mockResolvedValue(upstreamJson(upstream))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/my-svr/reconnect',
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
      expect(res.statusCode).toBe(200)
      const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      // (重)连接语义复用上游既有 connect 端点,不另造
      expect(pathArg).toBe('/api/mcp/external/servers/my-svr/connect')
      expect(initArg.method).toBe('POST')
      expect(res.json().data).toEqual(upstream)
    })

    it('serverName 必须编码(空格/斜杠不许截断上游路径)', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ connected: true }))

      const res = await app.inject({
        method: 'POST',
        url: `/api/mcp/external/servers/${encodeURIComponent('a b/c')}/reconnect`,
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(res.statusCode).toBe(200)
      const [, pathArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/mcp/external/servers/a%20b%2Fc/connect')
    })

    it('上游 404 原样透出(没有这台就是没有这台)', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ error: 'MCP Server 不存在: nope' }, 404))

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/nope/reconnect',
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(res.statusCode).toBe(404)
    })

    it('未登录 ⇒ 401 且一次都不转发', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValue(
        Object.assign(new Error('请先登录'), { statusCode: 401 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/external/servers/my-svr/reconnect',
        payload: {},
      })

      expect(res.statusCode).toBe(401)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // mcp_toggle
  // ==========================================================================

  describe('mcp_toggle: POST /api/mcp/store/:name/toggle', () => {
    it('enabled=true ⇒ 转发上游 enable', async () => {
      mockAiServiceFetch.mockResolvedValue(
        upstreamJson({ ok: true, name: 'srv', enabled: true, running: true, tool_count: 3 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/store/srv/toggle',
        headers: AUTH_HEADERS,
        payload: { enabled: true },
      })

      expect(res.statusCode).toBe(200)
      const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/mcp/store/srv/enable')
      expect(initArg.method).toBe('POST')
    })

    it('enabled=false ⇒ 转发上游 disable', async () => {
      mockAiServiceFetch.mockResolvedValue(
        upstreamJson({ ok: true, name: 'srv', enabled: false, running: false, tool_count: 0 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/store/srv/toggle',
        headers: AUTH_HEADERS,
        payload: { enabled: false },
      })

      expect(res.statusCode).toBe(200)
      const [, pathArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/mcp/store/srv/disable')
    })

    it('enabled 非布尔 ⇒ 400 且一次都不转发(不许猜默认开)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/store/srv/toggle',
        headers: AUTH_HEADERS,
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })

    it('上游 403 原样透出(归属/权限的结论不能被网关盖掉)', async () => {
      mockAiServiceFetch.mockResolvedValue(
        upstreamJson({ error: '无权启停该 MCP Server: srv' }, 403),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/mcp/store/srv/toggle',
        headers: AUTH_HEADERS,
        payload: { enabled: true },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ==========================================================================
  // 引擎 RPC 三帧白名单代理
  // ==========================================================================

  describe('引擎控制帧: POST /api/engine/rpc', () => {
    it('thread.interrupt 原样转发,JSON-RPC 包络不改写', async () => {
      const envelope = {
        jsonrpc: '2.0',
        id: 'x',
        result: { threadId: 'th_1', interrupted: true, mode: 'cancel', status: 'idle', checkpointId: 'ckp' },
      }
      mockAiServiceFetch.mockResolvedValue(upstreamJson(envelope))

      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        headers: AUTH_HEADERS,
        payload: { jsonrpc: '2.0', id: 'x', method: 'thread.interrupt', params: { threadId: 'th_1' } },
      })

      expect(res.statusCode).toBe(200)
      const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
      expect(pathArg).toBe('/api/engine/rpc')
      expect(JSON.parse(initArg.body ?? '{}')).toMatchObject({
        method: 'thread.interrupt',
        params: { threadId: 'th_1' },
      })
      expect(res.json().data).toEqual(envelope)
    })

    it('thread.contextUsage / thread.seedReadState 同样在白名单内', async () => {
      for (const method of ['thread.contextUsage', 'thread.seedReadState']) {
        mockAiServiceFetch.mockResolvedValue(upstreamJson({ jsonrpc: '2.0', id: 'x', result: {} }))
        const res = await app.inject({
          method: 'POST',
          url: '/api/engine/rpc',
          headers: AUTH_HEADERS,
          payload: { jsonrpc: '2.0', id: 'x', method, params: {} },
        })
        expect(res.statusCode).toBe(200)
        const [, pathArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
        expect(pathArg).toBe('/api/engine/rpc')
        mockAiServiceFetch.mockReset()
      }
    })

    it('非白名单方法 ⇒ 400 且一次都不转发(网关≠通用 RPC 代理)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        headers: AUTH_HEADERS,
        payload: { jsonrpc: '2.0', id: 'x', method: 'thread.delete', params: { threadId: 'th_1' } },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('thread.delete')
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })

    it('非对象请求体(数组)⇒ 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        headers: AUTH_HEADERS,
        payload: [] as never,
      })

      expect(res.statusCode).toBe(400)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })

    it('上游 500 如实透出,不包成 200', async () => {
      mockAiServiceFetch.mockResolvedValue(upstreamJson({ error: 'engine boom' }, 500))

      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        headers: AUTH_HEADERS,
        payload: { jsonrpc: '2.0', id: 'x', method: 'thread.interrupt', params: { threadId: 'th_1' } },
      })

      expect(res.statusCode).toBe(500)
      expect(res.json().data).toBeUndefined()
    })

    it('连不上 ai-service ⇒ 502', async () => {
      mockAiServiceFetch.mockRejectedValue(new Error('connect ECONNREFUSED'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        headers: AUTH_HEADERS,
        payload: { jsonrpc: '2.0', id: 'x', method: 'thread.interrupt', params: { threadId: 'th_1' } },
      })

      expect(res.statusCode).toBe(502)
    })

    it('未登录 ⇒ 401 且一次都不转发', async () => {
      vi.mocked(verifyAccessToken).mockRejectedValue(
        Object.assign(new Error('请先登录'), { statusCode: 401 }),
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/engine/rpc',
        payload: { jsonrpc: '2.0', id: 'x', method: 'thread.interrupt', params: { threadId: 'th_1' } },
      })

      expect(res.statusCode).toBe(401)
      expect(mockAiServiceFetch).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
