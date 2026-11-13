// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-514 回归锁(2026-11-13)。
 *
 * 病灶:/api/langchain/chat|agent 用平台 DashScope 密钥调用,却只写进程内 usageStore ——
 *      既不校验积分余额,也不按 usage 扣分 ⇒ 登录用户可无限白嫖平台额度。
 * 判据:
 *   - 调用前过 ensurePointsBalance(钱包闸),零余额不发上游;
 *   - 成功后 recordUsage + chargePointsForCall,与 proxy-llm 同一扣分口径;
 *   - agent 的 usage 形如 {models:[{input_tokens,output_tokens}]},须归一后仍能计费;
 *   - 上游失败按既有语义:502 回包、不计费不记用量;
 *   - 响应与日志不含平台密钥;成功返回结构不变。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(async () => true),
  recordUsage: vi.fn(),
  ensurePointsBalance: vi.fn(async () => true),
  chargePointsForCall: vi.fn(async () => undefined),
}))

// 鉴权与 usage 打点用替身,callVendor 保持真实实现(检验平台密钥不进响应/日志)
vi.mock('../src/routes/ai-vendors/_shared.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, requireAuth: mocks.requireAuth, recordUsage: mocks.recordUsage }
})

vi.mock('../src/routes/ai-vendors/proxy-llm.js', () => ({
  ensurePointsBalance: mocks.ensurePointsBalance,
  chargePointsForCall: mocks.chargePointsForCall,
}))

import { legacyLangchainRoutes } from '../src/routes/legacy-langchain.js'

type Handler = (request: unknown, reply: unknown) => unknown
type ReplyMock = {
  statusCode: number
  body: unknown
  status(c: number): ReplyMock
  send(b: unknown): ReplyMock
}

function makeReply(): ReplyMock {
  return {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

const handlers = new Map<string, Handler>()
const fakeServer = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
}
await legacyLangchainRoutes(fakeServer as never, {} as never)

const PLATFORM_KEY = 'sk-dashscope-platform-key-f514'
const REQUEST = { userId: 'u-f514', id: 'req-f514' }

function stubUpstream(status: number, payload: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  process.env.DASHSCOPE_API_KEY = PLATFORM_KEY
  mocks.requireAuth.mockReset().mockResolvedValue(true)
  mocks.recordUsage.mockReset()
  mocks.ensurePointsBalance.mockReset().mockResolvedValue(true)
  mocks.chargePointsForCall.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('F-514 langchain agent 必须过余额闸并计费', () => {
  it('agent 成功后按 usage 计费一次(含 userId/model/usage),返回结构不变', async () => {
    const upstream = {
      output: { text: '你好', finish_reason: 'stop' },
      usage: { models: [{ model_id: 'qwen-max', input_tokens: 1200, output_tokens: 300 }] },
    }
    const fetchMock = stubUpstream(200, upstream)
    const reply = makeReply()

    await handlers.get('POST /agent')!(
      { ...REQUEST, body: { input: '你好', agent: 'agent-app', model: 'qwen-max' } },
      reply,
    )

    expect(reply.statusCode).toBe(200)
    // 前置余额闸,且确实在打上游之前
    expect(mocks.ensurePointsBalance).toHaveBeenCalledTimes(1)
    expect(mocks.ensurePointsBalance.mock.calls[0]?.[2]).toBe('qwen-max')
    expect(mocks.ensurePointsBalance.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]!,
    )
    expect(mocks.recordUsage).toHaveBeenCalledWith('u-f514', 'dashscope')
    // 计费一次,usage 已从 models[] 归一为 OpenAI 形状
    expect(mocks.chargePointsForCall).toHaveBeenCalledTimes(1)
    const call = mocks.chargePointsForCall.mock.calls[0]!
    expect(call[0]).toMatchObject({ userId: 'u-f514' })
    expect(call[1]).toBe('qwen-max')
    expect((call[2] as { usage?: unknown }).usage).toEqual({
      prompt_tokens: 1200,
      completion_tokens: 300,
    })
    expect(call[3]).toBe('req-f514')
    // 防误伤:正常返回结构保持不变
    expect(reply.body).toEqual({
      code: 0,
      message: 'success',
      data: { output: '你好', intermediate_steps: [], agent: 'agent-app' },
    })
  })

  it('chat 默认 qwen-plus 同样过闸并计费', async () => {
    const upstream = {
      choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop', index: 0 }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }
    const fetchMock = stubUpstream(200, upstream)
    const reply = makeReply()

    await handlers.get('POST /chat')!(
      { ...REQUEST, body: { messages: [{ role: 'user', content: 'hi' }] } },
      reply,
    )

    expect(reply.statusCode).toBe(200)
    expect(mocks.ensurePointsBalance.mock.calls[0]?.[2]).toBe('qwen-plus')
    expect(mocks.ensurePointsBalance.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]!,
    )
    expect(mocks.chargePointsForCall).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-f514' }),
      'qwen-plus',
      upstream,
      'req-f514',
    )
    expect(reply.body).toEqual({ code: 0, message: 'success', data: { choices: upstream.choices } })
  })

  it('零积分 → 402 且不打上游、不计费', async () => {
    mocks.ensurePointsBalance.mockImplementation(async (_req, reply) => {
      ;(reply as ReplyMock).status(402).send({ code: 402, message: '积分不足' })
      return false
    })
    const fetchMock = stubUpstream(200, { output: { text: '不该被调用' } })
    const reply = makeReply()

    await handlers.get('POST /agent')!({ ...REQUEST, body: { input: '你好' } }, reply)

    expect(reply.statusCode).toBe(402)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.chargePointsForCall).not.toHaveBeenCalled()
  })

  it('上游失败 → 502,按既有语义不计费不记用量', async () => {
    stubUpstream(500, { error: { message: 'upstream down' } })
    const reply = makeReply()

    await handlers.get('POST /agent')!({ ...REQUEST, body: { input: '你好' } }, reply)

    expect(reply.statusCode).toBe(502)
    expect(mocks.recordUsage).not.toHaveBeenCalled()
    expect(mocks.chargePointsForCall).not.toHaveBeenCalled()
  })

  it('响应与日志不含平台密钥', async () => {
    const consoleSpies = (['log', 'info', 'warn', 'error'] as const).map((k) =>
      vi.spyOn(console, k),
    )

    stubUpstream(200, { output: { text: 'ok' }, usage: { models: [{ input_tokens: 1 }] } })
    const okReply = makeReply()
    await handlers.get('POST /agent')!({ ...REQUEST, body: { input: '你好' } }, okReply)
    expect(JSON.stringify(okReply.body)).not.toContain(PLATFORM_KEY)

    stubUpstream(500, { error: { message: 'boom' } })
    const failReply = makeReply()
    await handlers.get('POST /agent')!({ ...REQUEST, body: { input: '你好' } }, failReply)
    expect(JSON.stringify(failReply.body)).not.toContain(PLATFORM_KEY)

    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(PLATFORM_KEY)
    }
  })
})
