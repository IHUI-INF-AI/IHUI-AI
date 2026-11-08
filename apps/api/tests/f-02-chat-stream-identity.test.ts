// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-02 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 缺陷:`/api/chat/stream` 与 `/api/chat/resume` 采信客户端 `metadata.userId`,
 * 知识库/仓库 wiki 读取、模型准入、token 预算全部按攻击者自报的受害者身份执行。
 *
 * 判据(不只返回码):伪造 `metadata.userId = 受害者` 后,
 * **所有下游调用点收到的身份必须是认证主体(攻击者本人)**,受害者 id 一次都不得
 * 触达下游(知识库读 / wiki 读 / 模型准入 / 预算查询 / 上游 ai-service 的 metadata)。
 */
import { describe, it, expect, afterAll, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const ATTACKER = '00000000-0000-4000-8000-0000000000aa'
const VICTIM = '00000000-0000-4000-8000-0000000000bb'

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
vi.mock('../src/config/index.js', () => ({
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
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, compressContextIfNeeded: vi.fn() }
})

const { mockFindConversationById } = vi.hoisted(() => ({
  mockFindConversationById: vi.fn(),
}))
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: mockFindConversationById,
  findMessageById: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(),
  favoriteConversationsBatch: vi.fn(),
  unfavoriteConversationsBatch: vi.fn(),
  setConversationsArchivedBatch: vi.fn(),
  findMessages: vi.fn(),
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
  bindConversationWorkspace: vi.fn().mockResolvedValue(undefined),
  setConversationAdditionalDirectories: vi.fn(),
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: vi.fn() }))
vi.mock('../src/utils/conversation-archive.js', () => ({
  persistMessageArchive: vi.fn().mockResolvedValue(undefined),
}))

// 下游四个身份消费点:全部落 spy,断言"只收到认证主体"
const spies = vi.hoisted(() => ({
  wiki: vi.fn(),
  knowledge: vi.fn(),
  admission: vi.fn(),
  budget: vi.fn(),
}))
vi.mock('../src/services/repo-wiki-context.js', () => ({ loadRepoWikiContext: spies.wiki }))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: spies.knowledge,
}))
vi.mock('../src/services/org-policy-service.js', () => ({
  guardModelAdmission: spies.admission,
}))

vi.mock('@ihui/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
    redactSecrets: vi.fn((s: string) => s),
    redactUserHomePathLiterals: vi.fn((s: string) => s),
  }
})

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'
import { chatResumeRoutes } from '../src/routes/chat-resume.js'

const USER_TOKEN = 'Bearer user-token'
const UPSTREAM_SSE = [
  `data: ${JSON.stringify({ type: 'chunk', content: 'ok' })}\n\n`,
  `data: ${JSON.stringify({ type: 'done' })}\n\n`,
].join('')

let fetchCalls: Array<{ url: string; body?: string }> = []
const originalFetch = globalThis.fetch

function mockAIServiceSSE() {
  fetchCalls = []
  globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), body: init?.body as string | undefined })
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
}

function makeServer() {
  const server = Fastify({ logger: false })
  ;(server as unknown as { decorate: (k: string, v: unknown) => void }).decorate('aiCost', {
    getUserBudgetUsage: spies.budget,
  })
  return server
}

describe('F-02 /chat/stream 身份只认认证主体', () => {
  const server = makeServer()

  beforeAll(async () => {
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  afterEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = originalFetch
  })

  it('伪造 metadata.userId → 下游四个身份消费点收到的都是攻击者本人,受害者 id 零触达', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      userId: ATTACKER,
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    })
    spies.wiki.mockResolvedValue(null)
    spies.knowledge.mockResolvedValue(null)
    spies.admission.mockResolvedValue(null)
    spies.budget.mockResolvedValue(null)
    mockAIServiceSSE()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: { authorization: USER_TOKEN },
      body: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
        knowledgeContext: true,
        repoName: 'demo/repo',
        metadata: {
          userId: VICTIM, // 攻击者自报受害者身份
          conversationId: '11111111-1111-4111-8111-111111111111',
          messageId: '22222222-2222-4222-8222-222222222222',
        },
      },
    })
    expect(res.statusCode, res.body).toBe(200)

    // 四个下游点都真的被调用(证明测的是实际路径,不是空转)
    expect(spies.wiki).toHaveBeenCalled()
    expect(spies.knowledge).toHaveBeenCalled()
    expect(spies.admission).toHaveBeenCalled()
    expect(spies.budget).toHaveBeenCalled()

    // 证人:每个下游点收到的身份都是攻击者本人
    expect(spies.wiki).toHaveBeenCalledWith(ATTACKER, 'demo/repo')
    expect(spies.knowledge).toHaveBeenCalledWith(ATTACKER, 'hi')
    expect(spies.admission).toHaveBeenCalledWith(ATTACKER, 'gpt-4o')
    expect(spies.budget).toHaveBeenCalledWith(ATTACKER, 'gpt-4o')

    // 受害者 id 一次都没有触达任何下游(含上游 ai-service 的 metadata)
    for (const spy of [spies.wiki, spies.knowledge, spies.admission, spies.budget]) {
      expect(spy.mock.calls.flat()).not.toContain(VICTIM)
    }
    const upstreamBody = JSON.parse(fetchCalls[0]!.body!) as {
      metadata?: { userId?: string }
    }
    expect(upstreamBody.metadata?.userId).toBe(ATTACKER)
    expect(fetchCalls[0]!.body).not.toContain(VICTIM)
  })
})

describe('F-02 /chat/resume 身份只认认证主体', () => {
  const server = makeServer()

  beforeAll(async () => {
    await server.register(chatResumeRoutes, { prefix: '/api/ai' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  afterEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = originalFetch
  })

  it('伪造 metadata.userId → wiki 读与上游 metadata 都只带攻击者身份', async () => {
    const conversationId = '33333333-3333-4333-8333-333333333333'
    mockVerifyAccessToken.mockResolvedValue({
      userId: ATTACKER,
      phone: '13800000001',
      familyId: '00000000-0000-4000-8000-000000000002',
      roleId: 0,
    })
    // 会话属于攻击者本人(归属校验通过,进入续流分支)
    mockFindConversationById.mockResolvedValue({ id: conversationId, userId: ATTACKER })
    spies.wiki.mockResolvedValue(null)
    mockAIServiceSSE()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/resume',
      headers: { authorization: USER_TOKEN },
      body: {
        conversationId,
        messageId: '44444444-4444-4444-8444-444444444444',
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o',
        repoName: 'demo/repo',
        metadata: { userId: VICTIM },
      },
    })
    expect(res.statusCode, res.body).toBe(200)

    expect(spies.wiki).toHaveBeenCalledWith(ATTACKER, 'demo/repo')
    expect(spies.wiki.mock.calls.flat()).not.toContain(VICTIM)
    const upstreamBody = JSON.parse(fetchCalls[0]!.body!) as {
      metadata?: { userId?: string }
    }
    expect(upstreamBody.metadata?.userId).toBe(ATTACKER)
    expect(fetchCalls[0]!.body).not.toContain(VICTIM)
  })
})
