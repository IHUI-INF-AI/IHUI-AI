// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockRateChatMessage } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRateChatMessage: vi.fn(),
}))

// 注意:此链上 Proxy 风格 mock 会抛 "non-object target"(2026-09-23 实测),
// 一律用显式对象 mock —— 与 chat.ts 的实际导入面一一对应。
vi.mock('../src/db/chat-queries.js', () => ({
  rateChatMessage: mockRateChatMessage,
  compressContextIfNeeded: vi.fn(),
  estimateMessagesTokens: vi.fn(),
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
  createMessage: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn(),
  findMessagesCursor: vi.fn(),
  encodeMessageCursor: vi.fn(),
  decodeMessageCursor: vi.fn(),
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

const MSG_ID = '123e4567-e89b-12d3-a456-426614174000'

/**
 * D49① 消息点赞/点踩落库 路由守门测试(2026-09-23 立):
 * - 未登录 401;rating 白名单外 400;
 * - 合法 like → 200 且 rateChatMessage 收到三参;
 * - 消息不存在/无权 → 404(不区分两种情况,不泄露 id 有效性)。
 * 真库集成另见 chat-message-feedbacks.real.test.ts(vitest.real.config)。
 */
describe('POST /messages/feedback(D49①)', () => {
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

  it('未登录 → 401 且不触达查询层', async () => {
    mockAuthenticate.mockRejectedValueOnce(Object.assign(new Error('auth'), { statusCode: 401 }))
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'like' },
    })
    expect(res.statusCode).toBe(401)
    expect(mockRateChatMessage).not.toHaveBeenCalled()
  })

  it('rating 白名单外 → 400', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'meh' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('合法 like → 200 且查询层收到 (userId, messageId, like)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'like' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ rated: true, rating: 'like' })
    expect(mockRateChatMessage).toHaveBeenCalledWith('user-1', MSG_ID, 'like')
  })

  it('消息不存在/无权 → 404(不区分两种情况)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: false, reason: 'not-found' })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike' },
    })
    expect(res.statusCode).toBe(404)
  })
})
