// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-726 回归锁(2026-11-13)。
 *
 * 病灶:`/v1/messages` 与 `/v1/responses` 的流式计费完全脱离上游 usage ——
 *   ① 上游行解析器把 usage 丢弃,计费只按 `text_delta` 字符数 /4 估算;
 *   ② tool_use 入参、thinking(reasoning_content)输出既不累计 token 也不下发内容;
 *   ③ prompt cache 的 cache_read/cache_creation token 恒为 0,折扣/加价全失效。
 *
 * 本文件锁:
 *   ① 有上游 usage ⇒ 计费与流式用量事件都用真值(含 cache token);
 *   ② 上游 usage 缺失 ⇒ 仍按字符估算兜底(不回归成 0);
 *   ③ tool_use / thinking 内容不被丢弃,且计入输出 token;
 *   ④ Responses 的 response.completed 带与计费同源的 usage。
 *
 * 只 mock 上游流(SSE 分片)/ 鉴权 / 计费,不连真实 ai-service、PG、Redis。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// mock db:本文件一条 SQL 都不该发出去
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
  permissions: ['chat:write', 'responses:write', '*'],
  rateLimit: 100,
}
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

/** recordCall 入参 = 计费唯一观察窗 */
const { recordCalls } = vi.hoisted(() => ({
  recordCalls: [] as Array<Record<string, unknown>>,
}))
vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn().mockResolvedValue({ allowed: true, reason: null }),
  recordCall: vi.fn(async (input: Record<string, unknown>) => {
    recordCalls.push(input)
    return { logId: 'x', costCents: 1, newTokenBalance: 1, newCostBalanceCents: 1 }
  }),
  isByokCall: vi.fn().mockResolvedValue(false),
  modelToProviderCode: vi.fn().mockReturnValue('anthropic'),
}))

import v1MessagesRoutes from '../src/routes/v1-messages'
import v1ResponsesRoutes from '../src/routes/v1-responses'

const originalFetch = globalThis.fetch

async function boot(prefix: string, plugin: FastifyPluginAsync): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  server.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const statusCode = err.statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await server.register(plugin, { prefix })
  await server.ready()
  return server
}

/** 上游流式 `/api/llm/complete/stream` 替身:按给定 SSE 行整块返回 */
function stubUpstreamStream(lines: string[]): void {
  const encoder = new TextEncoder()
  const sse = `${lines.join('\n')}\n`
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse))
        controller.close()
      },
    }),
    text: async () => '',
  })) as unknown as typeof globalThis.fetch
}

/** 等 finally 里的 fire-and-forget recordCall 落地 */
async function waitForRecordCalls(count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(recordCalls.length).toBeGreaterThanOrEqual(count)
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  recordCalls.length = 0
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// =============================================================================
// ① /v1/messages:上游 usage 与 cache token 必须用于计费
// =============================================================================

describe('F-726 /v1/messages 流式采用上游 usage', () => {
  it('usage(prompt/completion/cache)优先于字符估算', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1200,"completion_tokens":900,"total_tokens":2100,"prompt_tokens_details":{"cached_tokens":800},"cache_creation_input_tokens":50}}',
    ])

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
    await waitForRecordCalls(1)
    await server.close()

    expect(res.statusCode).toBe(200)
    // 流式 message_delta 用真值 900,而不是 ceil("你好".length/4)=1
    expect(res.body).toContain('"output_tokens":900')

    const billing = recordCalls[0]!
    expect(billing.promptTokens).toBe(1200)
    expect(billing.completionTokens).toBe(900)
    expect(billing.totalTokens).toBe(2100)
    expect(billing.cacheReadTokens).toBe(800)
    expect(billing.cacheCreationTokens).toBe(50)
  })
})

// =============================================================================
// ② /v1/messages:缺失 usage 仍按字符估算兜底
// =============================================================================

