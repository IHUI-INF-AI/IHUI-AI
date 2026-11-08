// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-93 回归锁(2026-11-08)。
 *
 * 病灶:/openrouter-proxy/chat/completions 直接拿平台 OPENROUTER_API_KEY 透传,
 *       无余额闸、无结算、无超时,上游错误体还会原样回吐。
 * 判据:零积 402 且不打上游;成功路径按 usage 结算;上游 5xx 不回吐响应体;超时 502。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../src/routes/ai-vendors/proxy-llm.js', () => ({
  ensurePointsBalance: vi.fn(),
  chargePointsForCall: vi.fn(),
}))
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({ recordUsage: vi.fn() }))

import proxyRoutes from '../src/routes/user/proxy-routes.js'
import { ensurePointsBalance, chargePointsForCall } from '../src/routes/ai-vendors/proxy-llm.js'

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    post: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    get: vi.fn((path: string, handler: Handler) => handlers.set(path, handler)),
    addHook: vi.fn(),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeReply() {
  return {
    code: 200,
    body: undefined as unknown,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

const PAYLOAD = { model: 'openai/gpt-4o', messages: [{ role: 'user', content: 'hi' }] }

describe('F-93 OpenRouter 代理必须过余额闸与结算', () => {
  let handler: Handler
  beforeEach(async () => {
    process.env.OPENROUTER_API_KEY = 'platform-key'
    const made = makeServer()
    await proxyRoutes(made.server as never, {} as never)
    handler = made.handlers.get('/openrouter-proxy/chat/completions')!
    vi.mocked(ensurePointsBalance).mockReset()
    vi.mocked(chargePointsForCall).mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('余额不足 → 402,且不打上游', async () => {
    vi.mocked(ensurePointsBalance).mockImplementation(async (_req, reply) => {
      ;(reply as ReturnType<typeof makeReply>).status(402)
      return false
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const reply = makeReply()
    await handler({ userId: 'u-1', id: 'req-1', body: PAYLOAD }, reply)
    expect(reply.code).toBe(402)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('成功路径按 usage 结算并记录用量', async () => {
    vi.mocked(ensurePointsBalance).mockResolvedValue(true)
    const data = { id: 'c1', usage: { prompt_tokens: 1000, completion_tokens: 500 } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })),
    )
    const reply = makeReply()
    await handler({ userId: 'u-1', id: 'req-1', body: PAYLOAD }, reply)
    expect(reply.code).toBe(200)
    expect(vi.mocked(chargePointsForCall)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1' }),
      'openai/gpt-4o',
      data,
      'req-1',
    )
  })

  it('上游 5xx 不回吐响应体', async () => {
    vi.mocked(ensurePointsBalance).mockResolvedValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'sk-secret-leak' } }), { status: 500 }),
      ),
    )
    const reply = makeReply()
    await handler({ userId: 'u-1', id: 'req-1', body: PAYLOAD }, reply)
    expect(reply.code).toBe(502)
    expect(JSON.stringify(reply.body)).not.toContain('sk-secret-leak')
    expect(vi.mocked(chargePointsForCall)).not.toHaveBeenCalled()
  })

  it('上游超时(AbortError)→ 502 请求超时', async () => {
    vi.mocked(ensurePointsBalance).mockResolvedValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        throw e
      }),
    )
    const reply = makeReply()
    await handler({ userId: 'u-1', id: 'req-1', body: PAYLOAD }, reply)
    expect(reply.code).toBe(502)
    expect(JSON.stringify(reply.body)).toContain('请求超时')
  })
})
