// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-02 信任边界回归(2026-11-08):chat/stream、chat/answer、chat/resume 一律以
 * 服务端会话身份(request.userId)为准;客户端 body 里的 metadata.userId 必须被丢弃,
 * 不得参与知识库/wiki 读取、模型准入、预算主体、上游透传或落库/推送归属。
 *
 * 改前必红口径:认证态为 USER_A、body 注入 metadata.userId=USER_B,旧实现会把
 * USER_B 传给 guardModelAdmission / loadRepoWikiContext / loadKnowledgeContext /
 * 上游 metadata / patchConversationMetadata / pushNotification。
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
  recordBudgetStop: vi.fn(),
  recordContextLedger: vi.fn(),
  recordCompactionBoundary: vi.fn(),
  getUserBudgetUsage: vi.fn(),
  pushNotification: vi.fn(),
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
  bindConversationWorkspace: vi.fn(),
  createMessage: mocks.createMessage,
  findConversationById: mocks.findConversationById,
  findMessageById: mocks.findMessageById,
  patchConversationMetadata: mocks.patchConversationMetadata,
  replaceMessages: vi.fn(),
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
  recordBudgetStop: mocks.recordBudgetStop,
  recordContextLedger: mocks.recordContextLedger,
  recordCompactionBoundary: mocks.recordCompactionBoundary,
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mocks.aiServiceFetch,
  aiServiceFetchStream: mocks.aiServiceFetchStream,
}))

vi.mock('../../utils/conversation-archive.js', () => ({
  persistMessageArchive: vi.fn(),
}))

import { aiChatStreamRoutes } from '../ai-chat-stream.js'
import { chatResumeRoutes } from '../chat-resume.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV = 'cccccccc-3333-4333-8333-333333333333'
const MSG = 'eeeeeeee-5555-4555-8555-555555555555'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function sseResponse(): Response {
  return new Response('data: {"type":"done"}\n\n', {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function upstreamBody(path: string): Record<string, unknown> {
  const call = mocks.aiServiceFetchStream.mock.calls.find((c) => c[1] === path)
  expect(call).toBeTruthy()
  return JSON.parse((call?.[2] as { body?: string }).body ?? '{}') as Record<string, unknown>
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  app.decorate('aiCost', { getUserBudgetUsage: mocks.getUserBudgetUsage })
  app.decorate('pushNotification', mocks.pushNotification)
  await app.register(aiChatStreamRoutes, { prefix: '/api/ai' })
  await app.register(chatResumeRoutes, { prefix: '/api/chat' })
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
  mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })
  mocks.findMessageById.mockResolvedValue(null)
  mocks.patchConversationMetadata.mockResolvedValue(undefined)
  mocks.createMessage.mockResolvedValue({ id: MSG })
  mocks.recordBudgetStop.mockResolvedValue(true)
  mocks.recordContextLedger.mockResolvedValue(true)
  mocks.recordCompactionBoundary.mockResolvedValue(true)
})

describe('F-02 /chat/stream 以服务端会话身份为准', () => {
  it('metadata.userId 伪造值不参与准入/wiki/知识库/预算/上游透传', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        metadata: { conversationId: CONV, messageId: MSG, userId: USER_B },
      },
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.guardModelAdmission).toHaveBeenCalledWith(USER_A, 'gpt-4o-mini')
    expect(mocks.loadRepoWikiContext).toHaveBeenCalledWith(USER_A, undefined)
    expect(mocks.loadKnowledgeContext).toHaveBeenCalledWith(USER_A, 'hi')
    expect(mocks.getUserBudgetUsage).toHaveBeenCalledWith(USER_A, 'gpt-4o-mini')

    const body = upstreamBody('/api/llm/complete/stream')
    expect((body.metadata as { userId?: string }).userId).toBe(USER_A)
    expect((body.metadata as { userId?: string }).userId).not.toBe(USER_B)
  })
})

describe('F-02 /chat/answer 以服务端会话身份为准', () => {
  it('落库归属与推送对象不采信 metadata.userId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/answer',
      headers: AUTH_HEADERS,
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        questionId: 'q-1',
        answer: 'yes',
        metadata: { conversationId: CONV, messageId: MSG, userId: USER_B },
      },
    })

    expect(res.statusCode).toBe(200)
    await vi.waitFor(() => {
      expect(mocks.patchConversationMetadata).toHaveBeenCalledWith(CONV, USER_A, expect.anything())
    })
    expect(mocks.pushNotification).toHaveBeenCalledWith(USER_A, expect.anything())
    expect(mocks.pushNotification).not.toHaveBeenCalledWith(USER_B, expect.anything())

    const body = upstreamBody('/api/llm/complete/stream')
    expect((body.metadata as { userId?: string }).userId).toBe(USER_A)
  })
})

describe('F-02 /chat/resume 以服务端会话身份为准', () => {
  it('续接 wiki 与上游 metadata 用认证主体', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/resume',
      headers: AUTH_HEADERS,
      payload: {
        conversationId: CONV,
        messageId: MSG,
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        repoName: 'demo/repo',
        metadata: { conversationId: CONV, messageId: MSG, userId: USER_B },
      },
    })

    expect(res.statusCode).toBe(200)
    expect(mocks.loadRepoWikiContext).toHaveBeenCalledWith(USER_A, 'demo/repo')
    const body = upstreamBody('/api/llm/complete/stream')
    expect((body.metadata as { userId?: string }).userId).toBe(USER_A)
  })
})
