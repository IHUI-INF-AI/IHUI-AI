// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const {
  mockAuthenticate,
  mockFindConversationById,
  mockFindMessages,
  mockFindMessagesCursor,
  mockFindHistoryTurnPage,
  mockRatings,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindConversationById: vi.fn(),
  mockFindMessages: vi.fn(),
  mockFindMessagesCursor: vi.fn(),
  mockFindHistoryTurnPage: vi.fn(),
  mockRatings: vi.fn(),
}))

// 显式对象 mock(与 chat.ts 的实际导入面一一对应;缺导出 named import 为 undefined,
// 调用即 500 —— 与本目录既有反馈/历史测试同纪律)。
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
  findMessages: mockFindMessages,
  findMessagesCursor: mockFindMessagesCursor,
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  rateChatMessage: vi.fn(),
  clearChatMessageRating: vi.fn(),
  listMessageFeedbackRatings: mockRatings,
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn(),
  encodeMessageCursor: (c: { createdAt: string; id: string }) =>
    Buffer.from(JSON.stringify(c), 'utf8').toString('base64url'),
  decodeMessageCursor: vi.fn(() => null),
  findHistoryTurnPage: mockFindHistoryTurnPage,
  encodeHistoryCursor: (c: { turnOrdinal: number }) =>
    Buffer.from(JSON.stringify(c), 'utf8').toString('base64url'),
  decodeHistoryCursor: vi.fn(() => null),
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  editMessageAndTruncateAfter: vi.fn(),
  branchConversationFrom: vi.fn(),
  replaceMessages: vi.fn(),
  updateConversationTitle: vi.fn(),
  setMessageFlags: vi.fn(),
  editAiMessageAsVersion: vi.fn(),
  MessageEditRejectedError: class extends Error {},
  ForkIdempotencyConflictError: class extends Error {},
  ForkSourceRejectedError: class extends Error {},
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

const CONV_ID = '123e4567-e89b-12d3-a456-426614174000'
const MSG_LIKED = '11111111-1111-4111-8111-111111111111'
const MSG_DISLIKED = '22222222-2222-4222-8222-222222222222'
const MSG_SILENT = '33333333-3333-4333-8333-333333333333'

const rowOf = (id: string, content: string) => ({
  id,
  conversationId: CONV_ID,
  role: 'assistant',
  content,
  reasoning: null,
  tokens: 12,
  metadata: {},
  createdAt: new Date('2026-10-28T10:00:00.000Z'),
  pinnedAt: null,
  bookmarkedAt: null,
  parentMessageId: null,
  siblingIndex: null,
})

/**
 * 2026-10-28(读完回):消息赞/踩的**读面**回归。
 *
 * 为什么这个文件必须存在:在它之前,rateChatMessage 把票落了库,但没有任何读面把它
 * 发还给客户端 —— web 侧 👍/👎 只能靠组件本地态,重开对话/换端即丢失,用户看到的是
 * "我的票没记住"。这类"写了但没有读面"的缺口不会被写入侧测试发现(写入全绿、界面全丢),
 * 所以断言必须钉在**响应体**上,而不是钉在"查询函数被调用过"。
 *
 * 同时钉住两条不显眼但会退化的性质:
 * ① 整页只取一次票(批量),不做逐条回查 —— 否则一页 100 条就是 100 次往返;
 * ② `serializeMessage` 直传给 `Array.prototype.map` 会把 index 当第二个形参,
 *    给每条消息盖上一张并不存在的假票;本文件的"未表态必须是 null 而不是数字/undefined"
 *    断言就是这条的护栏。
 */
describe('消息评分读面(2026-10-28 读完回)', () => {
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

  const ownConversation = () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce({ id: CONV_ID, userId: 'user-1' })
  }

  it('GET /messages 把三条消息的票原样发还:like / dislike / null', async () => {
    ownConversation()
    mockFindMessages.mockResolvedValueOnce({
      list: [rowOf(MSG_LIKED, 'a'), rowOf(MSG_DISLIKED, 'b'), rowOf(MSG_SILENT, 'c')],
      total: 3,
      hasMore: false,
      nextCursor: null,
    })
    mockRatings.mockResolvedValueOnce(
      new Map([
        [MSG_LIKED, 'like'],
        [MSG_DISLIKED, 'dislike'],
      ]),
    )

    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/messages` })
    expect(res.statusCode).toBe(200)
    const messages = res.json().data.messages as { id: string; rating: unknown }[]
    expect(messages.map((m) => m.rating)).toEqual(['like', 'dislike', null])
  })

  it('整页只取一次票,入参是这一页的全部 messageId(不逐条回查)', async () => {
    ownConversation()
    mockFindMessages.mockResolvedValueOnce({
      list: [rowOf(MSG_LIKED, 'a'), rowOf(MSG_SILENT, 'b')],
      total: 2,
      hasMore: false,
      nextCursor: null,
    })
    mockRatings.mockResolvedValueOnce(new Map())

    await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/messages` })
    expect(mockRatings).toHaveBeenCalledTimes(1)
    expect(mockRatings).toHaveBeenCalledWith('user-1', [MSG_LIKED, MSG_SILENT])
  })

  it('keyset 游标读面同样带票(两个读面不许只修一个)', async () => {
    ownConversation()
    mockFindMessagesCursor.mockResolvedValueOnce({
      messages: [rowOf(MSG_LIKED, 'a')],
      hasMore: false,
      nextCursor: null,
    })
    mockRatings.mockResolvedValueOnce(new Map([[MSG_LIKED, 'like']]))

    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/messages`,
      query: { direction: 'initial' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.messages[0].rating).toBe('like')
    expect(mockRatings).toHaveBeenCalledTimes(1)
  })

  it('history 分片读面同样带票,且整页(跨 turn 拍平)只查一次', async () => {
    ownConversation()
    mockFindHistoryTurnPage.mockResolvedValueOnce({
      turns: [
        { turnOrdinal: 2, messages: [rowOf(MSG_LIKED, 'a')] },
        { turnOrdinal: 1, messages: [rowOf(MSG_DISLIKED, 'b')] },
      ],
      hasMore: false,
      nextCursor: null,
      cursorState: { status: 'ok' },
    })
    mockRatings.mockResolvedValueOnce(
      new Map([
        [MSG_LIKED, 'like'],
        [MSG_DISLIKED, 'dislike'],
      ]),
    )

    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { direction: 'newest' },
    })
    expect(res.statusCode).toBe(200)
    const turns = res.json().data.turns as { messages: { rating: unknown }[] }[]
    expect(turns.map((t) => t.messages[0]?.rating)).toEqual(['like', 'dislike'])
    expect(mockRatings).toHaveBeenCalledTimes(1)
    expect(mockRatings).toHaveBeenCalledWith('user-1', [MSG_LIKED, MSG_DISLIKED])
  })

  it('未登录 → 401,且读面查询一次都不发生', async () => {
    mockAuthenticate.mockRejectedValueOnce(Object.assign(new Error('auth'), { statusCode: 401 }))
    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/messages` })
    expect(res.statusCode).toBe(401)
    expect(mockRatings).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
