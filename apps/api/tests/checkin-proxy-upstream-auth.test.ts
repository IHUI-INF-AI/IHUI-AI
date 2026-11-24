// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L7066(G-396 拍板执行,2026-10-23):/api/checkin/* 代理的"非会话下游 401"映射。
 * 判据:本层 checkAuth 先验会话 ⇒ 会话已证实有效;此后下游仍回 401 只可能是
 * 服务侧凭据被 ai-service 拒收,出栈必须 502 + UPSTREAM_AUTH_FAILED ——
 * 不再伪装 401 让 packages/api-client 的 refresh→登出链把用户踢去重新登录。
 * 真会话过期的 401 由 checkAuth 在转发之前发出,fetch 不得被调(链语义不变)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const { mockCheckAuth, mockFetch } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    isProductionGuard: false,
    AI_SERVICE_URL: 'http://upstream.test:8803',
  },
}))

import checkinProxyRoutes from '../src/routes/checkin-proxy.js'
import {
  mapNonSessionUpstreamStatus,
  upstreamAuthFailedBody,
  UPSTREAM_AUTH_FAILED,
} from '../src/utils/upstream-auth.js'

function fakeUpstreamResponse(status: number, body: string, contentType = 'application/json') {
  return {
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  }
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(checkinProxyRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckAuth.mockResolvedValue(true)
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('L7066 checkin-proxy 非会话下游 401 ⇒ 502/UPSTREAM_AUTH_FAILED', () => {
  it('本地会话过 + 下游 401 ⇒ 出栈 502 + 独立 errorCode,不透传下游体', async () => {
    mockFetch.mockResolvedValue(fakeUpstreamResponse(401, '{"message":"token expired"}'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/checkin/accounts',
      headers: { authorization: 'Bearer session-token' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().errorCode).toBe(UPSTREAM_AUTH_FAILED)
    expect(res.json().code).toBe(502)
    expect(res.payload).not.toContain('token expired')
  })

  it('转发目标 = AI_SERVICE_URL + 原路径(含 query)', async () => {
    mockFetch.mockResolvedValue(fakeUpstreamResponse(200, '{"ok":true}'))
    await app.inject({
      method: 'GET',
      url: '/api/checkin/accounts?x=1',
      headers: { authorization: 'Bearer t' },
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![0]).toBe('http://upstream.test:8803/api/checkin/accounts?x=1')
  })

  it('下游 200 ⇒ 状态与体原样透传', async () => {
    mockFetch.mockResolvedValue(fakeUpstreamResponse(200, '{"data":[1,2]}'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/checkin/accounts',
      headers: { authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.json()).toEqual({ data: [1, 2] })
  })

  it('下游 500 ⇒ 原样透传(映射只针对 401)', async () => {
    mockFetch.mockResolvedValue(fakeUpstreamResponse(500, '{"e":"boom"}'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/checkin/accounts',
      headers: { authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ e: 'boom' })
  })

  it('会话在本层被拒 ⇒ 401 出栈且 fetch 未被调(真会话过期链不变)', async () => {
    mockCheckAuth.mockImplementation(async (_request: unknown, reply: FastifyReply) => {
      reply.status(401).send({ code: 401, message: 'Invalid or expired token' })
      return false
    })
    const res = await app.inject({ method: 'GET', url: '/api/checkin/accounts' })
    expect(res.statusCode).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('下游拒连(fetch 抛) ⇒ 502 签到服务暂不可用(既有兜底不变)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/checkin/accounts',
      headers: { authorization: 'Bearer t' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('签到服务暂不可用')
  })
})

describe('L7066 helper 纯函数', () => {
  it('mapNonSessionUpstreamStatus:仅 401 ⇒ 502,其余原样', () => {
    expect(mapNonSessionUpstreamStatus(401)).toBe(502)
    expect(mapNonSessionUpstreamStatus(200)).toBe(200)
    expect(mapNonSessionUpstreamStatus(403)).toBe(403)
    expect(mapNonSessionUpstreamStatus(404)).toBe(404)
    expect(mapNonSessionUpstreamStatus(500)).toBe(500)
  })

  it('upstreamAuthFailedBody:502 + 独立 errorCode 形态', () => {
    const body = upstreamAuthFailedBody()
    expect(body.code).toBe(502)
    expect(body.errorCode).toBe('UPSTREAM_AUTH_FAILED')
    expect(body.message).toContain('非您的登录状态')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
