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
import { describe, it, expect, afterAll, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { USER_ID, CONV_ID, MESSAGE_ID, callLog } = vi.hoisted(() => ({
  USER_ID: '00000000-0000-4000-8000-000000000001',
  CONV_ID: 'cccccccc-3333-4333-8333-333333333333',
  MESSAGE_ID: 'dddddddd-4444-4444-8444-444444444444',
  /** DB 写与广播的到达时序:顺序反了就是 FK 撞车 / resync 读到旧内容 */
  callLog: [] as string[],
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
  // 2026-11-11:生产 authenticateInner 已改 fail-closed —— getTokenBlacklist() 返回 null
  // 即判 token「已吊销」⇒ 401;测试环境 createBlacklist 内部 new IORedis 恒连不上 ⇒ null
  // ⇒ 合法 token 集体 401(基线存量红,未改动的 terminal-frame 测试同样 5/5 全 401)。
  // 覆盖为内存假黑名单(has 恒 false),与 routes/__tests__/ai-grading.test.ts 同型。
  // 不回退生产 fail-closed 语义。
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
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
  // G-20261114:流式占位行的建行/全量写回出口。桩只记时序,断言由各用例自己取。
  ensureChatSyncStreamMessage: vi.fn(async () => {
    callLog.push('ensure')
  }),
  writeChatSyncStreamSnapshot: vi.fn(async () => {
    callLog.push('write')
  }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  bindConversationWorkspace: vi.fn(),
  setConversationAdditionalDirectories: vi.fn(),
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  // F-03(2026-11-08):/chat/stream 写路径前先服务端核会话归属;本文件只造 CONV_ID,
  // 它属认证用户 ⇒ 归属通过。其余 id 一律 null(不存在/他人),留给负控。
  findConversationById: vi.fn(async (id: string) =>
    id === CONV_ID ? { id, userId: USER_ID } : null,
  ),
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
vi.mock('@ihui/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
    redactSecrets: vi.fn((s: string) => s),
    redactUserHomePaths: vi.fn((s: string) => s),
    redactUserHomePathLiterals: vi.fn((s: string) => s),
  }
})

import {
  aiChatStreamRoutes,
  CHAT_SYNC_STREAM_FRAME_MIN_CHARS,
} from '../src/routes/ai-chat-stream.js'
import * as chatQueries from '../src/db/chat-queries.js'
import { CHAT_SYNC_EVENT_NAMES } from '@ihui/types'
import type {
  ChatMessageCreatedBroadcastInput,
  ChatMessagePatchedBroadcastInput,
  ChatMessageTerminalBroadcastInput,
  ChatSyncBroadcastResult,
} from '../src/plugins/ws-broadcast.js'

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
      (input: ChatMessageCreatedBroadcastInput): ChatSyncBroadcastResult => {
        timeline.push({ kind: 'created', input: { ...input } })
        callLog.push('created')
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    server.decorate(
      'broadcastChatMessagePatched',
      async (input: ChatMessagePatchedBroadcastInput): Promise<ChatSyncBroadcastResult> => {
        timeline.push({ kind: 'patched', input: { ...input } })
        callLog.push('patched')
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    server.decorate(
      'broadcastChatMessageTerminal',
      async (input: ChatMessageTerminalBroadcastInput): Promise<ChatSyncBroadcastResult> => {
        timeline.push({ kind: 'terminal', input: { ...input } })
        return { room: 'conv:x', recipients: 1, matched: 0, delivered: 0, gated: 0 }
      },
    )
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    callLog.length = 0
    // 每例重挂时序桩(幂等;即便上一例改过实现也回到只记时序的形态)。
    vi.mocked(chatQueries.ensureChatSyncStreamMessage).mockImplementation(async () => {
      callLog.push('ensure')
    })
    vi.mocked(chatQueries.writeChatSyncStreamSnapshot).mockImplementation(async () => {
      callLog.push('write')
    })
  })

  afterEach(() => {
    timeline = []
    // clearAllMocks 只清调用记录、保留桩实现;原用 restoreAllMocks 会把
    // getUserStatus / createBlacklist 的 mockResolvedValue(1) / 工厂实现一并抹掉,
    // 第二个用例起就退化成 401。这里要的是"清记录",不是"拆桩"。
    vi.clearAllMocks()
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
      // G-20261114:每枚 snapshot 前幂等重发一次 created(带该帧全量内容),
      // 终态连发两枚。锁的是重发语义,不是把帧序列期望值加长。
      const created = timeline.filter((f) => f.kind === 'created')
      const patched = timeline.filter((f) => f.kind === 'patched')
      const terminal = timeline.filter((f) => f.kind === 'terminal')
      expect(timeline[0]!.kind).toBe('created')
      expect(timeline.at(-1)!.kind).toBe('terminal')
      expect(created).toHaveLength(patched.length + 1)
      expect(terminal).toHaveLength(2)
      expect(created[0]!.input).toMatchObject({
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        memberUserIds: [USER_ID],
        role: 'assistant',
      })
      // 重发 created 必须与紧随的 snapshot 全量正文逐字相同 ⇒ 迟到端一步补齐,
      // 不必等 resync(契约内核对「消息不存在」的 snapshot 一律判 gap)。
      expect(created[1]!.input).toMatchObject({ messageId: MESSAGE_ID, content: '你好，世界' })
      expect(patched[0]!.input).toMatchObject({
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        kind: 'snapshot',
        content: '你好，世界',
      })
      for (const t of terminal) {
        expect(t.input).toMatchObject({ messageId: MESSAGE_ID, reason: 'stop' })
      }
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

  it('⑥ 上游 HTTP 错误 ⇒ created(空初面)+ terminal(error) 成对,零 patched', async () => {
    mockUser()
    const restore = mockAIServiceUpstreamError()
    try {
      await injectStream(server, coords)
      // G-20261114:旧断言「无 created、只发终态」把漏洞当特性钉死 —— 无行时端侧
      // 收 terminal 判 gap → resync 404、账本无行 rev=0、worker 降级换第二个 uuid。
      // 现在错误路径也建行,三型帧同进同退,终态有权威坐标。
      expect(timeline.map((f) => f.kind)).toEqual(['created', 'terminal', 'terminal'])
      expect(timeline[0]!.input).toMatchObject({ messageId: MESSAGE_ID, content: '' })
      expect(timeline.filter((f) => f.kind === 'terminal').map((f) => f.input.reason)).toEqual([
        'error',
        'error',
      ])
      expect(chatQueries.ensureChatSyncStreamMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: MESSAGE_ID, conversationId: CONV_ID, content: '' }),
      )
      expect(chatQueries.writeChatSyncStreamSnapshot).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('⑦ 越权负控:伪造 metadata.userId ⇒ 三帧投递对象仍是认证身份,伪造收件人零帧', async () => {
    // 票71 越权纪律(2026-11-01):metadata.userId 是客户端可整写字段,曾经被
    // `opts.metadata?.userId ?? request.userId` 优先采纳 ⇒ 任何人可把携带会话消息全文的
    // 帧投递到任意在线用户连接。修复后投递对象只取承载层认证身份。
    // 正向对照:用例①(自报值 == 认证值)路径不变。
    const SPOOFED = '99999999-9999-4999-8999-999999999999'
    mockUser()
    const restore = mockAIServiceSSE([JSON.stringify({ type: 'chunk', content: '内容' })])
    try {
      await injectStream(server, {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        userId: SPOOFED,
      })
      // 副作用没发生:没有任何一帧投递给被伪造的收件人
      for (const frame of timeline) {
        const members = frame.input.memberUserIds as readonly string[]
        expect(members).not.toContain(SPOOFED)
      }
      // 三型帧都到达且全部落在认证身份上(重发 created 与双发 terminal 同样受越权门禁)
      expect(timeline[0]!.kind).toBe('created')
      expect(timeline.at(-1)!.kind).toBe('terminal')
      expect(timeline.filter((f) => f.kind === 'created').length).toBeGreaterThanOrEqual(1)
      expect(timeline.some((f) => f.kind === 'patched')).toBe(true)
      expect(timeline.filter((f) => f.kind === 'terminal')).toHaveLength(2)
      for (const frame of timeline) {
        expect(frame.input.memberUserIds).toEqual([USER_ID])
      }
    } finally {
      restore()
    }
  })

  // ── G-20261114 根因 1 回归:id 坐标系分裂 / FK 违例 / 流未落库 resync 404 ──

  it('⑧ 坐标统一:created 用广播同 id 建 DB 占位行,且带全量初面(零空气泡)', async () => {
    mockUser()
    const restore = mockAIServiceSSE([
      JSON.stringify({ type: 'chunk', content: '第一段' }),
      JSON.stringify({ type: 'chunk', content: '第二段' }),
    ])
    try {
      await injectStream(server, coords)
      const ensure = vi.mocked(chatQueries.ensureChatSyncStreamMessage)
      const write = vi.mocked(chatQueries.writeChatSyncStreamSnapshot)
      // 建行坐标 = 广播坐标 = 前端占位 UUID(不再由 PG defaultRandom 生成第二个 uuid)
      expect(ensure).toHaveBeenCalledTimes(1)
      expect(ensure.mock.calls[0]![0]).toMatchObject({
        id: MESSAGE_ID,
        conversationId: CONV_ID,
      })
      const created = timeline.find((f) => f.kind === 'created')!
      expect(created.input.content).toBe('第一段')
      // 帧与 DB 行同源同写:不允许"帧有内容、库里是空串"的空气泡窗口
      expect(ensure.mock.calls[0]![0].content).toBe(created.input.content)
      // 顺序铁律:先建行再广播 created;先全量写回再分配 rev/广播 patched
      expect(callLog.slice(0, 2)).toEqual(['ensure', 'created'])
      const firstWrite = callLog.indexOf('write')
      const firstPatched = callLog.indexOf('patched')
      expect(firstWrite).toBeGreaterThanOrEqual(0)
      expect(firstWrite).toBeLessThan(firstPatched)
      // 末次写回 = 链头全量 ⇒ gap-resync 拉到的就是端侧已显示的内容
      expect(write.mock.calls.at(-1)![0]).toMatchObject({
        id: MESSAGE_ID,
        conversationId: CONV_ID,
        content: '第一段第二段',
      })
    } finally {
      restore()
    }
  })

  it('⑨ 非法 metadata.messageId ⇒ 整条 chat-sync 腿降级,含终态零帧零 DB 写(fail-closed)', async () => {
    mockUser()
    const restore = mockAIServiceSSE([JSON.stringify({ type: 'chunk', content: '内容' })])
    try {
      // 任意字符串进 PG uuid 列会抛 22P02:created 腿在 catch 里静默丢帧,terminal 腿
      // 在 finally 的 fire-and-forget 里同样被吞。判据必须在两条腿共用的门槛前,
      // 不合法就整腿不参与 —— 含终态帧,零 DB 写。
      await injectStream(server, { ...coords, messageId: 'not-a-uuid' })
      expect(timeline).toEqual([])
      expect(chatQueries.ensureChatSyncStreamMessage).not.toHaveBeenCalled()
      expect(chatQueries.writeChatSyncStreamSnapshot).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('⑩ 零 delta 流 ⇒ created+terminal 成对(建占位行),零 patched / 零 snapshot 写回', async () => {
    mockUser()
    const restore = mockAIServiceSSE([])
    try {
      await injectStream(server, coords)
      // 反向牙:旧断言只量「不建行」,terminal 照发 ⇒ resync 404 / 账本 rev=0 /
      // worker 降级 createMessage 换第二个 uuid(根因 1 的旁路)。
      expect(timeline.map((f) => f.kind)).toEqual(['created', 'terminal', 'terminal'])
      expect(chatQueries.ensureChatSyncStreamMessage).toHaveBeenCalledTimes(1)
      expect(chatQueries.writeChatSyncStreamSnapshot).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('⑪ 反向牙:DB 占位腿失败 ⇒ created/patched/terminal 全不发,绝不发无权威坐标的帧', async () => {
    mockUser()
    vi.mocked(chatQueries.ensureChatSyncStreamMessage).mockRejectedValue(new Error('PG down'))
    const restore = mockAIServiceSSE([JSON.stringify({ type: 'chunk', content: '内容' })])
    try {
      await injectStream(server, coords)
      expect(timeline.filter((f) => f.kind === 'created')).toEqual([])
      expect(timeline.filter((f) => f.kind === 'patched')).toEqual([])
      // 三型帧同进同退:created 未落地 ⇒ terminal 也不发
      expect(timeline.filter((f) => f.kind === 'terminal')).toEqual([])
      // createdApplied=false 这道门禁压住了 patched ⇒ 连全量写回都不该尝试
      expect(chatQueries.writeChatSyncStreamSnapshot).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
