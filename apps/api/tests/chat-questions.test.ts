/**
 * AI 主动提问多端同步持久化测试 — /chat/questions + /chat/answer P2 增强
 *
 * 背景:2026-07-21 P2 任务把 AI 主动提问挂起状态(pendingQuestion)持久化到
 * chat_conversations.metadata,实现跨端同步。本测试锁定核心契约:
 * 1. POST /chat/questions:持久化 pendingQuestion + WS 广播 ai_question
 * 2. POST /chat/answer:fire-and-forget 持久化 answer + 清挂起 + WS 广播
 *    chat_message + chat_question_answered
 * 3. ownership 校验:用户不能修改他人对话的 metadata
 * 4. 容错:持久化失败不阻塞 SSE 流(参考 persistMessageSafe 策略)
 *
 * Mock 策略(参照 ai-chain-contract.test.ts):
 * - config / @ihui/auth / @ihui/types / @ihui/context-compaction / db chat-queries 全 mock
 * - global.fetch mock 用于 /chat/answer 的 ai-service SSE 调用
 * - pushNotification 用 app.decorate 注册 spy
 */
import { describe, it, expect, afterAll, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// 1. Mock config 避免 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8080,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:3000',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8000',
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
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000002'),
}))

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

// 5. Mock chat-queries —— 关键 spy:createMessage / patchConversationMetadata
const { mockCreateMessage, mockPatchConversationMetadata } = vi.hoisted(() => ({
  mockCreateMessage: vi.fn(),
  mockPatchConversationMetadata: vi.fn(),
}))
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: mockCreateMessage,
  patchConversationMetadata: mockPatchConversationMetadata,
}))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const USER_TOKEN = 'Bearer user-token'

function mockUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_ID,
    phone: '13800000001',
    familyId: '00000000-0000-0000-0000-000000000002',
    roleId: 0,
  })
}

/** mock ai-service SSE 流(立即 close,无任何 chunk) */
function mockAIServiceSSE() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
  }) as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

