// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /v1/anthropic/messages 的 `finish_reason` **值域诚实性**测试。
 *
 * 立因(2026-09-28 现读复核,本票的"关键事实②"):
 *   `apps/api/src/routes/v1-messages.ts` 的非流式分支把上游响应摊成 OpenAI 形状时,
 *   **无条件**写 `finish_reason: 'stop'`(原 :577)—— 它从不读上游给的结束原因。
 *   于是上游真给了 `length`(输出达 max_tokens 被截断)时,本路由会把它**洗成 `stop`**,
 *   经 `openAIResponseToAnthropic` 的 FINISH_REASON_MAP 变成对外 `stop_reason: 'end_turn'`
 *   = "我正常说完了"。Anthropic SDK 用户据此不会续写、不会重试,截断信号在此被抹掉。
 *   同文件 :255 那句注释"若上游未发 finish_reason,补一个 stop 收尾(防止客户端挂起)"
 *   才是正当语义:**只有真没发时才补**。本票把它从"无条件写"改成"没发才补"。
 *
 * 参照写法:`apps/api/src/routes/v1-gemini.ts:152` 就在读 `choices[0].finish_reason`。
 *
 * 刻意不动的东西:响应键名、状态码、流式分支的补尾兜底(:256/:284,那是上游确实没发时
 * 防客户端挂起的正当路径)—— 既有键集由 `v1-latency-persistence.test.ts` 当契约钉着。
 *
 * 桩形态取自 `tests/v1-messages.test.ts`(mock db / 鉴权 / 计费,**不连 8810/8811**,
 * 遵 AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// mock db:本文件一条 SQL 都不该发出去(测试隔离铁律)
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

// mock 参数覆盖系统:透传原 body,不查库
vi.mock('../src/services/relay-param-ops-config.js', () => ({
  applyParamOpsToBody: vi.fn(async (body: Record<string, unknown>) => ({
    body,
    appliedRules: [],
    modified: false,
  })),
}))

const MOCK_API_KEY = {
  id: 'ak_test_001',
  userId: 'user_test_001',
  key: 'ihui_test_key',
  permissions: ['chat:write', '*'],
  rateLimit: 100,
}
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn().mockResolvedValue({ allowed: true, reason: null }),
  recordCall: vi
    .fn()
    .mockResolvedValue({ logId: 'x', costCents: 1, newTokenBalance: 1, newCostBalanceCents: 1 }),
  isByokCall: vi.fn().mockResolvedValue(false),
  modelToProviderCode: vi.fn().mockReturnValue('openai'),
}))

import v1MessagesRoutes from '../src/routes/v1-messages'

const originalFetch = globalThis.fetch

/** 上游 ai-service `/api/llm/complete` 非流式响应替身 */
function stubUpstreamJson(payload: Record<string, unknown>): void {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  })) as unknown as typeof globalThis.fetch
}

async function callNonStream(
  extra: Record<string, unknown> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = Fastify({ logger: false })
  server.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const statusCode = err.statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await server.register(v1MessagesRoutes, { prefix: '/v1/anthropic' })
  await server.ready()
  const res = await server.inject({
    method: 'POST',
    url: '/v1/anthropic/messages',
    headers: { 'x-api-key': 'ihui_test_key' },
    payload: {
      model: 'claude-3-5-sonnet',
      max_tokens: 1024,
      messages: [{ role: 'user', content: '说一句长话' }],
      ...extra,
    },
  })
  await server.close()
  return { status: res.statusCode, body: res.json() as Record<string, unknown> }
}

