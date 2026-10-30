// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 差距⑤(2026-10-30 立)网关侧路由面:GET /conversations/:id/history 的
 * `around=<turnOrdinal>&window=<n>` 居中窗口参数。
 *
 * 判的是路由层契约(窗口数学在 chat-queries.findHistoryTurnWindow,正反例见
 * chat-history-turn-window.test.ts,本文件把查询层整模块 mock 掉):
 * - around 命中 ⇒ 200,响应复用既有分页形状:hasMore/nextCursor 保持「向上翻」口径
 *   (旧客户端拿 direction:'older' + nextCursor 无缝续翻),向下断点经
 *   prevCursor/hasMoreAfter 表达(prevCursor 字段名与 B 路客户端对齐);
 *   cursor 均为 encodeHistoryCursor 编码。
 * - around **优先于** cursor/direction:同传时 findHistoryTurnPage 一律不被调用。
 * - 查询层回 null(turn 不存在)⇒ 404(明确语义,客户端降级开会话顶部)。
 * - around 非整数 ⇒ 400(zod coerce 在 fastify type:'string' querystring 之后判,G-261)。
 *
 * Mock 清单与 chat-history-projection.test.ts 同构(chat.ts 的导入面一一对应;
 * 缺导出 named import 为 undefined —— 本文件不触达那些 handler,与仓内既有纪律一致)。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockFindHistoryTurnPage,
  mockFindHistoryTurnWindow,
  mockFindConversationById,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindHistoryTurnPage: vi.fn(),
  mockFindHistoryTurnWindow: vi.fn(),
  mockFindConversationById: vi.fn(),
}))

vi.mock('../src/db/chat-queries.js', () => ({
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: mockFindConversationById,
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(),
  favoriteConversationsBatch: vi.fn(),
  unfavoriteConversationsBatch: vi.fn(),
  setConversationsArchivedBatch: vi.fn(),
  findMessages: vi.fn(),
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  rateChatMessage: vi.fn(),
  listMessageFeedbackRatings: vi.fn(async () => new Map()),
  clearChatMessageRating: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn(),
  findMessagesCursor: vi.fn(),
  encodeMessageCursor: vi.fn(),
  decodeMessageCursor: vi.fn(),
  findHistoryTurnPage: mockFindHistoryTurnPage,
  findHistoryTurnWindow: mockFindHistoryTurnWindow,
  encodeHistoryCursor: (c: { turnOrdinal: number }) =>
    Buffer.from(JSON.stringify(c), 'utf8').toString('base64url'),
  decodeHistoryCursor: (raw: string) => {
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
      if (parsed && typeof parsed === 'object' && Number.isInteger(parsed.turnOrdinal)) {
        return { turnOrdinal: parsed.turnOrdinal }
      }
    } catch {
      return null
    }
    return null
  },
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  editMessageAndTruncateAfter: vi.fn(),
  branchConversationFrom: vi.fn(),
  replaceMessages: vi.fn(),
  updateConversationTitle: vi.fn(),
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))
vi.mock('../src/utils/semantic-summary.js', () => ({
  generateSemanticSummary: vi.fn(),
  getCachedSemanticSummary: vi.fn(),
}))
vi.mock('../src/utils/conversation-title.js', () => ({
  generateConversationTitle: vi.fn(),
  DEFAULT: [],
}))
vi.mock('../src/utils/conversation-archive.js', () => ({
  listMessageArchives: vi.fn(),
  findMessageArchive: vi.fn(),
  persistMessageArchive: vi.fn(),
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceFetch: vi.fn() }))
vi.mock('../src/utils/proxy-dispatcher.js', () => ({ getProxyDispatcher: vi.fn() }))
vi.mock('@ihui/context-compaction', () => ({
  compressContextIfNeeded: vi.fn(),
  estimateMessagesTokens: vi.fn(),
}))

import { chatRoutes } from '../src/routes/chat.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'

function mockMsg(i: number, turnOrdinal: number) {
  return {
    id: `m${i}`,
    conversationId: CONV_ID,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `c${i}`,
    reasoning: null,
    tokens: null,
    metadata: {},
    createdAt: new Date(Date.UTC(2026, 0, 1) + i * 1000),
    turnOrdinal,
  }
}

function authAsOwner() {
  mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
    req.userId = 'user-1'
  })
  mockFindConversationById.mockResolvedValueOnce({
    id: CONV_ID,
    userId: 'user-1',
    historyProjectionState: null,
  })
}

const b64 = (turnOrdinal: number) =>
  Buffer.from(JSON.stringify({ turnOrdinal }), 'utf8').toString('base64url')

