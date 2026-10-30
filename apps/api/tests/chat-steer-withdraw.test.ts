// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 差距③ Phase1 网关侧:POST /chat/steer/withdraw 转发路由(2026-10-30 立)。
 *
 * 与 /chat/steer 同姿势的两格必须锁死:
 * ① 寻址闸门:凭 replayKey = `conversationId:messageId` 反查活动流的 upstreamSessionId,
 *    反查不到(不存在/已结束/未启用 steer)⇒ 404 **且一次都不转发**(条目随流消亡,
 *    打到上游只会打空拳并把 404 语义搅浑);
 * ② 三态原样回传:{ok, status:'withdrawn'|'already_injected'|'not_found'} 是上游的结论,
 *    网关不判读、不折叠(撤回与 drain 的竞态"已注入则回报已注入"由上游单点判定)。
 *
 * Mock 策略:l7648-upstream-auth-outbound.test.ts 的路由注册面 + d141 的
 * aiServiceFetch 模块级 mock(直接断言转发路径与 body,比桩 global.fetch 更贴转发契约)。
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

// 插件级 preHandler 用 checkAuth;工厂补齐 authenticate/requireActiveUser 导出
// (缺导出会让具名 import 直接抛错,与 l7648 同一处置)。
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

/** 上游裸 JSON 响应(与 steer 转发面同款:resp.json() 直读) */
function upstreamJson(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as unknown as Response
}

type FetchCall = [unknown, string, { method?: string; body?: string }]

describe('POST /api/ai/chat/steer/withdraw(差距③ Phase1 网关侧)', () => {
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

  it('转发成功:反查命中 ⇒ 拼上游 steer/withdraw 路径,body 只带 queuedAt,三态原样回传', async () => {
    createSession(mockRaw(), new AbortController(), 'conv-w1:msg-w1', 'sess-w1')
    mockAiServiceFetch.mockResolvedValue(upstreamJson({ ok: true, status: 'withdrawn' }))

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/withdraw',
      payload: { conversationId: 'conv-w1', messageId: 'msg-w1', queuedAt: 1_730_000_000_000 },
    })

    expect(res.statusCode).toBe(200)
    expect(mockAiServiceFetch).toHaveBeenCalledTimes(1)
    const [, pathArg, initArg] = mockAiServiceFetch.mock.calls[0] as unknown as FetchCall
    expect(pathArg).toBe('/api/llm/complete/stream/sess-w1/steer/withdraw')
    expect(initArg.method).toBe('POST')
    // 定位键逐字转发:网关不加会话/消息字段、不改类型
    expect(JSON.parse(initArg.body ?? '{}')).toEqual({ queuedAt: 1_730_000_000_000 })
    expect(res.json()).toEqual({ ok: true, status: 'withdrawn' })
  })

  it('反查不到活动流 ⇒ 404(与 /chat/steer 同闸门),且一次都不转发', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/withdraw',
      payload: {
        conversationId: 'conv-nope',
        messageId: 'msg-nope',
        queuedAt: '2026-10-30T00:00:00Z',
      },
    })

    expect(res.statusCode).toBe(404)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })

  it('上游竞态结论原样回传:already_injected / not_found 不在网关折叠', async () => {
    createSession(mockRaw(), new AbortController(), 'conv-w2:msg-w2', 'sess-w2')
    mockAiServiceFetch.mockResolvedValue(
      upstreamJson({ ok: false, status: 'already_injected', reason: 'drained' }),
    )

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/withdraw',
      payload: { conversationId: 'conv-w2', messageId: 'msg-w2', queuedAt: 42 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: false, status: 'already_injected', reason: 'drained' })
  })

  it('缺 queuedAt ⇒ 400,不触上游', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/withdraw',
      payload: { conversationId: 'conv-w3', messageId: 'msg-w3' },
    })

    expect(res.statusCode).toBe(400)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })
})
