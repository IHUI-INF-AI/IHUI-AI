// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-293 回归锁(2026-11-13)。
 *
 * 病灶:`/v1/messages` 与 `/v1/responses` 的工具调用全链路丢失 ——
 *   ① 非流式:上游 `tool_calls` 被丢掉,只剩 `{role:'assistant', content}`,
 *      而 finish_reason=tool_calls 仍被映射成 stop_reason=tool_use ⇒ 协议非法的空工具回复;
 *   ② 流式:ai-service 的 `tool-call-start` / `tool-call-args-delta` 帧解析器一个都不认;
 *   ③ Responses:`tools` 原样塞进 Chat Completions 形状,`function_call` 历史项落成空 user 消息。
 *
 * 本文件锁:
 *   ① Anthropic 非流式 ⇒ content 里有 tool_use block(id/name/input),stop_reason=tool_use;
 *   ② Anthropic 流式 ⇒ tool 帧被映射成 content_block_start(tool_use) + input_json_delta;
 *   ③ Responses 非流式 ⇒ tools 转 Chat 形状,输出独立 function_call 项(call_id/name/arguments);
 *   ④ Responses 流式 ⇒ tool 帧转 response.output_item.added + function_call_arguments.done;
 *   ⑤ Responses 内置工具(web_search 等)无法转换 ⇒ 显式 400,不静默丢弃;
 *   ⑥ Responses 工具的 function_call / function_call_output 历史项 ⇒ 正确的 assistant/tool 消息。
 *
 * 桩形态取自 `tests/v1-messages-finish-reason.test.ts`(mock db / 鉴权 / 计费,
 * 不连 8810/8811,遵 AGENTS §5 测试隔离铁律)。
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

const originalFetch = globalThis.fetch

/** Anthropic 侧工具调用的上游摊平形状(ai-service /api/llm/complete) */
const UPSTREAM_TOOL_CALLS = [
  {
    id: 'call_1',
    type: 'function',
    function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
  },
]

/** 上游流式工具帧(与 apps/ai-service/app/routers/llm.py 的 tool-call-* 契约一致) */
const STREAM_TOOL_FRAMES = [
  'event: tool-call-args-delta',
  'data: {"type":"tool-call-args-delta","index":0,"id":"call_1","name":"get_weather","args":{"city":"Paris"},"argsComplete":true,"argsPartial":false}',
  'event: tool-call-start',
  'data: {"type":"tool-call-start","toolCallId":"call_1","toolName":"get_weather","args":{"city":"Paris"}}',
]

/** 记录最近一次出站 body,用于断言响应/请求两侧的形状转换 */
let lastUpstreamBody: Record<string, unknown> | null = null

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

/** 上游非流式 `/api/llm/complete` 替身 */
function stubUpstreamJson(payload: Record<string, unknown>): void {
  lastUpstreamBody = null
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    if (typeof init?.body === 'string') {
      lastUpstreamBody = JSON.parse(init.body) as Record<string, unknown>
    }
    return { ok: true, status: 200, json: async () => payload }
  }) as unknown as typeof globalThis.fetch
}

/** 上游流式 `/api/llm/complete/stream` 替身 */
function stubUpstreamStream(lines: string[]): void {
  const encoder = new TextEncoder()
  const sse = `${lines.join('\n')}\n`
  globalThis.fetch = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    if (typeof init?.body === 'string') {
      lastUpstreamBody = JSON.parse(init.body) as Record<string, unknown>
    }
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sse))
          controller.close()
        },
      }),
      text: async () => '',
    }
  }) as unknown as typeof globalThis.fetch
}

