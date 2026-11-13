// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-295 回归锁(2026-11-13)。
 *
 * 病灶:POST /v1/messages 流式分支里,ai-service 的 `event: done` 帧把上游结束原因放在
 * `finishReason`;旧解析器没有这一支 ⇒ done 帧被丢弃 ⇒ 路由无条件补 `finish_reason:'stop'`
 * ⇒ 适配器映射成 `end_turn`。于是 `length`(输出达 max_tokens 被截断)与
 * `content_filter`(内容过滤拒答)都以"正常说完"上报,客户端不会续写/重试。
 *
 * 本文件锁:
 *   ① done.finishReason=length → message_delta.stop_reason=max_tokens;
 *   ② done.finishReason=content_filter → refusal;
 *   ③ done.finishReason=stop → end_turn;
 *   ④ done 帧缺 finishReason → 仍按既有兜底收尾(end_turn),但必须留痕(warn 日志),
 *      不得静默。
 *
 * 桩形态取自 tests/v1-messages-finish-reason.test.ts(mock db / 鉴权 / 计费,不连 8810/8811)。
 */
import { Writable } from 'node:stream'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

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

/** ai-service `/api/llm/complete/stream` 的 SSE 行序列替身 */
function stubUpstreamSse(lines: string[]): void {
  const encoder = new TextEncoder()
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`${lines.join('\n')}\n`))
        controller.close()
      },
    }),
    text: async () => '',
  })) as unknown as typeof globalThis.fetch
}

/** 发起一次流式调用,同时收集 warn 日志(用于断言兜底"留痕") */
async function callStream(lines: string[]): Promise<{ body: string; logs: string[] }> {
  stubUpstreamSse(lines)
  const logs: string[] = []
  const sink = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      logs.push(chunk.toString())
      cb()
    },
  })
  const server = Fastify({ logger: { level: 'warn', stream: sink } })
  await server.register(v1MessagesRoutes, { prefix: '/v1/anthropic' })
  await server.ready()
  const res = await server.inject({
    method: 'POST',
    url: '/v1/anthropic/messages',
    headers: { 'x-api-key': 'ihui_test_key' },
    payload: {
      model: 'claude-3-5-sonnet',
      max_tokens: 16,
      messages: [{ role: 'user', content: '说一句长话' }],
      stream: true,
    },
  })
  await server.close()
  return { body: res.body, logs }
}

/** 文本帧 + done 帧(ai-service `_sse` 真实形状:`event: X` 与 `data: {...}` 各一行) */
function framesWithDone(finishReason?: string): string[] {
  const done: Record<string, unknown> = {
    type: 'done',
    model: 'claude-3-5-sonnet',
    usage: { prompt_tokens: 5, completion_tokens: 3 },
    stub: false,
  }
  if (finishReason !== undefined) done.finishReason = finishReason
  return [
    'event: chunk',
    'data: {"type":"chunk","content":"前半句"}',
    'event: done',
    `data: ${JSON.stringify(done)}`,
  ]
}

describe('F-295 /v1/messages 流式:done.finishReason 透传', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('done.finishReason=length ⇒ stop_reason=max_tokens(截断不得洗成 end_turn)', async () => {
    const { body } = await callStream(framesWithDone('length'))
    expect(body).toContain('"text":"前半句"')
    expect(body).toContain('"stop_reason":"max_tokens"')
    expect(body).not.toContain('"stop_reason":"end_turn"')
    // 收尾只能有一套:既不能再被路由兜底补一条,也不能漏发
    expect(body.split('event: message_delta').length - 1).toBe(1)
    expect(body).toContain('event: message_stop')
  })

  it('done.finishReason=content_filter ⇒ stop_reason=refusal(拒答不得报成正常结束)', async () => {
    const { body } = await callStream(framesWithDone('content_filter'))
    expect(body).toContain('"stop_reason":"refusal"')
    expect(body).not.toContain('"stop_reason":"end_turn"')
    expect(body.split('event: message_delta').length - 1).toBe(1)
  })

  it('done.finishReason=stop ⇒ stop_reason=end_turn', async () => {
    const { body } = await callStream(framesWithDone('stop'))
    expect(body).toContain('"stop_reason":"end_turn"')
    expect(body.split('event: message_delta').length - 1).toBe(1)
  })

  it('done 帧缺 finishReason ⇒ 既有兜底 end_turn,且必须留痕(warn)', async () => {
    const { body, logs } = await callStream(framesWithDone())
    expect(body).toContain('"stop_reason":"end_turn"')
    expect(body.split('event: message_delta').length - 1).toBe(1)
    // 兜底是"可观测"的:路由必须 warn,不允许静默补 stop
    expect(logs.join('\n')).toContain('未提供 finishReason')
  })
})
