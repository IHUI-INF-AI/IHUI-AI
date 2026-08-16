/**
 * v1-messages 端点 + anthropic-adapter 转换层测试(2026-07-31 立,P0-6)。
 *
 * 覆盖:
 * - anthropicRequestToOpenAI:5 个用例(basic / system / tools / tool_use content / tool_result content)
 * - openAIResponseToAnthropic:3 个用例(basic text / tool_calls / stop_reason mapping)
 * - openAIStreamChunkToAnthropicEvents:4 个用例(first chunk / text delta / tool_calls delta / last chunk stop)
 * - parseUpstreamLineToOpenAIChunk:2 个用例(Vercel SDK / SSE data)
 * - 路由集成:2 个用例(非流式 mock / 流式 mock)
 *
 * 共 16 个测试用例。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// mock db(避免连真实库)
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

// mock 参数覆盖系统(避免连真实库查 systemConfigs 表):透传原 body,不应用任何规则
vi.mock('../src/services/relay-param-ops-config.js', () => ({
  applyParamOpsToBody: vi.fn(async (body: Record<string, unknown>) => ({
    body,
    appliedRules: [],
    modified: false,
  })),
}))

// mock 鉴权插件:注入 apiKey 上下文,preHandler 直接放行
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

// mock 计费服务:checkQuota 放行 + recordCall 直接返回成功 + modelToProviderCode 占位
vi.mock('../src/services/relay-billing-service.js', () => ({
  checkQuota: vi.fn().mockResolvedValue({
    allowed: true,
    apiKeyId: 'ak_test_001',
    userId: 'user_test_001',
    tokenBalance: 10000,
    costBalanceCents: 10000,
  }),
  recordCall: vi.fn().mockResolvedValue({
    logId: 'log_test_001',
    costCents: 1,
    newTokenBalance: 9999,
    newCostBalanceCents: 9999,
  }),
  isByokCall: vi.fn().mockResolvedValue(false),
  modelToProviderCode: vi.fn().mockReturnValue('openai'),
}))

import {
  anthropicRequestToOpenAI,
  openAIResponseToAnthropic,
  openAIStreamChunkToAnthropicEvents,
  createStreamState,
  parseUpstreamLineToOpenAIChunk,
  serializeAnthropicSSEEvent,
  type AnthropicMessagesRequest,
  type OpenAIChatResponse,
  type OpenAIChatChunk,
} from '../src/services/anthropic-adapter'
import v1MessagesRoutes from '../src/routes/v1-messages'

// =============================================================================
// 1. anthropicRequestToOpenAI(5 用例)
// =============================================================================

describe('anthropicRequestToOpenAI', () => {
  it('basic:字符串 content 直接转 OpenAI messages', () => {
    const input: AnthropicMessagesRequest = {
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好,有什么可以帮你?' },
      ],
      max_tokens: 1024,
    }
    const out = anthropicRequestToOpenAI(input)
    expect(out.model).toBe('claude-3-5-sonnet')
    expect(out.max_tokens).toBe(1024)
    expect(out.messages).toEqual([
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好,有什么可以帮你?' },
    ])
  })

  it('with system:顶层 system 转 messages[0] {role:system}', () => {
    const input: AnthropicMessagesRequest = {
      model: 'claude-3-5-sonnet',
      system: '你是一个翻译助手',
      messages: [{ role: 'user', content: '把"hello"翻译成中文' }],
      max_tokens: 256,
    }
    const out = anthropicRequestToOpenAI(input)
    expect(out.messages[0]).toEqual({ role: 'system', content: '你是一个翻译助手' })
    expect(out.messages[1]).toEqual({ role: 'user', content: '把"hello"翻译成中文' })
  })

  it('with system array:数组形式 system 拼接为字符串', () => {
    const input: AnthropicMessagesRequest = {
      model: 'claude-3-5-sonnet',
      system: [
        { type: 'text', text: '规则1' },
        { type: 'text', text: '规则2' },
      ],
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 256,
    }
    const out = anthropicRequestToOpenAI(input)
    expect(out.messages[0]).toEqual({ role: 'system', content: '规则1\n规则2' })
  })

  it('with tools:Anthropic tools 转 OpenAI function 格式', () => {
    const input: AnthropicMessagesRequest = {
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: '北京天气' }],
      max_tokens: 1024,
      tools: [
        {
          name: 'get_weather',
          description: '查询天气',
          input_schema: { type: 'object', properties: { city: { type: 'string' } } },
        },
      ],
      tool_choice: { type: 'auto' },
    }
    const out = anthropicRequestToOpenAI(input)
    expect(out.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: '查询天气',
          parameters: { type: 'object', properties: { city: { type: 'string' } } },
        },
      },
    ])
    expect(out.tool_choice).toBe('auto')
  })

  it('with tool_use + tool_result content:block 数组转 OpenAI tool_calls + tool 消息', () => {
    const input: AnthropicMessagesRequest = {
      model: 'claude-3-5-sonnet',
      messages: [
        {
          role: 'user',
          content: '北京天气',
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: '我来查一下' },
            { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: '北京' } },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: '晴天 25 度' }],
        },
      ],
      max_tokens: 1024,
    }
    const out = anthropicRequestToOpenAI(input)
    // user[0]
    expect(out.messages[0]).toEqual({ role: 'user', content: '北京天气' })
    // assistant: text + tool_calls
    const assistant = out.messages[1]
    expect(assistant.role).toBe('assistant')
    expect(assistant.content).toBe('我来查一下')
    expect(assistant.tool_calls).toEqual([
      {
        id: 'toolu_01',
        type: 'function',
        function: { name: 'get_weather', arguments: JSON.stringify({ city: '北京' }) },
      },
    ])
    // user tool_result → OpenAI tool 消息
    const toolMsg = out.messages[2]
    expect(toolMsg.role).toBe('tool')
    expect(toolMsg.content).toBe('晴天 25 度')
    expect(toolMsg.tool_call_id).toBe('toolu_01')
  })
})

// =============================================================================
// 2. openAIResponseToAnthropic(3 用例)
// =============================================================================

describe('openAIResponseToAnthropic', () => {
  it('basic text:content 转 text block,usage 字段映射', () => {
    const resp: OpenAIChatResponse = {
      id: 'chatcmpl-1',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: '你好世界' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }
    const out = openAIResponseToAnthropic(resp, 'claude-3-5-sonnet')
    expect(out.type).toBe('message')
    expect(out.role).toBe('assistant')
    expect(out.content).toEqual([{ type: 'text', text: '你好世界' }])
    expect(out.stop_reason).toBe('end_turn')
    expect(out.usage).toEqual({ input_tokens: 10, output_tokens: 20 })
  })

  it('with tool_calls:追加 tool_use block,input JSON 解析', () => {
    const resp: OpenAIChatResponse = {
      id: 'chatcmpl-2',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call_01',
                type: 'function',
                function: { name: 'get_weather', arguments: '{"city":"北京"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
    }
    const out = openAIResponseToAnthropic(resp, 'claude-3-5-sonnet')
    expect(out.content).toHaveLength(1)
    expect(out.content[0]).toEqual({
      type: 'tool_use',
      id: 'call_01',
      name: 'get_weather',
      input: { city: '北京' },
    })
    expect(out.stop_reason).toBe('tool_use')
  })

  it('stop_reason mapping:length → max_tokens', () => {
    const resp: OpenAIChatResponse = {
      id: 'chatcmpl-3',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: '截断的文本' },
          finish_reason: 'length',
        },
      ],
    }
    const out = openAIResponseToAnthropic(resp, 'claude-3-5-sonnet')
    expect(out.stop_reason).toBe('max_tokens')
    expect(out.usage).toEqual({ input_tokens: 0, output_tokens: 0 })
  })
})

// =============================================================================
// 3. openAIStreamChunkToAnthropicEvents(4 用例)
// =============================================================================

describe('openAIStreamChunkToAnthropicEvents', () => {
  it('first chunk:发 message_start + content_block_start + content_block_delta', () => {
    const state = createStreamState('claude-3-5-sonnet')
    const chunk: OpenAIChatChunk = {
      id: 'chatcmpl-1',
      choices: [{ index: 0, delta: { content: '你好' }, finish_reason: null }],
    }
    const events = openAIStreamChunkToAnthropicEvents(chunk, state)
    expect(events.map((e) => e.type)).toEqual([
      'message_start',
      'content_block_start',
      'content_block_delta',
    ])
    expect(events[0].type).toBe('message_start')
    expect(state.messageStarted).toBe(true)
    expect(state.contentBlockStarted).toBe(true)
  })

  it('text delta:首个 chunk 后只发 content_block_delta', () => {
    const state = createStreamState('claude-3-5-sonnet')
    // 先发首 chunk
    openAIStreamChunkToAnthropicEvents(
      { id: 'c1', choices: [{ index: 0, delta: { content: 'a' }, finish_reason: null }] },
      state,
    )
    // 第二个 chunk
    const events = openAIStreamChunkToAnthropicEvents(
      { id: 'c1', choices: [{ index: 0, delta: { content: 'b' }, finish_reason: null }] },
      state,
    )
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('content_block_delta')
    if (events[0].type === 'content_block_delta') {
      expect(events[0].delta).toEqual({ type: 'text_delta', text: 'b' })
    }
  })

  it('tool_calls delta:发 content_block_start(tool_use) + input_json_delta', () => {
    const state = createStreamState('claude-3-5-sonnet')
    // 先发一个 text chunk 开 message
    openAIStreamChunkToAnthropicEvents(
      { id: 'c1', choices: [{ index: 0, delta: { content: 'thinking' }, finish_reason: null }] },
      state,
    )
    // tool_call 起 block
    const events1 = openAIStreamChunkToAnthropicEvents(
      {
        id: 'c2',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_01',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      },
      state,
    )
    // 应包含 content_block_stop(关闭 text)+ content_block_start(tool_use)
    expect(events1.map((e) => e.type)).toContain('content_block_stop')
    expect(events1.map((e) => e.type)).toContain('content_block_start')
    const startEv = events1.find((e) => e.type === 'content_block_start')
    expect(startEv).toBeDefined()
    if (startEv && startEv.type === 'content_block_start') {
      expect(startEv.content_block.type).toBe('tool_use')
    }
    expect(state.toolUseStarted).toBe(true)

    // arguments 增量
    const events2 = openAIStreamChunkToAnthropicEvents(
      {
        id: 'c3',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '{"city":"北京"}' } }],
            },
            finish_reason: null,
          },
        ],
      },
      state,
    )
    const deltaEv = events2.find((e) => e.type === 'content_block_delta')
    expect(deltaEv).toBeDefined()
    if (deltaEv && deltaEv.type === 'content_block_delta') {
      expect(deltaEv.delta).toEqual({ type: 'input_json_delta', partial_json: '{"city":"北京"}' })
    }
  })

  it('last chunk stop:发 content_block_stop + message_delta + message_stop', () => {
    const state = createStreamState('claude-3-5-sonnet')
    // 起 message + block
    openAIStreamChunkToAnthropicEvents(
      { id: 'c1', choices: [{ index: 0, delta: { content: 'hi' }, finish_reason: null }] },
      state,
    )
    // stop chunk
    const events = openAIStreamChunkToAnthropicEvents(
      { id: 'c2', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      state,
    )
    expect(events.map((e) => e.type)).toEqual([
      'content_block_stop',
      'message_delta',
      'message_stop',
    ])
    const msgDelta = events.find((e) => e.type === 'message_delta')
    if (msgDelta && msgDelta.type === 'message_delta') {
      expect(msgDelta.delta.stop_reason).toBe('end_turn')
      expect(msgDelta.usage.output_tokens).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// 4. parseUpstreamLineToOpenAIChunk(2 用例)
// =============================================================================

describe('parseUpstreamLineToOpenAIChunk', () => {
  it('Vercel AI SDK 0:"text" 格式', () => {
    const chunk = parseUpstreamLineToOpenAIChunk('0:"hello"', 'claude-3-5-sonnet')
    expect(chunk).not.toBeNull()
    expect(chunk?.choices[0].delta.content).toBe('hello')
  })

  it('SSE data: {choices:[{delta:{content}}]} 格式 + [DONE] 返回 null', () => {
    const chunk = parseUpstreamLineToOpenAIChunk(
      'data: {"choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}]}',
      'claude-3-5-sonnet',
    )
    expect(chunk).not.toBeNull()
    expect(chunk?.choices[0].delta.content).toBe('world')
    expect(parseUpstreamLineToOpenAIChunk('data: [DONE]', 'claude-3-5-sonnet')).toBeNull()
    expect(parseUpstreamLineToOpenAIChunk('', 'claude-3-5-sonnet')).toBeNull()
  })
})

// =============================================================================
// 5. serializeAnthropicSSEEvent(1 用例,辅助函数)
// =============================================================================

describe('serializeAnthropicSSEEvent', () => {
  it('生成 event: type\\ndata: json\\n\\n 格式', () => {
    const out = serializeAnthropicSSEEvent({ type: 'message_stop' })
    expect(out).toBe('event: message_stop\ndata: {"type":"message_stop"}\n\n')
  })
})

// =============================================================================
// 6. 路由集成(2 用例,mock fetch + 计费)
// =============================================================================

describe('POST /v1/messages 路由集成', () => {
  let server: ReturnType<typeof Fastify>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    server = Fastify({ logger: false })
    // 统一错误格式为 {code, message},匹配 errorResponseSchema(避免 Fastify 默认
    // 校验错误格式 {statusCode,error,message} 与 response schema 不匹配导致 500)
    server.setErrorHandler((err, _req, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
  })

  afterEach(async () => {
    await server.close()
    globalThis.fetch = originalFetch
    // 只清调用记录,不重置 vi.mock 工厂设置的 mockResolvedValue(restoreAllMocks 会清掉)
    vi.clearAllMocks()
  })

  it('非流式:返回 Anthropic Messages 格式响应', async () => {
    // mock fetch 返回 ai-service 非流式响应
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: '你好,世界',
        model: 'claude-3-5-sonnet',
        usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
      }),
    }) as unknown as typeof globalThis.fetch

    await server.register(v1MessagesRoutes, { prefix: '/v1' })
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '你好' }],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.type).toBe('message')
    expect(body.role).toBe('assistant')
    expect(body.content).toEqual([{ type: 'text', text: '你好,世界' }])
    expect(body.stop_reason).toBe('end_turn')
    expect(body.usage.input_tokens).toBe(5)
    expect(body.usage.output_tokens).toBe(8)
  })

  it('流式:返回 Anthropic SSE 事件流', async () => {
    // mock fetch 返回 ReadableStream(Vercel AI SDK 格式)
    const encoder = new TextEncoder()
    const sseBody = ['0:"你好"', '0:",世界"', 'data: [DONE]'].join('\n') + '\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
      text: async () => '',
    }) as unknown as typeof globalThis.fetch

    await server.register(v1MessagesRoutes, { prefix: '/v1' })
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        model: 'claude-3-5-sonnet',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '你好' }],
        stream: true,
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    const text = res.body
    // 应包含 Anthropic SSE 事件类型
    expect(text).toContain('event: message_start')
    expect(text).toContain('event: content_block_start')
    expect(text).toContain('event: content_block_delta')
    expect(text).toContain('event: message_stop')
    // 应包含流式文本
    expect(text).toContain('你好')
    expect(text).toContain(',世界')
  })

  it('参数校验失败返回 400', async () => {
    await server.register(v1MessagesRoutes, { prefix: '/v1' })
    await server.ready()

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        // 缺 max_tokens
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: '你好' }],
      },
    })
    expect(res.statusCode).toBe(400)
  })
})