describe('F-726 /v1/messages 缺失 usage 走估算', () => {
  it('无 usage 帧时 prompt/completion 仍按 /4 估算(非 0)', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"content":"abcdefgh"},"finish_reason":"stop"}]}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        // promptText = "user: hi" ⇒ 8 字符 ⇒ 2 token
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      },
    })
    await waitForRecordCalls(1)
    await server.close()

    expect(res.body).toContain('"output_tokens":2')
    const billing = recordCalls[0]!
    expect(billing.promptTokens).toBe(2)
    expect(billing.completionTokens).toBe(2)
    expect(billing.totalTokens).toBe(4)
    expect(billing.cacheReadTokens).toBe(0)
    expect(billing.cacheCreationTokens).toBe(0)
  })
})

// =============================================================================
// ③ /v1/messages:tool_use / thinking 内容不丢弃且计入输出
// =============================================================================

describe('F-726 /v1/messages 工具与思维链输出', () => {
  it('reasoning_content ⇒ thinking block;tool args 计入输出 token', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"先想一想"},"finish_reason":null}]}',
      'data: {"type":"tool-call-start","toolCallId":"call_1","toolName":"get_weather","args":{"city":"Paris"}}',
      'data: {"type":"done","finishReason":"tool_calls"}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '巴黎天气' }],
        stream: true,
      },
    })
    await waitForRecordCalls(1)
    await server.close()

    // thinking 内容完整下发
    expect(res.body).toContain('"type":"thinking"')
    expect(res.body).toContain('thinking_delta')
    expect(res.body).toContain('先想一想')
    // tool_use 内容完整下发
    expect(res.body).toContain('"type":"tool_use"')
    expect(res.body).toContain('input_json_delta')
    expect(res.body).toContain('{\\"city\\":\\"Paris\\"}')

    // 无 usage 时:reasoning 4 字符 + args 16 字符 = 20 字符 ⇒ 5 token
    const billing = recordCalls[0]!
    expect(billing.completionTokens).toBe(5)
  })
})

// =============================================================================
// ④ /v1/responses:usage / cache / reasoning 全部落地
// =============================================================================

describe('F-726 /v1/responses 流式采用上游 usage', () => {
  it('completed 事件与计费同源,reasoning 不丢弃', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"思考中"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{"content":"答案"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1500,"completion_tokens":700,"total_tokens":2200,"prompt_tokens_details":{"cached_tokens":1000}}}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-5', input: '你好', stream: true },
    })
    await waitForRecordCalls(1)
    await server.close()

    // 思维链内容以 reasoning 增量 + reasoning 输出项留存
    expect(res.body).toContain('event: response.reasoning_summary_text.delta')
    expect(res.body).toContain('思考中')
    expect(res.body).toContain('"type":"reasoning"')
    // completed 事件 usage 与计费同源
    expect(res.body).toContain('"input_tokens":1500')
    expect(res.body).toContain('"output_tokens":700')
    expect(res.body).toContain('"cached_tokens":1000')

    const billing = recordCalls[0]!
    expect(billing.promptTokens).toBe(1500)
    expect(billing.completionTokens).toBe(700)
    expect(billing.totalTokens).toBe(2200)
    expect(billing.cacheReadTokens).toBe(1000)
  })
})

// =============================================================================
// ⑤ /v1/responses:缺失 usage 仍按字符估算兜底
// =============================================================================

describe('F-726 /v1/responses 缺失 usage 走估算', () => {
  it('无 usage 帧时 usage/计费按字符估算', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"content":"abcdefgh"},"finish_reason":"stop"}]}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-5', input: 'hi', stream: true },
    })
    await waitForRecordCalls(1)
    await server.close()

    const billing = recordCalls[0]!
    // promptText = "user: hi" ⇒ 8 字符 ⇒ 2 token;completion "abcdefgh" ⇒ 2 token
    expect(billing.promptTokens).toBe(2)
    expect(billing.completionTokens).toBe(2)
    expect(billing.totalTokens).toBe(4)
    expect(res.body).toContain('"output_tokens":2')
  })
})