beforeEach(() => {
  vi.clearAllMocks()
  lastUpstreamBody = null
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// =============================================================================
// ① /v1/messages 非流式:tool_calls → tool_use block
// =============================================================================

describe('F-293 /v1/messages 非流式工具调用', () => {
  it('上游 tool_calls ⇒ content 含 tool_use(id/name/input),stop_reason=tool_use', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamJson({
      content: '',
      model: 'claude-3-5-sonnet',
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
      finish_reason: 'tool_calls',
      tool_calls: UPSTREAM_TOOL_CALLS,
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '巴黎天气怎么样' }],
        tools: [
          {
            name: 'get_weather',
            description: '查询天气',
            input_schema: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ],
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      stop_reason: string
      content: Array<Record<string, unknown>>
    }
    expect(body.stop_reason).toBe('tool_use')
    const toolBlock = body.content.find((b) => b.type === 'tool_use')
    expect(toolBlock, 'tool_calls 不得被丢弃').toBeDefined()
    expect(toolBlock).toMatchObject({
      type: 'tool_use',
      id: 'call_1',
      name: 'get_weather',
      input: { city: 'Paris' },
    })
    // 工具调用必须到达上游(否则上游只会回答"我没有工具")
    expect((lastUpstreamBody?.tools as unknown[])?.length).toBe(1)
  })
})

// =============================================================================
// ② /v1/messages 流式:tool-call-* 帧 → tool_use content block
// =============================================================================

describe('F-293 /v1/messages 流式工具帧', () => {
  it('tool-call-start 帧 ⇒ content_block_start(tool_use) + input_json_delta + stop_reason=tool_use', async () => {
    const server = await boot('/v1/anthropic', v1MessagesRoutes)
    stubUpstreamStream([
      ...STREAM_TOOL_FRAMES,
      'event: done',
      'data: {"type":"done","finishReason":"tool_calls"}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/anthropic/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '巴黎天气怎么样' }],
        stream: true,
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.body
    // tool 帧此前全部返回 null ⇒ 流里只剩 message_start 与兜底收尾
    expect(body).toContain('content_block_start')
    expect(body).toContain('"type":"tool_use"')
    expect(body).toContain('"id":"call_1"')
    expect(body).toContain('"name":"get_weather"')
    expect(body).toContain('input_json_delta')
    expect(body).toContain('"partial_json":"{\\"city\\":\\"Paris\\"}"')
    expect(body).toContain('"stop_reason":"tool_use"')
  })
})

// =============================================================================
// ③ /v1/responses 非流式:tools 形状转换 + function_call 输出项
// =============================================================================

describe('F-293 /v1/responses 非流式形状转换', () => {
  it('Responses 扁平 function 工具 ⇒ Chat Completions 嵌套形状;输出独立 function_call 项', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamJson({
      content: '',
      model: 'gpt-5',
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      tool_calls: UPSTREAM_TOOL_CALLS,
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'gpt-5',
        input: '巴黎天气怎么样',
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: '查询天气',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ],
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    // 出站 body:tools 必须是 Chat Completions 的 {type:'function', function:{...}}
    const outboundTools = lastUpstreamBody?.tools as Array<Record<string, unknown>>
    expect(outboundTools).toHaveLength(1)
    expect(outboundTools[0].type).toBe('function')
    expect((outboundTools[0].function as Record<string, unknown>).name).toBe('get_weather')
    expect(outboundTools[0].name).toBeUndefined()

    // 入站 body:function_call 是 output 里的独立项,不是 message.content 的块
    const body = res.json() as { output: Array<Record<string, unknown>> }
    expect(body.output).toHaveLength(1)
    expect(body.output[0]).toMatchObject({
      type: 'function_call',
      call_id: 'call_1',
      name: 'get_weather',
      arguments: '{"city":"Paris"}',
      status: 'completed',
    })
  })

  it('内置工具 web_search 无法转换 ⇒ 显式 400(不静默透传)', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamJson({ content: '不该被调用' })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'gpt-5',
        input: '搜索一下',
        tools: [{ type: 'web_search' }],
      },
    })
    await server.close()

    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('Unsupported built-in tool type')
    expect(res.body).toContain('web_search')
    // 未发上游请求:形状无法转换时不该把内置工具原样塞给 Chat Completions
    expect(lastUpstreamBody).toBeNull()
  })

  it('function_call / function_call_output 历史项 ⇒ assistant tool_calls + tool 消息', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamJson({ content: '巴黎 18℃ 晴', model: 'gpt-5' })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'gpt-5',
        input: [
          { role: 'user', content: '巴黎天气怎么样' },
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'get_weather',
            arguments: '{"city":"Paris"}',
          },
          { type: 'function_call_output', call_id: 'call_1', output: '18℃ 晴' },
        ],
      },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const messages = lastUpstreamBody?.messages as Array<Record<string, unknown>>
    const assistantCall = messages.find((m) => Array.isArray(m.tool_calls))
    expect(assistantCall, 'function_call 历史项不得落成空 user 消息').toMatchObject({
      role: 'assistant',
      tool_calls: [
        { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
      ],
    })
    const toolResult = messages.find((m) => m.role === 'tool')
    expect(toolResult).toMatchObject({ role: 'tool', tool_call_id: 'call_1', content: '18℃ 晴' })
  })
})

// =============================================================================
// ④ /v1/responses 流式:tool 帧 → function_call 输出事件
// =============================================================================

describe('F-293 /v1/responses 流式工具帧', () => {
  it('tool-call-start 帧 ⇒ output_item.added(function_call) + function_call_arguments.done', async () => {
    const server = await boot('/v1', v1ResponsesRoutes)
    stubUpstreamStream([
      ...STREAM_TOOL_FRAMES,
      'event: done',
      'data: {"type":"done","finishReason":"tool_calls"}',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/v1/responses',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { model: 'gpt-5', input: '巴黎天气怎么样', stream: true },
    })
    await server.close()

    expect(res.statusCode).toBe(200)
    const body = res.body
    expect(body).toContain('event: response.output_item.added')
    expect(body).toContain('"type":"function_call"')
    expect(body).toContain('"call_id":"call_1"')
    expect(body).toContain('"name":"get_weather"')
    expect(body).toContain('event: response.function_call_arguments.done')
    expect(body).toContain('event: response.completed')
    // 纯工具回合不得出现空正文增量
    expect(body).not.toContain('event: response.output_text.delta')
  })
})