describe('GET /conversations/:id/history?around=(差距⑤ 居中窗口)', () => {
  let server: Awaited<ReturnType<typeof Fastify>>
  beforeAll(async () => {
    const app = Fastify()
    await app.register(chatRoutes)
    await app.ready()
    server = app
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('around 命中 → 200:双向 cursor 编码回传,hasMore/nextCursor 保持向上口径', async () => {
    authAsOwner()
    mockFindHistoryTurnWindow.mockResolvedValueOnce({
      turns: [
        { turnOrdinal: 2, messages: [mockMsg(2, 2)] },
        { turnOrdinal: 3, messages: [mockMsg(3, 3), mockMsg(4, 3)] },
        { turnOrdinal: 4, messages: [mockMsg(5, 4)] },
        { turnOrdinal: 5, messages: [mockMsg(6, 5)] },
        { turnOrdinal: 6, messages: [mockMsg(7, 6)] },
      ],
      hasMoreBefore: true,
      hasMoreAfter: true,
      beforeCursor: { turnOrdinal: 2 },
      afterCursor: { turnOrdinal: 6 },
    })
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { around: '4', window: '2' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data // success() 信封:{ code, message, data }
    expect(mockFindHistoryTurnWindow).toHaveBeenCalledWith(CONV_ID, { around: 4, window: 2 })
    expect(body.turns.map((t: { turnOrdinal: number }) => t.turnOrdinal)).toEqual([2, 3, 4, 5, 6])
    expect(body.around).toBe(4)
    expect(body.window).toBe(2)
    // 向上口径:旧客户端拿 nextCursor + direction:'older' 可无缝续翻(与分页形态兼容)
    expect(body.hasMore).toBe(true)
    expect(body.nextCursor).toBe(b64(2))
    expect(body.beforeCursor).toBe(b64(2))
    // 反向/更新方向断点字段名与 B 路客户端 prevCursor 对齐(2026-10-30 集成裁定)
    expect(body.prevCursor).toBe(b64(6))
    expect(body.hasMoreBefore).toBe(true)
    expect(body.hasMoreAfter).toBe(true)
    expect(body.cursorState).toEqual({ status: 'ok' })
    expect(body.projectionState).toBeNull()
  })

  it('around 与 cursor/direction 同传 → around 优先,翻页查询一律不发', async () => {
    authAsOwner()
    mockFindHistoryTurnWindow.mockResolvedValueOnce({
      turns: [{ turnOrdinal: 4, messages: [mockMsg(5, 4)] }],
      hasMoreBefore: false,
      hasMoreAfter: false,
      beforeCursor: null,
      afterCursor: null,
    })
    const cursor = b64(9)
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { around: '4', cursor, direction: 'older' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockFindHistoryTurnPage).not.toHaveBeenCalled()
    const body = res.json().data
    expect(body.nextCursor).toBeNull()
    expect(body.prevCursor).toBeNull()
    expect(body.hasMore).toBe(false)
    expect(body.hasMoreAfter).toBe(false)
  })

  it('turn 不存在(查询层回 null)→ 404,不回落普通分页', async () => {
    authAsOwner()
    mockFindHistoryTurnWindow.mockResolvedValueOnce(null)
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { around: '99' },
    })
    expect(res.statusCode).toBe(404)
    expect(mockFindHistoryTurnPage).not.toHaveBeenCalled()
  })

  it('around 非整数 → 400(zod coerce;fastify querystring 只判 type:string,G-261)', async () => {
    authAsOwner()
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { around: 'abc' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockFindHistoryTurnWindow).not.toHaveBeenCalled()
  })

  it('window 出界(0)→ 400,不触达查询层', async () => {
    authAsOwner()
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { around: '4', window: '0' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockFindHistoryTurnWindow).not.toHaveBeenCalled()
  })

  it('不带 around → 既有分页路径原样不动(findHistoryTurnWindow 不被调用)', async () => {
    authAsOwner()
    mockFindHistoryTurnPage.mockResolvedValueOnce({
      turns: [{ turnOrdinal: 1, messages: [mockMsg(1, 1)] }],
      nextCursor: null,
      hasMore: false,
      cursorState: { status: 'ok' as const },
    })
    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/history` })
    expect(res.statusCode).toBe(200)
    expect(mockFindHistoryTurnWindow).not.toHaveBeenCalled()
    expect(mockFindHistoryTurnPage).toHaveBeenCalledWith(CONV_ID, {
      limit: 20,
      cursorTurnOrdinal: null,
      direction: 'newest',
    })
  })
})
