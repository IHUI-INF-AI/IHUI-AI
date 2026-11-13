// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-97 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/v1/ai/capabilities/invoke 不把调用者身份/计费上下文带进 LLM 层,
 * callRealLlm 用 aiServiceFetch(null, ...) 注入系统票(成本记在系统身份、无用户配额);
 * 任何异常都被 catch 成 200 + success:true 的合成文案,上游 401/429/超时对客户端恒成功。
 *
 * 本文件锁:
 *   ① 成功路径:透传调用者 Authorization,按 userId 走余额预检/结算/记账,返回上游真实正文;
 *   ② 上游 401 / 500:如实返回 502 错误体(不再是 200 伪成功、不出现降级文案);
 *   ③ 网络错误:502,不得落回 200;
 *   ④ 上游 200 但正文为空:502,不得回填 input 冒充成功;
 *   ⑤ 无凭证:401,且根本不发起上游调用;
 *   ⑥ 余额不足:402(计费闸生效),且不发起上游调用;
 *   ⑦ 源锁:invoke 处理器显式携带 userId + request,且不再有降级伪成功文案。
 *
 * 只 mock authenticate / db / 计费与日志依赖 / 全局 fetch,不触达真实 ai-service、PG、Redis。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  getWalletBalance: vi.fn(),
  settleWalletUsage: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f97-user'
  }),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/plugins/token-balance-service.js', () => ({
  getWalletBalance: mocks.getWalletBalance,
  settleWalletUsage: mocks.settleWalletUsage,
}))

vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/services/context-manager-service.js', () => ({ estimateTokens: () => 10 }))

vi.mock('../src/utils/retired-providers.js', () => ({
  resolveDefaultChatModel: () => 'agnes/agnes-2.5-flash',
}))

import { authenticate } from '../src/plugins/auth.js'
import { error } from '../src/utils/response.js'
import aiCapabilitiesRoutes from '../src/routes/user/ai-capabilities-routes.js'

const USER_TOKEN = 'Bearer f97-user-token'

const PAYLOAD = { capability_id: 'chat', input: '你好,介绍一下你自己' }

describe('F-97 /v1/ai/capabilities/invoke 必须带调用者身份并如实报错', () => {
  let app: FastifyInstance
  const fetchMock = vi.fn<typeof fetch>()

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock)
    app = Fastify({ logger: false })
    // 与 routes/user/index.ts 同构:统一鉴权 preHandler + 子路由
    await app.register(
      async (server) => {
        server.addHook('preHandler', async (request, reply) => {
          try {
            await authenticate(request)
          } catch (e) {
            const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
            return reply
              .status(statusCode)
              .send(error(statusCode, (e as Error).message || '操作失败,请稍后重试'))
          }
        })
        await server.register(aiCapabilitiesRoutes)
      },
      { prefix: '/api' },
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    fetchMock.mockReset()
    mocks.getWalletBalance.mockReset().mockResolvedValue(100_000)
    mocks.settleWalletUsage
      .mockReset()
      .mockResolvedValue({ deducted: 1, remaining: 99_999, shortfall: 0 })
    mocks.resolveAiCost.mockReset().mockResolvedValue({ cost: 1, currency: 'CNY', pricing: null })
    mocks.recordAiCost.mockReset().mockResolvedValue(undefined)
  })

  const call = (headers: Record<string, string> = { authorization: USER_TOKEN }) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/ai/capabilities/invoke',
      headers,
      payload: PAYLOAD,
    })

  const upstreamJson = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  it('① 成功路径:透传调用者 Authorization,按 userId 计费,返回上游真实正文', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamJson({
        content: '  真实能力结果  ',
        model: 'agnes/agnes-2.5-flash',
        usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
        stub: false,
      }),
    )

    const res = await call()
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: {
        success: boolean
        capability_id: string
        result: string
        model: string
        stub: boolean
      }
    }
    expect(body.code).toBe(0)
    expect(body.data.success).toBe(true)
    expect(body.data.capability_id).toBe('chat')
    expect(body.data.result).toBe('真实能力结果')
    expect(body.data.model).toBe('agnes/agnes-2.5-flash')
    expect(body.data.stub).toBe(false)

    // 鉴权通道:出站带调用者自己的凭证(不是系统票)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('/api/llm/complete')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(USER_TOKEN)
    expect(headers['Content-Type']).toBe('application/json')

    // 计费通道:归属调用者 userId,而不是系统身份
    expect(mocks.getWalletBalance).toHaveBeenCalledWith('f97-user')
    expect(mocks.recordAiCost).toHaveBeenCalledTimes(1)
    expect((mocks.recordAiCost.mock.calls[0]![0] as { userId: string }).userId).toBe('f97-user')
  })

  it('② 上游 401:如实返回 502,不再是 200 + 降级文案', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"detail":"Not authenticated"}', { status: 401 }))

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; message: string; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
    expect(body.message).toContain('AI 服务调用失败')
    expect(res.body).not.toContain('已降级')
  })

  it('③ 上游 500:如实返回 502,不再伪成功', async () => {
    fetchMock.mockResolvedValueOnce(new Response('upstream down', { status: 500 }))

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
    expect(res.body).not.toContain('已降级')
  })

  it('④ 网络错误:502,不得落回 200', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))

    const res = await call()
    expect(res.statusCode).toBe(502)
    expect((res.json() as { code: number }).code).toBe(502)
    expect(res.body).not.toContain('已降级')
  })

  it('⑤ 上游 200 但正文为空:502,不得回填 input 冒充成功', async () => {
    fetchMock.mockResolvedValueOnce(
      upstreamJson({ content: '   ', model: 'agnes/agnes-2.5-flash', usage: {} }),
    )

    const res = await call()
    expect(res.statusCode).toBe(502)
    const body = res.json() as { code: number; data?: unknown }
    expect(body.code).toBe(502)
    expect(body.data).toBeUndefined()
    expect(res.body).not.toContain(PAYLOAD.input)
  })

  it('⑥ 无凭证:401,且不发起上游调用', async () => {
    const res = await call({})

    expect(res.statusCode).toBe(401)
    expect((res.json() as { code: number }).code).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.getWalletBalance).not.toHaveBeenCalled()
  })

  it('⑦ 余额不足:402 计费闸生效,且不发起上游调用', async () => {
    mocks.getWalletBalance.mockResolvedValue(0)

    const res = await call()
    expect(res.statusCode).toBe(402)
    const body = res.json() as { code: number; errorCode?: string }
    expect(body.code).toBe(402)
    expect(body.errorCode).toBe('INSUFFICIENT_BALANCE')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.recordAiCost).not.toHaveBeenCalled()
  })

  it('⑧ 源锁:invoke 处理器显式携带 userId + request,且无降级伪成功文案', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/user/ai-capabilities-routes.ts', import.meta.url)),
      'utf8',
    )
    const start = src.indexOf("server.post('/v1/ai/capabilities/invoke'")
    const end = src.indexOf("server.post('/v1/ai/capabilities/auto-match'")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)

    expect(block).toContain('userId,')
    expect(block).toContain('request,')
    expect(block).not.toContain('已降级')
    expect(block).not.toContain('LLM 调用失败已降级')
  })
})
