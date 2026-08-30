/**
 * 原生 function calling 网关透传测试 — /chat/stream + /chat/answer 的 tools/tool_choice
 *
 * 背景(2026-08-31):CLI 直连 ai-service 时原生 FC 已通(tools 字段透传 +
 * tool-call-start SSE 事件下发),但 apps/api 8802 网关的 zod schema 不含 tools,
 * safeParse 默认 strip 未声明字段 → 经网关中转的客户端(Web 等)的 tools 被丢弃。
 *
 * 本测试锁定契约:
 * 1. 请求侧:tools / tool_choice 原样到达 ai-service(字段名与
 *    LLMCompleteRequest tools: list[dict] | None, tool_choice: str | dict | None 对齐)
 * 2. 响应侧:event: tool-call-start / tool-result SSE 事件逐行透传给客户端(不被过滤/改名)
 * 3. 不带 tools 的请求不注入(undefined 时 JSON.stringify 省略 key)
 *
 * Mock 策略(参照 chat-questions.test.ts):
 * - config / @ihui/auth / @ihui/types / @ihui/context-compaction / chat-queries 全 mock
 * - global.fetch mock 捕获出站 body 并返回带 tool-call-start 的 SSE 流
 */
import { describe, it, expect, afterAll, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// 1. Mock config 避免 env 校验触发 process.exit(1)
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 2. Mock @ihui/auth(提供 verifyAccessToken 给 authenticate plugin)
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))

// auth.ts P2-14 安全加固新增 getUserStatus 查询,mock 返回 active
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// 3. Mock @ihui/types message-repair(避免依赖真实实现)
vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})

// 4. Mock @ihui/context-compaction(默认不压缩)
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    compressContextIfNeeded: () => ({
      compressed: false,
      messages: [],
      originalTokens: 0,
      compressedTokens: 0,
      removedCount: 0,
    }),
  }
})

// 5. Mock chat-queries(/chat/answer 持久化 + 压缩 replaceMessages)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
}))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

const USER_TOKEN = 'Bearer user-token'

function mockUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
}

/** ai-service 下发的 tool-call-start SSE 事件 data(与 llm.py 契约一致) */
const TOOL_CALL_START_DATA = {
  type: 'tool-call-start',
  toolCallId: 'call_abc123',
  toolName: 'get_weather',
  args: { city: '北京' },
}

/** mock ai-service SSE 流:tool-call-start → tool-result → chunk → done */
const UPSTREAM_SSE = [
  `event: tool-call-start\ndata: ${JSON.stringify(TOOL_CALL_START_DATA)}\n\n`,
  `event: tool-result\ndata: ${JSON.stringify({
    type: 'tool-result',
    toolCallId: 'call_abc123',
    result: '{"temp":25}',
  })}\n\n`,
  `event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: '今天 25 度' })}\n\n`,
  `event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
].join('')

/** mock fetch:捕获出站 body + 返回 SSE 流,返回恢复函数 */
function mockAIServiceSSEWithTools() {
  const capturedBodies: Record<string, unknown>[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>
    capturedBodies.push(body)
    return Promise.resolve({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(UPSTREAM_SSE))
          controller.close()
        },
      }),
    })
  }) as unknown as typeof globalThis.fetch
  return {
    capturedBodies,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询城市天气',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
]

describe('原生 function calling 网关透传(/chat/stream + /chat/answer)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/ai/chat/stream — 请求侧 tools/tool_choice 透传', () => {
    it('tools + tool_choice 原样到达 ai-service(不被 zod strip)', async () => {
      mockUser()
      const { capturedBodies, restore } = mockAIServiceSSEWithTools()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: '北京天气' }],
            model: 'gpt-4o',
            tools: OPENAI_TOOLS,
            tool_choice: 'auto',
          },
        })
        expect(res.statusCode).toBe(200)
        expect(capturedBodies).toHaveLength(1)
        const sentBody = capturedBodies[0]!
        // tools 数组原样透传(JSON schema parameters 等字段不丢失)
        expect(sentBody.tools).toEqual(OPENAI_TOOLS)
        expect(sentBody.tool_choice).toBe('auto')
      } finally {
        restore()
      }
    })

    it('tool_choice 支持对象形式({type:function, function:{name}})', async () => {
      mockUser()
      const { capturedBodies, restore } = mockAIServiceSSEWithTools()
      const toolChoice = { type: 'function', function: { name: 'get_weather' } }
      try {
        await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            tools: OPENAI_TOOLS,
            tool_choice: toolChoice,
          },
        })
        expect(capturedBodies[0]!.tool_choice).toEqual(toolChoice)
      } finally {
        restore()
      }
    })

    it('不带 tools 的请求不注入(undefined 不产生 key)', async () => {
      mockUser()
      const { capturedBodies, restore } = mockAIServiceSSEWithTools()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
          },
        })
        expect(res.statusCode).toBe(200)
        expect(capturedBodies).toHaveLength(1)
        const sentBody = capturedBodies[0]!
        expect('tools' in sentBody).toBe(false)
        expect('tool_choice' in sentBody).toBe(false)
        expect(sentBody.tools).toBeUndefined()
        expect(sentBody.tool_choice).toBeUndefined()
      } finally {
        restore()
      }
    })
  })

  describe('POST /api/ai/chat/stream — 响应侧 SSE 事件透传', () => {
    it('tool-call-start / tool-result 事件原样透传给客户端(不改名/不丢 data)', async () => {
      mockUser()
      const { restore } = mockAIServiceSSEWithTools()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/stream',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: '北京天气' }],
            tools: OPENAI_TOOLS,
          },
        })
        expect(res.statusCode).toBe(200)
        const body = res.body
        // event 名原样透传(无 agentId 时不做任何改写)
        expect(body).toContain('event: tool-call-start')
        expect(body).toContain('event: tool-result')
        expect(body).toContain('event: chunk')
        // data 原样透传:toolCallId / toolName / args 不丢
        expect(body).toContain(JSON.stringify(TOOL_CALL_START_DATA))
        expect(body).toContain('"toolCallId":"call_abc123"')
        expect(body).toContain('"toolName":"get_weather"')
      } finally {
        restore()
      }
    })
  })

  describe('POST /api/ai/chat/answer — tools/tool_choice 同样透传(继承 schema)', () => {
    it('tools + tool_choice 到达 ai-service 且 tool-call-start 事件透传', async () => {
      mockUser()
      const { capturedBodies, restore } = mockAIServiceSSEWithTools()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            tools: OPENAI_TOOLS,
            tool_choice: 'auto',
            questionId: 'q-1',
            answer: '继续',
          },
        })
        expect(res.statusCode).toBe(200)
        expect(capturedBodies).toHaveLength(1)
        const sentBody = capturedBodies[0]!
        expect(sentBody.tools).toEqual(OPENAI_TOOLS)
        expect(sentBody.tool_choice).toBe('auto')
        // SSE 事件同样透传
        expect(res.body).toContain('event: tool-call-start')
        expect(res.body).toContain('"toolCallId":"call_abc123"')
      } finally {
        restore()
      }
    })

    it('不带 tools 的 answer 请求不注入', async () => {
      mockUser()
      const { capturedBodies, restore } = mockAIServiceSSEWithTools()
      try {
        await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            questionId: 'q-1',
            answer: '继续',
          },
        })
        const sentBody = capturedBodies[0]!
        expect('tools' in sentBody).toBe(false)
        expect('tool_choice' in sentBody).toBe(false)
      } finally {
        restore()
      }
    })
  })
})
