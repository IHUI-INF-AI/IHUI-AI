// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { describe, it, expect, afterAll, beforeAll, afterEach, beforeEach, vi } from 'vitest'
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

// 4. Mock @ihui/context-compaction(默认不压缩;保留真实 estimateMessagesTokens 供断言,
//    手动压缩用例可切换到真实 compressContextIfNeeded 验证伪造阈值的触发数学)
const { mockCompressContextIfNeeded } = vi.hoisted(() => ({
  mockCompressContextIfNeeded: vi.fn(),
}))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let realCompressContextIfNeeded: any = null
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  realCompressContextIfNeeded = actual.compressContextIfNeeded
  return {
    ...actual,
    compressContextIfNeeded: mockCompressContextIfNeeded,
  }
})

// 5. Mock chat-queries(/chat/answer 持久化 + 压缩 replaceMessages + chat.ts 会话查询)
//    chat.ts import 了全部查询函数,factory 需逐一提供具名导出(缺导出会导致 named import 为 undefined)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(),
  favoriteConversationsBatch: vi.fn(),
  unfavoriteConversationsBatch: vi.fn(),
  setConversationsArchivedBatch: vi.fn(),
  findMessages: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn().mockResolvedValue([]),
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  branchConversationFrom: vi.fn(),
}))

// 5b. Mock db 实例(conversation-archive 归档落库用;insert 失败由其内部 try/catch 降级为 console.warn)
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

