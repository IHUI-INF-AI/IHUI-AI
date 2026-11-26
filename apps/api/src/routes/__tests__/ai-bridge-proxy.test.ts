// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ai-service 桥接代理的行为锁(2026-11-23 立)
 *
 * 盯四件容易做错、且做错后端上读不出来的事:
 * ① **三条前缀 × 裸路径/子路径六个口都在册** —— 漏一个口的症状是移动端某个动作
 *    静默 404(本次立因就是 GET /api/prompts 有腿、GET /api/prompts/{id}/content 无腿
 *    这类"半条链"),所以逐个 inject 真路径断言,而不是只看注册表。
 * ② **上游路径逐字不动**(三个 router 都挂 `/api` 前缀)—— 改写错一个段,上游 404
 *    而前端看到的是"列表空",归因链会断在看不见的地方。
 * ③ **未登录绝不发出上游调用**(副作用没发生才算拦住)—— 否则网关成了鉴权旁路,
 *    任何人可借 8802 打 ai-service。
 * ④ **上游 401 ⇒ 502 + UPSTREAM_AUTH_FAILED,而 403/404 原样透传**(L7066 语义)——
 *    把上游凭据问题伪装成 401,api-client 的 401→refresh→登出链会把在线用户踢回登录页;
 *    反过来把 403(如 prompt 管理员闸)也吞成 502,用户就永远看不见"你没权限"这句真话。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAiServiceFetch } = vi.hoisted(() => ({ mockAiServiceFetch: vi.fn() }))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(),
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
}))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
  aiServiceSystemFetch: mockAiServiceFetch,
}))

import { aiBridgeProxyRoutes } from '../ai-bridge-proxy.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-token' }
const USER_ID = '22222222-2222-4222-8222-222222222222'

function mockAuth(): void {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    userId: USER_ID,
    phone: '13800000001',
    roleId: 0,
  } as never)
}

function upstream(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: {
      get: (k: string) => (k === 'content-type' ? 'application/json; charset=utf-8' : null),
    },
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('ai-bridge 代理(移动端开发态 404 根治)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(aiBridgeProxyRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    mockAiServiceFetch.mockReset()
    mockAiServiceFetch.mockResolvedValue(upstream(200, { code: 0, message: 'ok', data: [] }))
  })

  const legs: Array<[string, string]> = [
    ['GET', '/api/prompts'],
    ['POST', '/api/prompts'],
    ['GET', '/api/prompts/p-1'],
    ['PUT', '/api/prompts/p-1'],
    ['DELETE', '/api/prompts/p-1'],
    ['GET', '/api/prompts/p-1/content?version=3'],
    ['POST', '/api/prompts/p-1/rollback'],
    ['GET', '/api/connectors'],
    ['POST', '/api/connectors/config'],
    ['POST', '/api/connectors/sync'],
    ['POST', '/api/connectors/feishu/fetch'],
    ['POST', '/api/connectors/feishu/enable'],
    ['POST', '/api/connectors/feishu/disable'],
    ['DELETE', '/api/connectors/feishu'],
    ['POST', '/api/research/start'],
    ['GET', '/api/research/r-9'],
  ]

  it.each(legs)('%s %s 在册且原样转发到同一上游路径', async (method, url) => {
    const res = await app.inject({ method: method as 'GET', url, headers: AUTH_HEADERS })
    expect(res.statusCode).toBe(200)
    expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
    const call = mockAiServiceFetch.mock.calls[0]
    expect(call?.[1]).toBe(url)
    expect(call?.[2]).toMatchObject({ method })
  })

  it('射程只有三条前缀:其余路径不在册(不成为任意 ai-service 转发器)', async () => {
    for (const url of [
      '/api/llm/complete',
      '/api/admin/users',
      '/api/mcp/tools',
      '/api/chat/history',
    ]) {
      const res = await app.inject({ method: 'GET', url, headers: AUTH_HEADERS })
      expect(res.statusCode).toBe(404)
    }
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('未登录:401 且一次上游调用都不发出(网关不是鉴权旁路)', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(
      Object.assign(new Error('请先登录'), { statusCode: 401 }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/prompts' })
    expect(res.statusCode).toBe(401)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('上游 401 ⇒ 502 + UPSTREAM_AUTH_FAILED(不把服务侧凭据问题伪装成登录失效)', async () => {
    mockAiServiceFetch.mockResolvedValue(upstream(401, { code: 401, message: 'bad key' }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/connectors/sync',
      headers: { ...AUTH_HEADERS, 'content-type': 'application/json' },
      payload: { key: 'feishu' },
    })
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(502)
    expect(body.errorCode).toBe('UPSTREAM_AUTH_FAILED')
  })

  it('上游 403/404 原样透传(权限闸与不存在都必须是真话)', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(upstream(403, { code: 403, message: '需要管理员' }))
    const denied = await app.inject({ method: 'GET', url: '/api/prompts', headers: AUTH_HEADERS })
    expect(denied.statusCode).toBe(403)

    mockAiServiceFetch.mockResolvedValueOnce(
      upstream(404, { code: 404, message: 'no such research' }),
    )
    const nf = await app.inject({ method: 'GET', url: '/api/research/r-x', headers: AUTH_HEADERS })
    expect(nf.statusCode).toBe(404)
  })

  it('上游超时/抛错 ⇒ 502 信封,不裸抛 500', async () => {
    mockAiServiceFetch.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { name: 'AiServiceTimeoutError' }),
    )
    const res = await app.inject({ method: 'GET', url: '/api/connectors', headers: AUTH_HEADERS })
    expect(res.statusCode).toBe(502)
    expect((res.json() as { message?: string }).message).toContain('暂不可用')
  })

  it('无 body 的 GET/DELETE 不给上游强塞 Content-Type(空体带 CT 是 Fastify 400 型)', async () => {
    await app.inject({ method: 'DELETE', url: '/api/connectors/feishu', headers: AUTH_HEADERS })
    const init = mockAiServiceFetch.mock.calls[0]?.[2] as
      { headers?: Record<string, string>; body?: unknown } | undefined
    expect(init?.headers).toBeUndefined()
    expect(init?.body).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
