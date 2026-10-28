// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockRateChatMessage, mockClearChatMessageRating } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRateChatMessage: vi.fn(),
  mockClearChatMessageRating: vi.fn(),
}))

// 注意:此链上 Proxy 风格 mock 会抛 "non-object target"(2026-09-23 实测),
// 一律用显式对象 mock —— 与 chat.ts 的实际导入面一一对应。
vi.mock('../src/db/chat-queries.js', () => ({
  rateChatMessage: mockRateChatMessage,
  // 2026-10-28(读完回):撤销出口 + 读面批量查询。本文件只打 POST/DELETE 反馈路由,
  // 读面空 Map 与"整页无票"同义。
  clearChatMessageRating: mockClearChatMessageRating,
  listMessageFeedbackRatings: vi.fn(async () => new Map()),
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
 * - 合法 like → 200 且 rateChatMessage 收到四参(旧载荷时第 4 参 undefined = 问卷未填);
 * - 消息不存在/无权 → 404(不区分两种情况,不泄露 id 有效性)。
 * D64⑤(2026-09-26)补充:reason(五类)/comment(≤500)扩展载荷守门 ——
 * 旧载荷兼容 / 新载荷透传 / comment 超 500 → 400 / 越权 404 语义不变。
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

  it('D64⑤ 旧载荷兼容:仅 messageId+rating → 200,查询层收 (userId, messageId, like, undefined)', async () => {
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
    expect(mockRateChatMessage).toHaveBeenCalledWith('user-1', MSG_ID, 'like', undefined)
  })

  it('D64⑤ 新载荷:reason+comment → 200 且问卷对象透传查询层', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', reason: 'incomplete', comment: '少了最后一步' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockRateChatMessage).toHaveBeenCalledWith('user-1', MSG_ID, 'dislike', {
      reason: 'incomplete',
      comment: '少了最后一步',
    })
  })

  it('D64⑤ comment 仅空白 → 视同未填(不作为问卷载荷)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', comment: '   ' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockRateChatMessage).toHaveBeenCalledWith('user-1', MSG_ID, 'dislike', undefined)
  })

  it('D64⑤ comment 超 500 → 400 且不触达查询层', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', comment: 'a'.repeat(501) },
    })
    expect(res.statusCode).toBe(400)
    expect(mockRateChatMessage).not.toHaveBeenCalled()
  })

  it('D64⑤ comment 恰 500 → 400 之外的合法上界(200)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', comment: 'b'.repeat(500) },
    })
    expect(res.statusCode).toBe(200)
  })

  it('D64⑤ reason 白名单外 → 400', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', reason: 'tooSlow' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('D64⑤ 带新载荷时越权/不存在 → 404 语义不变', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockRateChatMessage.mockResolvedValueOnce({ ok: false, reason: 'not-found' })
    const res = await server.inject({
      method: 'POST',
      url: '/messages/feedback',
      payload: { messageId: MSG_ID, rating: 'dislike', reason: 'other', comment: 'x' },
    })
    expect(res.statusCode).toBe(404)
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

/**
 * 2026-10-28(读完回):DELETE /messages/:id/feedback —— 撤销一票。
 *
 * 守的是三件事:
 * ① 归属与鉴权不因"只是撤销"而放宽(未登录 401 且不触达查询层;不存在/无权 404);
 * ② 幂等 —— 本来就无票也回 200。界面上"再点一次已选中的键"必须安静成功,
 *    错误地把"已经是目标态"报成 404,用户就会以为票没撤掉而反复点;
 * ③ 响应体给 `{rated:false, rating:null}`,与 POST 的 `{rated:true, rating}` 同形,
 *    客户端可以按同一套状态机回写(不必为撤销写第二套判据)。
 */
describe('DELETE /messages/:id/feedback(2026-10-28 读完回)', () => {
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
    const res = await server.inject({ method: 'DELETE', url: `/messages/${MSG_ID}/feedback` })
    expect(res.statusCode).toBe(401)
    expect(mockClearChatMessageRating).not.toHaveBeenCalled()
  })

  it('撤销成功 → 200 且查询层收 (userId, messageId)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockClearChatMessageRating.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({ method: 'DELETE', url: `/messages/${MSG_ID}/feedback` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ rated: false, rating: null })
    expect(mockClearChatMessageRating).toHaveBeenCalledWith('user-1', MSG_ID)
  })

  it('幂等:本来就无票也回 200(不把"已是目标态"报成 404)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    // 库层对"删了 0 行"仍返回 ok:无票与撤成功对外同态
    mockClearChatMessageRating.mockResolvedValueOnce({ ok: true })
    const res = await server.inject({ method: 'DELETE', url: `/messages/${MSG_ID}/feedback` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ rated: false, rating: null })
  })

  it('消息不存在/无权 → 404(不区分两种情况)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockClearChatMessageRating.mockResolvedValueOnce({ ok: false, reason: 'not-found' })
    const res = await server.inject({ method: 'DELETE', url: `/messages/${MSG_ID}/feedback` })
    expect(res.statusCode).toBe(404)
  })
})