// 6. Mock ai-cost(semantic-summary 计费用;避免拉起真实 db/pricing 模块链,与 services-plugins-smoke 同策略)
const { mockRecordAiCost } = vi.hoisted(() => ({ mockRecordAiCost: vi.fn() }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'
import { chatRoutes } from '../src/routes/chat.js'
import type { FastifyRequest } from 'fastify'
import {
  estimateMessagesTokens,
  type ChatMessage,
} from '@ihui/context-compaction'
import {
  findConversationById,
  findMessagesForExport,
  replaceMessages,
} from '../src/db/chat-queries.js'
import {
  generateSemanticSummary,
  primeSemanticSummary,
  getCachedSemanticSummary,
  getSemanticSummaryCacheStats,
  __clearSemanticSummaryCacheForTests,
} from '../src/utils/semantic-summary.js'

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

describe('generateSemanticSummary(LLM 语义摘要辅助函数,压缩触发前预生成)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** 构造 8 条非 system 消息(> keepRecent=6,有 2 条落入摘要范围) */
  function buildLongMessages() {
    return Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `历史消息 ${i + 1}`,
    }))
  }

  it('成功:返回 LLM 摘要正文(trim),请求含 model/max_tokens=300/摘要 prompt,toCompress 为除最近 6 条外全部', async () => {
    const captured: Array<{ url: string; body: Record<string, unknown> }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      captured.push({ url, body: JSON.parse(init.body as string) as Record<string, unknown> })
      return {
        ok: true,
        json: async () => ({
          content: '  用户在调试压缩功能,关键决策:keepRecent=6  ',
          stub: false,
        }),
      }
    }) as unknown as typeof globalThis.fetch
    try {
      const summary = await generateSemanticSummary(null, buildLongMessages(), 'test-model-x')
      expect(summary).toBe('用户在调试压缩功能,关键决策:keepRecent=6')
      expect(captured).toHaveLength(1)
      expect(captured[0]!.url).toBe('http://mock-ai-service:8803/api/llm/complete')
      const body = captured[0]!.body as {
        model: string
        max_tokens: number
        messages: Array<{ role: string; content: string }>
      }
      expect(body.model).toBe('test-model-x')
      expect(body.max_tokens).toBe(300)
      expect(body.messages[0]!.role).toBe('system')
      // 摘要 prompt 要求保留任务目标/关键决策/重要数据/未完成事项
      expect(body.messages[0]!.content).toContain('任务目标')
      expect(body.messages[0]!.content).toContain('未完成事项')
      // toCompress = 非 system 消息除最近 6 条外(8-6=2 条:历史消息 1/2)
      const convText = body.messages[1]!.content
      expect(convText).toContain('历史消息 1')
      expect(convText).toContain('历史消息 2')
      expect(convText).not.toContain('历史消息 8')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('超时:fetch 挂起超过 3 秒被 AbortController 中断 → 返回 null(静默降级)', async () => {
    vi.useFakeTimers()
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      // 永不 resolve,只在 abort 信号触发时 reject(模拟真实 fetch 的 signal 行为)
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as unknown as typeof globalThis.fetch
    try {
      const promise = generateSemanticSummary(null, buildLongMessages(), 'test-model')
      const summary = await vi.advanceTimersByTimeAsync(3_000).then(() => promise)
      expect(summary).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
      vi.useRealTimers()
    }
  })

  it('失败降级:HTTP 500 / stub 响应(无 LLM key)/ fetch 抛异常 → 全部返回 null', async () => {
    const originalFetch = globalThis.fetch
    try {
      // ① HTTP 500:非 2xx 直接降级
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof globalThis.fetch
      expect(await generateSemanticSummary(null, buildLongMessages(), 'm')).toBeNull()

      // ② stub 模式(复用 batch-worker callLlmComplete 的 json.stub 判断):降级
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: '', stub: true }),
      }) as unknown as typeof globalThis.fetch
      expect(await generateSemanticSummary(null, buildLongMessages(), 'm')).toBeNull()

      // ③ fetch 网络异常:降级
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof globalThis.fetch
      expect(await generateSemanticSummary(null, buildLongMessages(), 'm')).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('keepRecent 对齐:非 system 消息 ≤ 6 条(无可摘要部分)→ 不调 LLM 直接返回 null', async () => {
    const fetchSpy = vi.fn()
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch
    try {
      const messages = Array.from({ length: 6 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `msg ${i}`,
      }))
      expect(await generateSemanticSummary(null, messages, 'm')).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('语义摘要预压缩缓存(prime 70% 预生成 → getCached 88% 命中,后台预压缩能力)', () => {
  beforeEach(() => {
    __clearSemanticSummaryCacheForTests()
  })

  /** 构造 8 条非 system 消息(> keepRecent=6,toCompress 为前 2 条) */
  function buildLongMessages() {
    return Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `历史消息 ${i + 1}`,
    }))
  }

  /** mock ai-service 摘要接口:返回固定正文,返回恢复函数 */
  function mockSummaryFetch(content: string) {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ content, stub: false }),
      }) as unknown as typeof globalThis.fetch
    return () => {
      globalThis.fetch = originalFetch
    }
  }

  /** prime 是 fire-and-forget:让一个宏任务跑完,后台微任务链(含 mocked fetch)即全部完成 */
  async function flushAsync() {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  it('prime 后 getCached 命中(同消息)→ 返回同摘要', async () => {
    const restore = mockSummaryFetch('预生成的会话摘要')
    try {
      const messages = buildLongMessages()
      await primeSemanticSummary(null, messages, 'test-model', 'conv-1')
      await flushAsync()
      expect(getCachedSemanticSummary('conv-1', messages)).toBe('预生成的会话摘要')
    } finally {
      restore()
    }
  })

  it('消息变化后 hash 失效:getCached 返回 null', async () => {
    const restore = mockSummaryFetch('旧摘要')
    try {
      const messages = buildLongMessages()
      await primeSemanticSummary(null, messages, 'test-model', 'conv-1')
      await flushAsync()
      expect(getCachedSemanticSummary('conv-1', messages)).toBe('旧摘要')
      // 改动 toCompress 范围内的消息(第 1 条)→ 序列化文本变化 → hash 自然失效
      const changed = messages.map((m, i) => (i === 0 ? { ...m, content: '被编辑过的历史' } : m))
      expect(getCachedSemanticSummary('conv-1', changed)).toBeNull()
    } finally {
      restore()
    }
  })

  it('prime 阶段 LLM 失败(HTTP 500 / fetch 异常):不抛异常且缓存不写入', async () => {
    const originalFetch = globalThis.fetch
    try {
      // ① HTTP 500:prime 本身正常 resolve,后台生成降级为 null → 不写缓存
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof globalThis.fetch
      await expect(
        primeSemanticSummary(null, buildLongMessages(), 'm', 'conv-err'),
      ).resolves.toBeUndefined()
      await flushAsync()
      expect(getCachedSemanticSummary('conv-err', buildLongMessages())).toBeNull()

      // ② fetch 网络异常:后台任务吞掉一切异常,不影响调用方
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof globalThis.fetch
      await expect(
        primeSemanticSummary(null, buildLongMessages(), 'm', 'conv-err2'),
      ).resolves.toBeUndefined()
      await flushAsync()
      expect(getCachedSemanticSummary('conv-err2', buildLongMessages())).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('缓存容量 200:写入 201 条后最老的条目被 FIFO 淘汰', async () => {
    const restore = mockSummaryFetch('容量测试摘要')
    try {
      const messages = buildLongMessages()
      for (let i = 0; i < 201; i++) {
        await primeSemanticSummary(null, messages, 'm', `conv-${i}`)
        await flushAsync()
      }
      // 最老(conv-0)已被淘汰,最新(conv-200)仍在
      expect(getCachedSemanticSummary('conv-0', messages)).toBeNull()
      expect(getCachedSemanticSummary('conv-200', messages)).toBe('容量测试摘要')
    } finally {
      restore()
    }
  })

  it('conversationId 缺省(undefined):key 仍可用(undefined 串入 key)', async () => {
    const restore = mockSummaryFetch('匿名会话摘要')
    try {
      const messages = buildLongMessages()
      await primeSemanticSummary(null, messages, 'test-model')
      await flushAsync()
      expect(getCachedSemanticSummary(undefined, messages)).toBe('匿名会话摘要')
    } finally {
      restore()
    }
  })
})

describe('语义摘要观测与计费(hit/miss 统计 + recordAiCost 配额接入)', () => {
  /** 构造 8 条非 system 消息(> keepRecent=6,toCompress 为前 2 条) */
  function buildLongMessages() {
    return Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `历史消息 ${i + 1}`,
    }))
  }

  /** mock ai-service 摘要接口:返回完整 json(可带 usage),返回恢复函数 */
  function mockSummaryJsonFetch(json: Record<string, unknown>) {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => json }) as unknown as typeof globalThis.fetch
    return () => {
      globalThis.fetch = originalFetch
    }
  }

  /** 让一个宏任务跑完(prime fire-and-forget 的后台微任务链全部完成) */
  async function flushAsync() {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  /** 最小 FastifyRequest 形状:aiServiceFetch 只读 headers,计费只读 userId(auth 插件挂载字段) */
  const fakeRequest = { headers: {}, userId: 'u-semantic-1' } as unknown as FastifyRequest

  beforeEach(() => {
    __clearSemanticSummaryCacheForTests()
    mockRecordAiCost.mockReset()
    mockRecordAiCost.mockResolvedValue(undefined)
  })

  it('getSemanticSummaryCacheStats:未命中 +1 miss,生成成功后命中 +1 hit,size 同步增长', async () => {
    const restore = mockSummaryJsonFetch({ content: '统计测试摘要', stub: false })
    try {
      const messages = buildLongMessages()
      const before = getSemanticSummaryCacheStats()
      // 未命中(未预生成)→ misses +1
      expect(getCachedSemanticSummary('conv-stats', messages)).toBeNull()
      const afterMiss = getSemanticSummaryCacheStats()
      expect(afterMiss.misses).toBe(before.misses + 1)
      expect(afterMiss.hits).toBe(before.hits)
      // 生成成功写缓存(generate 内部带 conversationId 的 key)→ getCached 命中,size 精确 +1
      await generateSemanticSummary(null, messages, 'm', 'conv-stats')
      expect(getCachedSemanticSummary('conv-stats', messages)).toBe('统计测试摘要')
      const afterHit = getSemanticSummaryCacheStats()
      expect(afterHit.hits).toBe(afterMiss.hits + 1)
      expect(afterHit.misses).toBe(afterMiss.misses)
      expect(afterHit.size).toBe(before.size + 1)
    } finally {
      restore()
    }
  })

  it('计费:生成成功后调 recordAiCost,usage 透传,metadata 标注 source=semantic-summary', async () => {
    const restore = mockSummaryJsonFetch({
      content: '计费测试摘要',
      stub: false,
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    })
    try {
      const summary = await generateSemanticSummary(
        fakeRequest,
        buildLongMessages(),
        'stepfun/step-3.7-flash',
        'conv-billing',
      )
      expect(summary).toBe('计费测试摘要')
      expect(mockRecordAiCost).toHaveBeenCalledTimes(1)
      const arg = mockRecordAiCost.mock.calls[0]![0] as Record<string, unknown>
      expect(arg).toMatchObject({
        userId: 'u-semantic-1',
        model: 'stepfun/step-3.7-flash',
        provider: 'stepfun',
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
        requestType: 'semantic-summary',
      })
      expect(JSON.parse(arg.metadata as string)).toEqual({ source: 'semantic-summary' })
    } finally {
      restore()
    }
  })

  it('计费异常被吞:recordAiCost 抛异常时 generateSemanticSummary 仍正常返回摘要', async () => {
    const restore = mockSummaryJsonFetch({ content: '异常测试摘要', stub: false })
    try {
      mockRecordAiCost.mockRejectedValueOnce(new Error('db down'))
      await expect(
        generateSemanticSummary(fakeRequest, buildLongMessages(), 'm', 'conv-err-billing'),
      ).resolves.toBe('异常测试摘要')
    } finally {
      restore()
    }
  })

  it('request 为 null(后台路径)时跳过计费且不抛异常', async () => {
    const restore = mockSummaryJsonFetch({ content: '匿名路径摘要', stub: false })
    try {
      const summary = await generateSemanticSummary(null, buildLongMessages(), 'm', 'conv-null')
      expect(summary).toBe('匿名路径摘要')
      expect(mockRecordAiCost).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('上游无 usage 字段时按字符估算 tokens(中文为主 ~2 字符/token)', async () => {
    const restore = mockSummaryJsonFetch({ content: '无 usage 的摘要', stub: false })
    try {
      await generateSemanticSummary(fakeRequest, buildLongMessages(), 'm', 'conv-estimate')
      expect(mockRecordAiCost).toHaveBeenCalledTimes(1)
      const arg = mockRecordAiCost.mock.calls[0]![0] as {
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }
      expect(Number.isInteger(arg.promptTokens)).toBe(true)
      expect(arg.promptTokens).toBeGreaterThan(0)
      expect(arg.completionTokens).toBe(Math.ceil('无 usage 的摘要'.length / 2))
      expect(arg.totalTokens).toBe(arg.promptTokens + arg.completionTokens)
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