describe('v1-messages 非流式:finish_reason 值域诚实性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  /** ① 上游真发了 length ⇒ 必须如实带出去,不得洗成 stop/end_turn */
  it('上游发 finish_reason=length ⇒ 对外 stop_reason=max_tokens(不被洗白)', async () => {
    stubUpstreamJson({
      content: '说了一半就被截断',
      model: 'claude-3-5-sonnet',
      usage: { prompt_tokens: 5, completion_tokens: 1024, total_tokens: 1029 },
      finish_reason: 'length',
    })

    const { status, body } = await callNonStream()
    expect(status).toBe(200)
    // 键名一字未动:仍是 Anthropic Messages 形状
    expect(body.type).toBe('message')
    expect(body.content).toEqual([{ type: 'text', text: '说了一半就被截断' }])
    // 值域如实:截断就是截断
    expect(body.stop_reason).toBe('max_tokens')
  })

  /** 同一件事也可能以 OpenAI 形状上来(choices[0]),两形都不得洗白 */
  it('上游以 choices[0].finish_reason=length 上来 ⇒ 同样如实', async () => {
    stubUpstreamJson({
      content: '说了一半就被截断',
      model: 'claude-3-5-sonnet',
      choices: [
        { index: 0, message: { role: 'assistant', content: 'x' }, finish_reason: 'length' },
      ],
    })

    const { body } = await callNonStream()
    expect(body.stop_reason).toBe('max_tokens')
  })

  /** ② 上游什么都没发 ⇒ 仍补 stop(保住"防客户端挂起"那条正当意图) */
  it('上游没发 finish_reason ⇒ 仍补 stop(end_turn),行为与改动前逐字相同', async () => {
    stubUpstreamJson({
      content: '你好,世界',
      model: 'claude-3-5-sonnet',
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    })

    const { status, body } = await callNonStream()
    expect(status).toBe(200)
    expect(body.stop_reason).toBe('end_turn')
    expect(body.usage).toEqual({ input_tokens: 5, output_tokens: 8 })
  })

  /** 对照:上游发 stop 时照原样,不得被兜底逻辑改判 */
  it('上游发 finish_reason=stop ⇒ 对外 end_turn', async () => {
    stubUpstreamJson({ content: '说完了', finish_reason: 'stop' })
    const { body } = await callNonStream()
    expect(body.stop_reason).toBe('end_turn')
  })

  /** 兜底只在"真没发"这一格生效:空串不是结束原因 */
  it('上游给空串 finish_reason ⇒ 视为没发,补 stop(不得把空值当结论外传)', async () => {
    stubUpstreamJson({ content: '说完了', finish_reason: '' })
    const { body } = await callNonStream()
    expect(body.stop_reason).toBe('end_turn')
  })
})

/**
 * 流式分支的对账 —— 现读复核的结论是**它今天不洗白**,所以这一组是回归锁:
 * `parseUpstreamLineToOpenAIChunk` 对已经是 OpenAI 形状的行整块透传 `choices`
 * (`anthropic-adapter.ts` 的"已经是 OpenAI chunk 格式"那支),而收尾兜底的条件是
 * `messageStarted && contentBlockStarted` —— 上游发过 finish_reason 时
 * `contentBlockStarted` 已被适配器置回 false,于是兜底不触发。
 * 把这两条钉住,是为了让"以后有人把兜底改成无条件"立刻撞红,而不是靠注释。
 */
describe('v1-messages 流式:finish_reason 值域诚实性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  /** 上游发 length 时,对外必须是 max_tokens,且**不得**再被兜底补一条 end_turn */
  it('流式上游发 finish_reason=length ⇒ message_delta 是 max_tokens 且只此一条', async () => {
    const encoder = new TextEncoder()
    const sse = [
      'data: {"choices":[{"index":0,"delta":{"content":"前半句"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"length"}]}',
      'data: [DONE]',
    ].join('\n')
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`${sse}\n`))
          controller.close()
        },
      }),
      text: async () => '',
    })) as unknown as typeof globalThis.fetch

    const server = Fastify({ logger: false })
    await server.register(v1MessagesRoutes, { prefix: '/v1/anthropic' })
    await server.ready()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '说一句长话' }],
        stream: true,
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('"stop_reason":"max_tokens"')
    expect(res.body).not.toContain('"stop_reason":"end_turn"')
    // 收尾事件只能有一套:兜底若被改成无条件,这里会数出两条 message_delta
    expect(res.body.split('event: message_delta').length - 1).toBe(1)
  })

  /** 上游整条流都没发 finish_reason ⇒ 兜底补 end_turn(防客户端挂起,意图必须保住) */
  it('流式上游没发 finish_reason ⇒ 兜底补一条 end_turn', async () => {
    const encoder = new TextEncoder()
    const sse = ['data: {"content":"你好"}', 'data: [DONE]'].join('\n')
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`${sse}\n`))
          controller.close()
        },
      }),
      text: async () => '',
    })) as unknown as typeof globalThis.fetch

    const server = Fastify({ logger: false })
    await server.register(v1MessagesRoutes, { prefix: '/v1/anthropic' })
    await server.ready()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '你好' }],
        stream: true,
      },
    })
    await server.close()

    expect(res.body).toContain('"stop_reason":"end_turn"')
    expect(res.body).toContain('event: message_stop')
    expect(res.body.split('event: message_delta').length - 1).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
