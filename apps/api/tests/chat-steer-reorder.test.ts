// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距③ mutateQueue 网关侧(2026-10-30 立):POST /chat/steer/reorder 转发路由。
 *
 * 与 /chat/steer/withdraw 同姿势的两格必须锁死:
 * ① 寻址闸门:凭 replayKey = `conversationId:messageId` 反查活动流的 upstreamSessionId,
 *    反查不到 ⇒ 404 且一次都不转发(队列随流消亡,打到上游只会打空拳);
 * ② 上游结论原样回传:{ok, queued, orderApplied} 与 422(覆盖不符)网关不判读、不折叠 ——
 *    竞态豁免(已 drain 条目出 order 校验、回报实际生效结果)由 ai-service 单点判定。
 *
 * Mock 策略:抄 chat-steer-withdraw.test.ts(路由注册面 + aiServiceFetch 模块级 mock)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'

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

vi.mock('jose', () => ({
  decodeJwt: () => ({}),
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuer() {
      return this
    }
    setAudience() {
      return this
    }
    setSubject() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    async sign() {
      return 'mock-system-access-token'
    }
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  requireActiveUser: vi.fn(),
  checkAuth: vi.fn(async () => true),
}))

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

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

const { mockRecordAiCost } = vi.hoisted(() => ({ mockRecordAiCost: vi.fn() }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))

const { mockAiServiceFetch } = vi.hoisted(() => ({ mockAiServiceFetch: vi.fn() }))
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: mockAiServiceFetch,
}))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'
import { createSession } from '../src/utils/sse-stream-registry.js'

function mockRaw(): FastifyReply['raw'] {
  return {
    write: () => true,
    end: () => {},
    get ended() {
      return false
    },
  } as unknown as FastifyReply['raw']
}

/** 上游裸 JSON 响应(与 withdraw 转发面同款:resp.json() 直读) */
function upstreamJson(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response
}

type FetchCall = [unknown, string, { method?: string; body?: string }]

describe('POST /api/ai/chat/steer/reorder(差距③ mutateQueue 网关侧)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('转发成功:反查命中 ⇒ 拼上游 steer/reorder 路径,body 只带 order,生效结果原样回传', async () => {
    createSession(mockRaw(), new AbortController(), 'conv-r1:msg-r1', 'sess-r1')
    mockAiServiceFetch.mockResolvedValue(
      upstreamJson({ ok: true, queued: 2, orderApplied: ['q2', 'q1'] }),
    )

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      payload: { conversationId: 'conv-r1', messageId: 'msg-r1', order: ['q2', 'q1'] },
    })

    expect(res.statusCode).toBe(200)
    expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
    const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
    expect(pathArg).toBe('/api/llm/complete/stream/sess-r1/steer/reorder')
    expect(initArg.method).toBe('POST')
    // 目标序列逐字转发:网关不排序、不去重、不加会话/消息字段
    expect(JSON.parse(initArg.body ?? '{}')).toEqual({ order: ['q2', 'q1'] })
    expect(res.json()).toEqual({ ok: true, queued: 2, orderApplied: ['q2', 'q1'] })
  })

  it('反查不到活动流 ⇒ 404(与 withdraw 同闸门),且一次都不转发', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      payload: { conversationId: 'conv-nope', messageId: 'msg-nope', order: ['q1'] },
    })

    expect(res.statusCode).toBe(404)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('上游 422(覆盖不符,不猜)原样回传,网关不折叠', async () => {
    createSession(mockRaw(), new AbortController(), 'conv-r2:msg-r2', 'sess-r2')
    mockAiServiceFetch.mockResolvedValue(
      upstreamJson({ ok: false, error: 'order must exactly cover all pending queue entries' }, 422),
    )

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      payload: { conversationId: 'conv-r2', messageId: 'msg-r2', order: ['q1'] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({
      ok: false,
      error: 'order must exactly cover all pending queue entries',
    })
  })

  it('缺 order / order 非字符串数组 ⇒ 400,不触上游', async () => {
    const missing = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      payload: { conversationId: 'conv-r3', messageId: 'msg-r3' },
    })
    expect(missing.statusCode).toBe(400)

    const badShape = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      payload: { conversationId: 'conv-r3', messageId: 'msg-r3', order: [123] },
    })
    expect(badShape.statusCode).toBe(400)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
