// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02「chat 多端/多标签实时同步」生产端终态切片(2026-10-26)。
 *
 * 钉三件事:SSE 流的三条终态出口(正常收尾 / 客户端中止 / 出错)各发一枚
 * `message:terminal`,且:
 *  ① 帧名与载荷由 @ihui/types 的构造器产出(路由不手拼字面量),reason 落在
 *     `packages/types/src/chat-sync-contract.ts` 的封闭集内;
 *  ② 正常收尾的 reason 由上游 done 帧的 finishReason 推导(stop / length),
 *     不是恒写 stop;
 *  ③ 缺 metadata(降级流)不发帧 —— 与 replayKey 同一条参与门槛。
 *
 * harness 照 ai-chat-stream-open-timing.test.ts;广播面用假装饰器捕获入参
 * (不 import ws-broadcast,不连库/Redis)。
 */
import { describe, it, expect, afterAll, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { USER_ID, CONV_ID, MESSAGE_ID } = vi.hoisted(() => ({
  USER_ID: '00000000-0000-4000-8000-000000000001',
  CONV_ID: 'cccccccc-3333-4333-8333-333333333333',
  MESSAGE_ID: 'dddddddd-4444-4444-8444-444444444444',
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

vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  bindConversationWorkspace: vi.fn(),
  setConversationAdditionalDirectories: vi.fn(),
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
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

const { mockRecordAiCost, mockPersistMessageArchive } = vi.hoisted(() => ({
  mockRecordAiCost: vi.fn(),
  mockPersistMessageArchive: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))
vi.mock('../src/utils/conversation-archive.js', () => ({
  persistMessageArchive: mockPersistMessageArchive,
}))
vi.mock('../src/services/repo-wiki-context.js', () => ({
  loadRepoWikiContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: vi.fn().mockResolvedValue(null),
}))
// 与既有 ai-chat-stream 测试同款:隔离 packages/shared 主入口的他席半致态。
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
  redactSecrets: vi.fn((s: string) => s),
  redactUserHomePathLiterals: vi.fn((s: string) => s),
}))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

const USER_TOKEN = 'Bearer user-token'

interface TerminalInput {
  conversationId: string
  memberUserIds: readonly string[]
  messageId: string
  reason: string
}

const terminalCalls: TerminalInput[] = []

function mockUser(): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_ID,
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
}

function mockAIServiceSSE(frames: string[], finishReason?: string): () => void {
  const originalFetch = globalThis.fetch
  const body = [
    ...frames,
    `data: ${JSON.stringify({
      type: 'done',
      ...(finishReason ? { finishReason } : {}),
    })}\n\n`,
  ].join('')
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body))
          controller.close()
        },
      }),
    }),
  ) as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

function mockAIServiceUpstreamError(): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 502,
      body: null,
      text: async () => '{"error":"upstream boom"}',
    }),
  ) as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

/** 上游读取抛 AbortError(= 客户端主动停止) */
function mockAIServiceAborted(): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: 'chunk' })}\n\n`),
          )
          controller.error(Object.assign(new Error('client aborted'), { name: 'AbortError' }))
        },
      }),
    }),
  ) as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

async function injectStream(
  server: ReturnType<typeof Fastify>,
  metadata?: { conversationId: string; messageId: string; userId: string },
): Promise<void> {
  const res = await server.inject({
    method: 'POST',
    url: '/api/ai/chat/stream',
    headers: { authorization: USER_TOKEN },
    body: {
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
      ...(metadata ? { metadata } : {}),
    },
  })
  expect(res.statusCode, res.body).toBe(200)
  // 终态广播在 finally 里 fire-and-forget;给它一个微任务窗口落地。
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('B02 生产端终态帧:SSE 三条收尾出口各发一枚 message:terminal', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.decorate('broadcastChatMessageTerminal', async (input: TerminalInput) => {
      terminalCalls.push(input)
      return {
        room: `conv:${input.conversationId}`,
        recipients: input.memberUserIds.length,
        matched: 0,
        delivered: 0,
        gated: 0,
      }
    })
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    terminalCalls.length = 0
    vi.restoreAllMocks()
  })

  it('① 正常收尾:done 帧 finishReason=stop ⇒ reason=stop,坐标与收件人是本次会话', async () => {
    mockUser()
    const restore = mockAIServiceSSE(['data: {"type":"chunk","content":"hi"}\n\n'], 'stop')
    try {
      await injectStream(server, {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      })
      expect(terminalCalls).toEqual([
        {
          conversationId: CONV_ID,
          memberUserIds: [USER_ID],
          messageId: MESSAGE_ID,
          reason: 'stop',
        },
      ])
    } finally {
      restore()
    }
  })

  it('② 截断收尾:finishReason=length ⇒ reason=length(不谎报成 stop)', async () => {
    mockUser()
    const restore = mockAIServiceSSE(['data: {"type":"chunk","content":"hi"}\n\n'], 'length')
    try {
      await injectStream(server, {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      })
      expect(terminalCalls.map((c) => c.reason)).toEqual(['length'])
    } finally {
      restore()
    }
  })

  it('③ 上游 HTTP 错误 ⇒ reason=error', async () => {
    mockUser()
    const restore = mockAIServiceUpstreamError()
    try {
      await injectStream(server, {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      })
      expect(terminalCalls.map((c) => c.reason)).toEqual(['error'])
    } finally {
      restore()
    }
  })

  it('④ 客户端中止(AbortError)⇒ reason=aborted', async () => {
    mockUser()
    const restore = mockAIServiceAborted()
    try {
      await injectStream(server, {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        userId: USER_ID,
      })
      expect(terminalCalls.map((c) => c.reason)).toEqual(['aborted'])
    } finally {
      restore()
    }
  })

  it('⑤ 降级流(无 metadata)不参与 chat-sync ⇒ 不发终态帧', async () => {
    mockUser()
    const restore = mockAIServiceSSE([], 'stop')
    try {
      await injectStream(server)
      expect(terminalCalls).toEqual([])
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
