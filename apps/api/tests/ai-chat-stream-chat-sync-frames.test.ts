// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71 剩余缺口①(2026-10-31):SSE 生成腿的 chat-sync created / patched 帧回归。
 *
 * 钉五件事:
 *  ① 主对话正文(chunk)被聚合成 `message:created` + `message:patched`(kind='snapshot',
 *     全量自包含),且 created 恒排在第一个 patched 之前(端侧要先有行才能应用 snapshot);
 *  ② 流收尾 flush 尾巴:最后一帧内容 = 全部 chunk 拼接,终态帧排在所有 patched 之后;
 *  ③ reasoning 帧进帧的 `reasoning` 字段,不混进 content;子代理 chunk(agentId ≠ 本次绑定)
 *     不并入主消息(与 api-client onAgentDelta 分流同源);
 *  ④ 帧名/载荷走 @ihui/types 构造器(这里断言 type 与既有契约字面量同值,不抄第二份定义);
 *  ⑤ 降级流(无 metadata)与上游错误零帧 —— 参与门槛与终态帧同一把尺。
 *
 * harness 照 ai-chat-stream-terminal-frame.test.ts;广播面用假装饰器捕获入参
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

vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: vi.fn() }))
vi.mock('../src/utils/conversation-archive.js', () => ({
  persistMessageArchive: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/services/repo-wiki-context.js', () => ({
  loadRepoWikiContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
  redactSecrets: vi.fn((s: string) => s),
  redactUserHomePaths: vi.fn((s: string) => s),
  redactUserHomePathLiterals: vi.fn((s: string) => s),
}))

import {
  aiChatStreamRoutes,
  CHAT_SYNC_STREAM_FRAME_MIN_CHARS,
} from '../src/routes/ai-chat-stream.js'
import { CHAT_SYNC_EVENT_NAMES } from '@ihui/types'

const USER_TOKEN = 'Bearer user-token'

type CapturedFrame =
  | { kind: 'created'; input: Record<string, unknown> }
  | { kind: 'patched'; input: Record<string, unknown> }
  | { kind: 'terminal'; input: Record<string, unknown> }

/** 帧到达的时间线(created/patched/terminal 混排,用于断言先后) */
let timeline: CapturedFrame[] = []

function mockUser(): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId: USER_ID,
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
}

