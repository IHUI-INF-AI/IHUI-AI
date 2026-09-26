// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockFindHistoryTurnPage, mockFindConversationById } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindHistoryTurnPage: vi.fn(),
  mockFindConversationById: vi.fn(),
}))

// 显式对象 mock(与 chat.ts 的实际导入面一一对应;缺导出 named import 为 undefined
// —— 与 chat-message-feedback.test.ts 同纪律)。D35 新增三导出在尾部补充。
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
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn(),
  findMessagesCursor: vi.fn(),
  encodeMessageCursor: vi.fn(),
  decodeMessageCursor: vi.fn(),
  findHistoryTurnPage: mockFindHistoryTurnPage,
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

/** mock 一条可序列化的消息行 */
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

/**
 * D35 GET /conversations/:id/history 路由守门测试(2026-09-24 立):
 * - 未登录 401;会话不存在/无权 404;cursor 非法 400;limit 出界 400;
 * - 合法请求 → 200 且响应含 turns(nextCursor/hasMore/projectionState);
 * - direction/cursor 正确透传查询层;projectionState 透传(可空)。
 * turn 分片语义权威实现在 @ihui/shared/chat/history-projection(15 例在库)。
 */
describe('GET /conversations/:id/history(D35 turn 分片)', () => {
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
    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/history` })
    expect(res.statusCode).toBe(401)
    expect(mockFindHistoryTurnPage).not.toHaveBeenCalled()
  })

  it('会话不存在 → 404', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(null)
    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/history` })
    expect(res.statusCode).toBe(404)
    expect(mockFindHistoryTurnPage).not.toHaveBeenCalled()
  })

  it('cursor 非法(非 base64url JSON/非整数序号)→ 400', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce({
      id: CONV_ID,
      userId: 'user-1',
      historyProjectionState: null,
    })
    const bad = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { cursor: 'not-base64-!!!' },
    })
    expect(bad.statusCode).toBe(400)

    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce({
      id: CONV_ID,
      userId: 'user-1',
      historyProjectionState: null,
    })
    const nonInt = Buffer.from(JSON.stringify({ turnOrdinal: 'x' })).toString('base64url')
    const res2 = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { cursor: nonInt },
    })
    expect(res2.statusCode).toBe(400)
  })

  it('limit 出界(0 / 101)→ 网关 JSON Schema 拦截,不触达查询层', async () => {
    // 注:Fastify AJV 校验失败后 error 信封序列化失败 → 500(FST_ERR_FAILED_ERROR_SERIALIZATION),
    // 为全仓既有行为(既有 GET /messages?pageSize=0 同样 500,实测见 D35 报告);
    // 本断言锁定「出界参数不触达查询层」这一安全语义。
    for (const limit of ['0', '101']) {
      mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
        req.userId = 'user-1'
      })
      mockFindConversationById.mockResolvedValueOnce({
        id: CONV_ID,
        userId: 'user-1',
        historyProjectionState: null,
      })
      const res = await server.inject({
        method: 'GET',
        url: `/conversations/${CONV_ID}/history`,
        query: { limit },
      })
      expect([400, 500]).toContain(res.statusCode)
      expect(mockFindHistoryTurnPage).not.toHaveBeenCalled()
    }
  })

  it('合法 newest → 200,turns 升序 + nextCursor + projectionState 透传', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    const projectionState = {
      nextRolloutByteOffset: 1024,
      nextRolloutOrdinal: 7,
      lastRolledAt: '2026-09-24T00:00:00Z',
    }
    mockFindConversationById.mockResolvedValueOnce({
      id: CONV_ID,
      userId: 'user-1',
      historyProjectionState: projectionState,
    })
    mockFindHistoryTurnPage.mockResolvedValueOnce({
      turns: [
        { turnOrdinal: 5, messages: [mockMsg(8, 5), mockMsg(9, 5)] },
        { turnOrdinal: 6, messages: [mockMsg(10, 6)] },
      ],
      nextCursor: { turnOrdinal: 5 },
      hasMore: true,
    })
    const res = await server.inject({ method: 'GET', url: `/conversations/${CONV_ID}/history` })
    expect(res.statusCode).toBe(200)
    const body = res.json().data // success() 信封:{ code, message, data }
    expect(body.turns.map((t: { turnOrdinal: number }) => t.turnOrdinal)).toEqual([5, 6])
    expect(body.turns[0].messages).toHaveLength(2)
    expect(body.hasMore).toBe(true)
    expect(body.nextCursor).toBe(Buffer.from('{"turnOrdinal":5}').toString('base64url'))
    expect(body.projectionState).toEqual(projectionState)
    // 默认 direction=newest,limit 默认 20
    expect(mockFindHistoryTurnPage).toHaveBeenCalledWith(CONV_ID, {
      limit: 20,
      cursorTurnOrdinal: null,
      direction: 'newest',
    })
  })

  it('direction=newer + 合法 cursor → cursorTurnOrdinal 透传查询层(增量续读)', async () => {
    mockAuthenticate.mockImplementationOnce(async (req: { userId?: string }) => {
      req.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce({
      id: CONV_ID,
      userId: 'user-1',
      historyProjectionState: null,
    })
    mockFindHistoryTurnPage.mockResolvedValueOnce({
      turns: [],
      nextCursor: null,
      hasMore: false,
    })
    const cursor = Buffer.from(JSON.stringify({ turnOrdinal: 4 })).toString('base64url')
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${CONV_ID}/history`,
      query: { cursor, direction: 'newer', limit: '3' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json().data // success() 信封:{ code, message, data }
    expect(body.turns).toEqual([])
    expect(body.hasMore).toBe(false)
    expect(body.nextCursor).toBeNull()
    // 投影状态为空会话 → null(尚未投影)
    expect(body.projectionState).toBeNull()
    expect(mockFindHistoryTurnPage).toHaveBeenCalledWith(CONV_ID, {
      limit: 3,
      cursorTurnOrdinal: 4,
      direction: 'newer',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
