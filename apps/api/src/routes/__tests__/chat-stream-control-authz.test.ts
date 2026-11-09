// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-03 同链路回归(2026-11-08):/chat/abort、/chat/steer、/chat/steer/withdraw 的
 * conversationId 只当"要操作哪个会话"的坐标,归属必须服务端查;越权一律 404,
 * 不得中止他人流、不得把引导文本注入他人会话、不得撤他人队列条目。
 *
 * 改前必红口径:认证态 USER_A,conversationId 指向 USER_B 的会话;
 * 旧实现无归属校验 → 直接 abort 命中 / 打到上游;新实现 404 且零副作用。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  guardModelAdmission: vi.fn(),
  loadRepoWikiContext: vi.fn(),
  loadKnowledgeContext: vi.fn(),
  aiServiceFetch: vi.fn(),
  aiServiceFetchStream: vi.fn(),
  findConversationById: vi.fn(),
  patchConversationMetadata: vi.fn(),
  createMessage: vi.fn(),
  replaceMessages: vi.fn(),
  bindConversationWorkspace: vi.fn(),
  getUserBudgetUsage: vi.fn(),
  abortConversationStreams: vi.fn(),
  findSession: vi.fn(),
}))

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../../plugins/auth.js', () => ({ checkAuth: mocks.checkAuth }))

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
}))

vi.mock('../../db/chat-queries.js', () => ({
  bindConversationWorkspace: mocks.bindConversationWorkspace,
  createMessage: mocks.createMessage,
  findConversationById: mocks.findConversationById,
  findMessageById: vi.fn().mockResolvedValue(null),
  patchConversationMetadata: mocks.patchConversationMetadata,
  replaceMessages: mocks.replaceMessages,
  setConversationAdditionalDirectories: vi.fn(),
}))

vi.mock('../../services/org-policy-service.js', () => ({
  guardModelAdmission: mocks.guardModelAdmission,
}))

vi.mock('../../services/repo-wiki-context.js', () => ({
  loadRepoWikiContext: mocks.loadRepoWikiContext,
}))

vi.mock('../../services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: mocks.loadKnowledgeContext,
}))

vi.mock('../../services/chat-ledger-store.js', () => ({
  recordBudgetStop: vi.fn(),
  recordContextLedger: vi.fn(),
  recordCompactionBoundary: vi.fn(),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mocks.aiServiceFetch,
  aiServiceFetchStream: mocks.aiServiceFetchStream,
}))

vi.mock('../../utils/conversation-archive.js', () => ({
  persistMessageArchive: vi.fn(),
}))

vi.mock('../../utils/sse-stream-registry.js', () => ({
  abortConversationStreams: mocks.abortConversationStreams,
  findSession: mocks.findSession,
  createSession: vi.fn(),
  detachOnClose: vi.fn(),
  emitEvent: vi.fn(),
  emitNamedEvent: vi.fn(),
  emitUpstreamLine: vi.fn(),
  finishSession: vi.fn(),
  getReplayEvents: vi.fn().mockResolvedValue([]),
  startHeartbeat: vi.fn(),
  takeoverStream: vi.fn(),
  waitForReplayHeadroom: vi.fn().mockResolvedValue(true),
}))

import { aiChatStreamRoutes } from '../ai-chat-stream.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_A = 'cccccccc-3333-4333-8333-333333333333'
const CONV_B = 'dddddddd-4444-4444-8444-444444444444'
const MSG = 'eeeeeeee-5555-4555-8555-555555555555'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  app.decorate('aiCost', {
    checkBudget: vi.fn(),
    getUserBudgetUsage: mocks.getUserBudgetUsage,
    record: vi.fn(),
    getCached: vi.fn(),
    getCachedAsync: vi.fn(),
    setCached: vi.fn(),
    cachedStreamWrapper: vi.fn(),
  })
  app.decorate('pushNotification', (_userId: string, _payload: unknown) => {})
  await app.register(aiChatStreamRoutes, { prefix: '/api/ai' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = USER_A
    return true
  })
  mocks.guardModelAdmission.mockResolvedValue(null)
  mocks.loadRepoWikiContext.mockResolvedValue(null)
  mocks.loadKnowledgeContext.mockResolvedValue(null)
  mocks.getUserBudgetUsage.mockResolvedValue(null)
  mocks.patchConversationMetadata.mockResolvedValue(undefined)
  mocks.bindConversationWorkspace.mockResolvedValue(undefined)
  mocks.createMessage.mockResolvedValue({ id: MSG })
  mocks.replaceMessages.mockResolvedValue(undefined)
  mocks.abortConversationStreams.mockReturnValue(1)
  mocks.findSession.mockReturnValue({
    finished: false,
    upstreamSessionId: 'upstream-sess-1',
  })
  mocks.aiServiceFetch.mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
})

describe('F-03 同链路:流控制端点以服务端会话归属为准', () => {
  it('abort:他人会话 → 404 且不中止任何流/不清挂起提问', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/abort',
      headers: AUTH_HEADERS,
      payload: { conversationId: CONV_B, messageId: MSG },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.abortConversationStreams).not.toHaveBeenCalled()
    expect(mocks.patchConversationMetadata).not.toHaveBeenCalled()
  })

  it('steer:他人会话 → 404 且不反查流/不打到上游', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/steer',
      headers: AUTH_HEADERS,
      payload: { conversationId: CONV_B, messageId: MSG, text: 'ignore previous' },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.findSession).not.toHaveBeenCalled()
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('steer/withdraw:他人会话 → 404 且不反查流/不打到上游', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/withdraw',
      headers: AUTH_HEADERS,
      payload: { conversationId: CONV_B, messageId: MSG, queuedAt: 1730000000000 },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.findSession).not.toHaveBeenCalled()
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('steer/reorder:他人会话 → 404 且不反查流/不打到上游', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/steer/reorder',
      headers: AUTH_HEADERS,
      payload: {
        conversationId: CONV_B,
        messageId: MSG,
        order: ['1730000000001', '1730000000000'],
      },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.findSession).not.toHaveBeenCalled()
    expect(mocks.aiServiceFetch).not.toHaveBeenCalled()
  })

  it('本人会话:abort 仍可正常中止(防过度拦截)', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_A, userId: USER_A })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/abort',
      headers: AUTH_HEADERS,
      payload: { conversationId: CONV_A, messageId: MSG },
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.abortConversationStreams).toHaveBeenCalledWith(CONV_A, MSG)
    expect(mocks.patchConversationMetadata).toHaveBeenCalledWith(CONV_A, USER_A, {
      pendingQuestion: null,
    })
  })

  it('本人会话:steer 仍可正常入队(防过度拦截)', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_A, userId: USER_A })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/steer',
      headers: AUTH_HEADERS,
      payload: { conversationId: CONV_A, messageId: MSG, text: '换个思路' },
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.findSession).toHaveBeenCalledWith(`${CONV_A}:${MSG}`)
    expect(mocks.aiServiceFetch).toHaveBeenCalled()
  })
})
