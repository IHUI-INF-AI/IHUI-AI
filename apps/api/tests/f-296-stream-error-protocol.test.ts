// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-296 回归锁(2026-11-13)。
 *
 * 病灶:响应头已 writeHead(200) 后上游失败,`/v1/messages` 把
 * `[error] upstream 500: <body 前 200 字>` 塞进 `delta.content`,
 * `/v1/responses` 塞进 `response.output_text.delta` —— SDK 会把错误当回答落库,
 * 且上游错误体(request-id、内部地址)被回显给终端用户。
 *
 * 本文件锁三件事:
 *   ① `/v1/messages` 上游 500 ⇒ 只有 Anthropic 协议级 `event: error`,无
 *      content_block_delta / message_stop 伪正常收尾,且不含上游 body / request-id;
 *   ② `/v1/responses` 上游 500 ⇒ 只有 `response.failed`(status:"failed" + error.code/message),
 *      无 output_text.delta 错误文本,同样不泄露上游 body;
 *   ③ 上游 200 正常流仍原样透传(防误伤)。
 *
 * 桩形态取自 `tests/v1-messages.test.ts`(mock db / 鉴权 / 计费,不连 8810/8811)。
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
  authenticateApiKey: vi.fn(async () => {}),
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
import v1ResponsesRoutes from '../src/routes/v1-responses'

/** 上游错误体里的可识别标记:一旦出现在响应里即为泄露 */
const LEAK_REQUEST_ID = 'req_f296_leak_probe'
const LEAK_INTERNAL_HOST = '10.7.0.9:8802'
const LEAK_UPSTREAM_TEXT = 'internal upstream exploded'
const UPSTREAM_ERROR_BODY = JSON.stringify({
  error: LEAK_UPSTREAM_TEXT,
  request_id: LEAK_REQUEST_ID,
  upstream_host: LEAK_INTERNAL_HOST,
})

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

/** 上游流式入口 500 */
function stubUpstreamFailure(status = 500): void {
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    status,
    body: null,
    text: async () => UPSTREAM_ERROR_BODY,
  })) as unknown as typeof globalThis.fetch
}

/** 上游流式入口 200 + 指定 SSE 行 */
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

function expectNoUpstreamLeak(body: string): void {
  expect(body).not.toContain(LEAK_REQUEST_ID)
  expect(body).not.toContain(LEAK_INTERNAL_HOST)
  expect(body).not.toContain(LEAK_UPSTREAM_TEXT)
  expect(body).not.toContain('[error]')
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// =============================================================================
// ① /v1/messages:上游 500 只发协议级 error
// =============================================================================

describe('F-296 /v1/messages 上游失败', () => {
  it('上游 500 ⇒ event: error(api_error),无正常内容通道与伪正常收尾,不泄露上游 body', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamFailure(500)

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

    // 状态码语义不变:响应头早已 200,协议层用 error 事件表达失败
    expect(res.statusCode).toBe(200)
    const body = res.body
    // Anthropic 协议级错误帧
    expect(body).toContain('event: error')
    expect(body).toContain('"type":"error"')
    expect(body).toContain('"type":"api_error"')
    // 固定文案,不含上游原文
    expect(body).toContain('Upstream service temporarily unavailable')
    expect(body).not.toContain('upstream 500')
    expectNoUpstreamLeak(body)
    // 错误不得走正常内容通道,也不得伪造 message_delta / message_stop 正常结尾
    expect(body).not.toContain('content_block_delta')
    expect(body).not.toContain('message_delta')
    expect(body).not.toContain('message_stop')
  })
})

// =============================================================================
// ② /v1/responses:上游 500 只发 response.failed
// =============================================================================

describe('F-296 /v1/responses 上游失败', () => {
  it('上游 500 ⇒ response.failed(status:"failed" + error.code/message),无 output_text.delta 错误文本', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamFailure(500)

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-5', input: '你好', stream: true },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain('event: response.failed')
    expect(body).toContain('"status":"failed"')
    expect(body).toContain('"error":{"code":"upstream_error"')
    expect(body).toContain('Upstream service temporarily unavailable')
    expectNoUpstreamLeak(body)
    // 错误不得写进正常内容通道,也不得用 response.completed 冒充收尾
    expect(body).not.toContain('response.output_text.delta')
    expect(body).not.toContain('event: response.completed')
  })
})

// =============================================================================
// ③ 上游 200 正常流:原样透传(防误伤)
// =============================================================================

describe('F-296 正常流未被误伤', () => {
  it('/v1/messages 上游 200 ⇒ 正常 content_block_delta + message_stop', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamStream([
      'data: {"choices":[{"index":0,"delta":{"content":"你好"},"finish_reason":null}]}',
      'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
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
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain('event: content_block_delta')
    expect(body).toContain('你好')
    expect(body).toContain('"stop_reason":"end_turn"')
    expect(body).toContain('event: message_stop')
    expect(body).not.toContain('event: error')
  })

  it('/v1/responses 上游 200 ⇒ 正常 output_text.delta + response.completed', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamStream(['data: {"content":"你好"}', 'data: [DONE]'])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-5', input: '你好', stream: true },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain('event: response.output_text.delta')
    expect(body).toContain('你好')
    expect(body).toContain('event: response.completed')
    expect(body).toContain('"status":"completed"')
    expect(body).not.toContain('response.failed')
  })
})
