// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-04 / F-06(legacy-ask、agent-creation)已由 fix/api-p0-1108 覆盖,本分支不保留对应夹具。
 *
 * F-03 回归(2026-11-08):/chat/stream 与 /chat/answer 的 metadata.conversationId
 * 只当"要操作哪个会话"的坐标,归属必须服务端查;不属于当前用户一律 404,
 * 不得进入 replaceMessages / createMessage / patchConversationMetadata 等写路径。
 *
 * 改前必红口径:认证态 USER_A,metadata.conversationId 指向 USER_B 的会话;
 * 旧实现无归属校验 → 200 且 replaceMessages 被调用;新实现 404 且零写调用。
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
  findMessageById: vi.fn(),
  patchConversationMetadata: vi.fn(),
  createMessage: vi.fn(),
  replaceMessages: vi.fn(),
  getUserBudgetUsage: vi.fn(),
  bindConversationWorkspace: vi.fn(),
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
  findMessageById: mocks.findMessageById,
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

import { aiChatStreamRoutes } from '../ai-chat-stream.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_B = 'cccccccc-3333-4333-8333-333333333333'
const MSG = 'eeeeeeee-5555-4555-8555-555555555555'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function sseResponse(): Response {
  return new Response('data: {"type":"done"}\n\n', {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  app.decorate('aiCost', { getUserBudgetUsage: mocks.getUserBudgetUsage })
  app.decorate('pushNotification', vi.fn())
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
  mocks.aiServiceFetchStream.mockImplementation(async () => sseResponse())
  mocks.findMessageById.mockResolvedValue(null)
  mocks.patchConversationMetadata.mockResolvedValue(undefined)
  mocks.createMessage.mockResolvedValue({ id: MSG })
  mocks.replaceMessages.mockResolvedValue(undefined)
  mocks.bindConversationWorkspace.mockResolvedValue(undefined)
})

describe('F-03 会话归属以服务端查询为准', () => {
  it('stream:他人会话 → 404 且不触发任何会话写路径', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        metadata: { conversationId: CONV_B, messageId: MSG, userId: USER_A },
      },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.replaceMessages).not.toHaveBeenCalled()
    expect(mocks.bindConversationWorkspace).not.toHaveBeenCalled()
    expect(mocks.aiServiceFetchStream).not.toHaveBeenCalled()
  })

  it('answer:他人会话 → 404 且不落库/不推送', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_B })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/answer',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        questionId: 'q-1',
        answer: 'yes',
        metadata: { conversationId: CONV_B, messageId: MSG, userId: USER_A },
      },
    })

    expect(res.statusCode).toBe(404)
    expect(mocks.createMessage).not.toHaveBeenCalled()
    expect(mocks.patchConversationMetadata).not.toHaveBeenCalled()
  })

  it('本人会话仍可正常流式(防过度拦截)', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV_B, userId: USER_A })

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        metadata: { conversationId: CONV_B, messageId: MSG, userId: USER_A },
      },
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.aiServiceFetchStream).toHaveBeenCalled()
  })
})