function mockAIServiceSSE(frames: string[], finishReason = 'stop'): () => void {
  const originalFetch = globalThis.fetch
  const body = [
    ...frames.map((f) => `data: ${f}\n\n`),
    `data: ${JSON.stringify({ type: 'done', finishReason })}\n\n`,
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

async function injectStream(
  server: ReturnType<typeof Fastify>,
  metadata?: { conversationId: string; messageId: string; userId: string },
  agentId?: string,
): Promise<void> {
  const res = await server.inject({
    method: 'POST',
    url: '/api/ai/chat/stream',
    headers: { authorization: USER_TOKEN },
    body: {
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
      ...(agentId ? { agentId } : {}),
      ...(metadata ? { metadata } : {}),
    },
  })
  expect(res.statusCode, res.body).toBe(200)
  // 帧链是 fire-and-forget 的 Promise 序列(rev 分配逐帧串行):多给几轮微任务+宏任务。
  await new Promise((resolve) => setTimeout(resolve, 30))
}

describe('B02 缺口①:SSE 生成腿的 created / patched 帧', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.decorate(
      'broadcastChatMessageCreated',
      (input: Record<string, unknown>): Record<string, unknown> => {
        timeline.push({ kind: 'created', input })
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    server.decorate(
      'broadcastChatMessagePatched',
      async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
        timeline.push({ kind: 'patched', input })
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    server.decorate(
      'broadcastChatMessageTerminal',
      async (input: Record<string, unknown>): Promise<Record<string, unknown>> => {
        timeline.push({ kind: 'terminal', input })
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    timeline = []
    vi.restoreAllMocks()
  })

  const coords = { conversationId: CONV_ID, messageId: MESSAGE_ID, userId: USER_ID }

  it('① 短内容:created 先于 patched,收尾 flush 出全量 snapshot,终态排在最后', async () => {
    mockUser()
    const restore = mockAIServiceSSE([
      JSON.stringify({ type: 'chunk', content: '你好' }),
      JSON.stringify({ type: 'chunk', content: '，世界' }),
    ])
    try {
      await injectStream(server, coords)
      expect(timeline.map((f) => f.kind)).toEqual(['created', 'patched', 'terminal'])
      const created = timeline[0]!
      expect(created.input).toMatchObject({
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        memberUserIds: [USER_ID],
        role: 'assistant',
      })
      const patched = timeline[1]!
      expect(patched.input).toMatchObject({
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        kind: 'snapshot',
        content: '你好，世界',
      })
      expect(timeline[2]!.input).toMatchObject({ messageId: MESSAGE_ID, reason: 'stop' })
    } finally {
      restore()
    }
  })

  it('② 跨阈值:中途发帧且末帧 = 全部内容(单调增长,无信息丢失)', async () => {
    mockUser()
    const seg = 'x'.repeat(Math.ceil(CHAT_SYNC_STREAM_FRAME_MIN_CHARS / 2))
    const restore = mockAIServiceSSE([
      JSON.stringify({ type: 'chunk', content: seg }),
      JSON.stringify({ type: 'chunk', content: seg }),
      JSON.stringify({ type: 'chunk', content: '尾巴' }),
    ])
    try {
      await injectStream(server, coords)
      const patched = timeline.filter((f) => f.kind === 'patched')
      // 至少一帧中途 + 一帧收尾;非末帧也必须是全量(自包含判据)
      expect(patched.length).toBeGreaterThanOrEqual(2)
      const contents = patched.map((f) => String((f.input as { content?: unknown }).content))
      expect(contents[contents.length - 1]).toBe(seg + seg + '尾巴')
      for (let i = 1; i < contents.length; i += 1) {
        expect(contents[i]!.startsWith(contents[i - 1]!)).toBe(true)
      }
    } finally {
      restore()
    }
  })

  it('③ reasoning 单列一维;子代理 chunk(agentId 非本次绑定)不并入主消息;persona 回贴照常采集', async () => {
    mockUser()
    const restore = mockAIServiceSSE([
      JSON.stringify({ type: 'reasoning', content: '先想一想' }),
      JSON.stringify({ type: 'chunk', content: '子代理正文', agentId: 'sub-agent-1' }),
      // persona 场景:网关把回包 agentId 回贴为所选 persona(=本次绑定的 agentId)
      JSON.stringify({ type: 'chunk', content: '主', agentId: 'persona-1' }),
    ])
    try {
      await injectStream(server, coords, 'persona-1')
      const patched = timeline.filter((f) => f.kind === 'patched')
      const last = patched[patched.length - 1]!.input as { content?: unknown; reasoning?: unknown }
      expect(String(last.content)).toBe('主')
      expect(String(last.reasoning)).toBe('先想一想')
    } finally {
      restore()
    }
  })

  it('④ 帧名与契约同值(不另写同值常量)', async () => {
    // 发射器内部走 @ihui/types 构造器;这里把三枚事件名与契约常量逐字对齐一次,
    // 防未来"路由侧手拼字符串"漂移。
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED).toBe('message:created')
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED).toBe('message:patched')
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL).toBe('message:terminal')
  })

  it('⑤ 降级流(无 metadata)⇒ 零帧(参与门槛与终态帧同尺)', async () => {
    mockUser()
    const restore = mockAIServiceSSE([JSON.stringify({ type: 'chunk', content: 'hi' })])
    try {
      await injectStream(server)
      expect(timeline).toEqual([])
    } finally {
      restore()
    }
  })

  it('⑥ 上游 HTTP 错误 ⇒ 无 created(没内容不发初面),只发终态 error', async () => {
    mockUser()
    const restore = mockAIServiceUpstreamError()
    try {
      await injectStream(server, coords)
      expect(timeline.map((f) => f.kind)).toEqual(['terminal'])
      expect(timeline[0]!.input).toMatchObject({ reason: 'error' })
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