describe('AI 主动提问多端同步持久化(P2)', () => {
  const server = Fastify({ logger: false })
  const pushSpy = vi.fn()

  beforeAll(async () => {
    // 注册 pushNotification spy(模拟 WebSocket 推送)
    server.decorate('pushNotification', pushSpy)
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    pushSpy.mockClear()
    mockCreateMessage.mockReset()
    mockPatchConversationMetadata.mockReset()
  })

  // ===========================================================================
  // POST /chat/questions
  // ===========================================================================
  describe('POST /api/ai/chat/questions', () => {
    it('无 Authorization header → 401', async () => {
      // mockVerifyAccessToken 未配置 → 默认返回 undefined,但 authenticate 先检 header
      mockVerifyAccessToken.mockReset()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        body: {
          conversationId: 'conv-1',
          questionId: 'q-1',
          prompt: '请选择',
          options: [],
          allowCustom: false,
          allowMultiple: false,
        },
      })
      expect(res.statusCode).toBe(401)
      expect(mockPatchConversationMetadata).not.toHaveBeenCalled()
      expect(pushSpy).not.toHaveBeenCalled()
    })

    it('缺 questionId → 400(Zod 校验)', async () => {
      mockUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        headers: { authorization: USER_TOKEN },
        body: {
          conversationId: 'conv-1',
          // questionId 缺失
          prompt: '请选择',
          options: [],
          allowCustom: false,
          allowMultiple: false,
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('缺 conversationId → 400(Zod 校验)', async () => {
      mockUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        headers: { authorization: USER_TOKEN },
        body: {
          // conversationId 缺失
          questionId: 'q-1',
          prompt: '请选择',
          options: [],
          allowCustom: false,
          allowMultiple: false,
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('对话不存在或不属于该用户 → 404(patchConversationMetadata 返回 undefined)', async () => {
      mockUser()
      mockPatchConversationMetadata.mockResolvedValue(undefined) // ownership 校验失败
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        headers: { authorization: USER_TOKEN },
        body: {
          conversationId: 'other-user-conv',
          questionId: 'q-1',
          prompt: '请选择',
          options: [{ id: 'a', label: '选项A' }],
          allowCustom: true,
          allowMultiple: false,
        },
      })
      expect(res.statusCode).toBe(404)
      // 404 时不应 WS 广播(避免给不存在的对话发通知)
      expect(pushSpy).not.toHaveBeenCalled()
    })

    it('正常持久化 → 200 + patchConversationMetadata 调用参数正确 + WS 广播 ai_question', async () => {
      mockUser()
      const updatedConv = {
        id: 'conv-1',
        userId: USER_ID,
        metadata: { pendingQuestion: { questionId: 'q-1' } },
      }
      mockPatchConversationMetadata.mockResolvedValue(updatedConv)

      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        headers: { authorization: USER_TOKEN },
        body: {
          conversationId: 'conv-1',
          questionId: 'q-1',
          prompt: '请选择一种方式',
          options: [
            { id: 'a', label: '选项A' },
            { id: 'b', label: '选项B' },
          ],
          allowCustom: true,
          allowMultiple: false,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({ ok: true, persisted: true })

      // 1. patchConversationMetadata 调用参数:merge 模式 + ownership 校验
      expect(mockPatchConversationMetadata).toHaveBeenCalledTimes(1)
      const [callId, callUserId, callMerge] = mockPatchConversationMetadata.mock.calls[0]!
      expect(callId).toBe('conv-1')
      expect(callUserId).toBe(USER_ID)
      expect(callMerge).toEqual({
        pendingQuestion: {
          questionId: 'q-1',
          prompt: '请选择一种方式',
          options: [
            { id: 'a', label: '选项A' },
            { id: 'b', label: '选项B' },
          ],
          allowCustom: true,
          allowMultiple: false,
        },
      })

      // 2. WS 广播 ai_question 给其他端
      expect(pushSpy).toHaveBeenCalledTimes(1)
      const [pushUserId, pushPayload] = pushSpy.mock.calls[0]!
      expect(pushUserId).toBe(USER_ID)
      expect(pushPayload).toEqual({
        type: 'ai_question',
        conversationId: 'conv-1',
        question: {
          questionId: 'q-1',
          prompt: '请选择一种方式',
          options: [
            { id: 'a', label: '选项A' },
            { id: 'b', label: '选项B' },
          ],
          allowCustom: true,
          allowMultiple: false,
        },
      })
    })

    it('options 默认为 [](Zod default)', async () => {
      mockUser()
      mockPatchConversationMetadata.mockResolvedValue({
        id: 'conv-1',
        userId: USER_ID,
        metadata: {},
      })
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/questions',
        headers: { authorization: USER_TOKEN },
        body: {
          conversationId: 'conv-1',
          questionId: 'q-1',
          prompt: '请选择',
          // options / allowCustom / allowMultiple 都缺省
        },
      })
      expect(res.statusCode).toBe(200)
      const [, , callMerge] = mockPatchConversationMetadata.mock.calls[0]!
      expect(callMerge).toEqual({
        pendingQuestion: {
          questionId: 'q-1',
          prompt: '请选择',
          options: [],
          allowCustom: false,
          allowMultiple: false,
        },
      })
    })
  })

  // ===========================================================================
  // POST /chat/answer(P2 增强:fire-and-forget 持久化 + WS 广播)
  // ===========================================================================
  describe('POST /api/ai/chat/answer — P2 多端同步增强', () => {
    it('无 Authorization header → 401', async () => {
      mockVerifyAccessToken.mockReset()
      const restoreFetch = mockAIServiceSSE()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
          },
        })
        expect(res.statusCode).toBe(401)
        expect(mockCreateMessage).not.toHaveBeenCalled()
        expect(pushSpy).not.toHaveBeenCalled()
      } finally {
        restoreFetch()
      }
    })

    it('缺 questionId → 400(Zod 校验)', async () => {
      mockUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/answer',
        headers: { authorization: USER_TOKEN },
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          model: 'gpt-4o',
          answer: '选项A',
          // questionId 缺失
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('缺 answer → 400(Zod 校验)', async () => {
      mockUser()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/answer',
        headers: { authorization: USER_TOKEN },
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          model: 'gpt-4o',
          questionId: 'q-1',
          // answer 缺失
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('无 metadata.conversationId → 不触发持久化(兼容旧调用方)', async () => {
      mockUser()
      const restoreFetch = mockAIServiceSSE()
      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
            // 无 metadata
          },
        })
        expect(res.statusCode).toBe(200)
        // 无 conversationId 时跳过 P2 持久化(避免对不存在对话写 DB)
        expect(mockCreateMessage).not.toHaveBeenCalled()
        expect(mockPatchConversationMetadata).not.toHaveBeenCalled()
        expect(pushSpy).not.toHaveBeenCalled()
      } finally {
        restoreFetch()
      }
    })

    it('正常流程 → SSE 200 + fire-and-forget 持久化 answer + 清挂起 + WS 广播 2 次', async () => {
      mockUser()
      const restoreFetch = mockAIServiceSSE()
      const savedAnswer = {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: '选项A',
        metadata: { questionId: 'q-1', isAnswer: true },
        createdAt: new Date('2026-07-21T10:00:00Z'),
      }
      mockCreateMessage.mockResolvedValue(savedAnswer)
      mockPatchConversationMetadata.mockResolvedValue({
        id: 'conv-1',
        userId: USER_ID,
        metadata: { pendingQuestion: null, answeredQuestionId: 'q-1' },
      })

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
            metadata: {
              conversationId: 'conv-1',
              userId: USER_ID,
            },
          },
        })
        expect(res.statusCode).toBe(200)

        // fire-and-forget 是 void async,需要等一个 microtask 让 IIFE 完成
        await new Promise((r) => setTimeout(r, 50))

        // 1. createMessage 持久化 answer(metadata 标记 questionId + isAnswer)
        expect(mockCreateMessage).toHaveBeenCalledTimes(1)
        const [createInput] = mockCreateMessage.mock.calls[0]!
        expect(createInput).toEqual({
          conversationId: 'conv-1',
          role: 'user',
          content: '选项A',
          metadata: { questionId: 'q-1', isAnswer: true },
        })

        // 2. patchConversationMetadata 清挂起(merge 模式,不动其他 key)
        expect(mockPatchConversationMetadata).toHaveBeenCalledTimes(1)
        const [patchId, patchUserId, patchMerge] =
          mockPatchConversationMetadata.mock.calls[0]!
        expect(patchId).toBe('conv-1')
        expect(patchUserId).toBe(USER_ID)
        expect(patchMerge).toEqual({
          pendingQuestion: null,
          answeredQuestionId: 'q-1',
        })

        // 3. WS 广播 2 次:chat_message + chat_question_answered
        expect(pushSpy).toHaveBeenCalledTimes(2)
        const [push1UserId, push1Payload] = pushSpy.mock.calls[0]!
        expect(push1UserId).toBe(USER_ID)
        expect(push1Payload).toEqual({
          type: 'chat_message',
          conversationId: 'conv-1',
          message: savedAnswer,
        })
        const [push2UserId, push2Payload] = pushSpy.mock.calls[1]!
        expect(push2UserId).toBe(USER_ID)
        expect(push2Payload).toEqual({
          type: 'chat_question_answered',
          conversationId: 'conv-1',
          questionId: 'q-1',
        })
      } finally {
        restoreFetch()
      }
    })

    it('createMessage 持久化失败 → 不阻塞 SSE 流(fire-and-forget 容错)', async () => {
      mockUser()
      const restoreFetch = mockAIServiceSSE()
      mockCreateMessage.mockRejectedValue(new Error('DB connection lost'))
      // patchConversationMetadata 不应被调到(createMessage 先抛)
      mockPatchConversationMetadata.mockResolvedValue({
        id: 'conv-1',
        userId: USER_ID,
        metadata: {},
      })

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
            metadata: {
              conversationId: 'conv-1',
              userId: USER_ID,
            },
          },
        })
        // SSE 流仍正常返回 200(持久化失败不阻塞)
        expect(res.statusCode).toBe(200)

        await new Promise((r) => setTimeout(r, 50))

        // createMessage 被调到但失败
        expect(mockCreateMessage).toHaveBeenCalledTimes(1)
        // patchConversationMetadata 因 createMessage 抛错而未执行(catch 块吞掉)
        expect(mockPatchConversationMetadata).not.toHaveBeenCalled()
        // WS 广播也未执行(因持久化失败,无 message 可推)
        expect(pushSpy).not.toHaveBeenCalled()
      } finally {
        restoreFetch()
      }
    })

    it('patchConversationMetadata 失败 → WS 广播不执行(因 catch 块吞掉)', async () => {
      mockUser()
      const restoreFetch = mockAIServiceSSE()
      mockCreateMessage.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: '选项A',
        metadata: {},
        createdAt: new Date(),
      })
      mockPatchConversationMetadata.mockRejectedValue(new Error('DB write conflict'))

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
            metadata: {
              conversationId: 'conv-1',
              userId: USER_ID,
            },
          },
        })
        expect(res.statusCode).toBe(200)

        await new Promise((r) => setTimeout(r, 50))

        expect(mockCreateMessage).toHaveBeenCalledTimes(1)
        expect(mockPatchConversationMetadata).toHaveBeenCalledTimes(1)
        // patchConversationMetadata 抛错后,后续 WS 广播不执行(同一 try 块)
        expect(pushSpy).not.toHaveBeenCalled()
      } finally {
        restoreFetch()
      }
    })

    it('pushNotification 抛错 → 不影响响应(push 内层 try/catch 兜底)', async () => {
      mockUser()
      const restoreFetch = mockAIServiceSSE()
      mockCreateMessage.mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'user',
        content: '选项A',
        metadata: {},
        createdAt: new Date(),
      })
      mockPatchConversationMetadata.mockResolvedValue({
        id: 'conv-1',
        userId: USER_ID,
        metadata: {},
      })

      // pushSpy 第一次抛错(push chat_message),第二次正常(push chat_question_answered)
      pushSpy.mockImplementationOnce(() => {
        throw new Error('Redis Pub/Sub down')
      })

      try {
        const res = await server.inject({
          method: 'POST',
          url: '/api/ai/chat/answer',
          headers: { authorization: USER_TOKEN },
          body: {
            messages: [{ role: 'user', content: 'hi' }],
            model: 'gpt-4o',
            questionId: 'q-1',
            answer: '选项A',
            metadata: {
              conversationId: 'conv-1',
              userId: USER_ID,
            },
          },
        })
        // SSE 仍 200(内层 try/catch 吞掉 push 错误)
        expect(res.statusCode).toBe(200)

        await new Promise((r) => setTimeout(r, 50))

        // 持久化仍执行成功(不受 push 失败影响)
        expect(mockCreateMessage).toHaveBeenCalledTimes(1)
        expect(mockPatchConversationMetadata).toHaveBeenCalledTimes(1)
        // push 第一次抛错被 catch 吞掉(try/catch 块级,第二次 push 不执行)
        // 但 SSE 响应不受影响(200),证明 push 失败不阻塞主流程
        expect(pushSpy).toHaveBeenCalledTimes(1)
      } finally {
        restoreFetch()
      }
    })
  })
})
