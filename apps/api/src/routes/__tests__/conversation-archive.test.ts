// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 压缩归档("归档记忆"能力,2026-09-01 立)测试:
 * 1. persistMessageArchive util:成功落库 / DB 失败降级(console.warn + null,不影响压缩主流程)
 * 2. GET /api/chat/conversations/:id/archives 列表端点:未认证 401 / 会话不存在 404 /
 *    非本人会话 404 / 本人正常返回
 * 3. GET /api/chat/conversations/:id/archives/:archiveId 详情端点:归档不存在 404 /
 *    非本人会话 404 / 正常返回完整 messages
 *
 * mock 风格与 live-gifts.test.ts 一致:mock db 层(db/index.js)+ chat-queries + auth。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../../config/index.js', () => ({
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
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockVerifyAccessToken, mockSelectResult, mockInsertValues } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockSelectResult: vi.fn().mockResolvedValue([]),
  mockInsertValues: vi.fn().mockResolvedValue([]),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => {
  const make = () => {
    const thenFn = (resolve: (v: unknown) => void) => mockSelectResult().then(resolve)
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return {
    db: {
      select: vi.fn(() => make()),
      insert: vi.fn(() => ({
        values: (vals: Record<string, unknown>) => ({
          returning: () => mockInsertValues(vals),
        }),
      })),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
  }
})

// chat.ts 从 chat-queries 导入大量查询函数,统一 mock 为空实现,按需覆写 findConversationById
vi.mock('../../db/chat-queries.js', () => ({
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
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  branchConversationFrom: vi.fn(),
}))

import { chatRoutes } from '../chat.js'
import { db } from '../../db/index.js'
import { findConversationById } from '../../db/chat-queries.js'
import { persistMessageArchive } from '../../utils/conversation-archive.js'
import { conversationMessageArchives } from '@ihui/database'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'
const ARCHIVE_ID = 'dddddddd-4444-4444-8444-444444444444'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

function mockAuth(userId = USER_A): void {
  mockVerifyAccessToken.mockResolvedValue({
    userId,
    phone: '13800000000',
    familyId: '11111111-1111-4111-8111-111111111111',
    roleId: 1,
  })
}

function mockNoAuth(): void {
  mockVerifyAccessToken.mockRejectedValue(
    Object.assign(new Error('Authentication required'), { statusCode: 401 }),
  )
}

describe('persistMessageArchive — 归档 util', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('成功落库返回 archive id,messageCount/coveredChars 统计正确', async () => {
    mockInsertValues.mockResolvedValue([{ id: ARCHIVE_ID }])
    const messages = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi there' },
    ]
    const result = await persistMessageArchive(CONV_ID, messages)
    expect(result).toBe(ARCHIVE_ID)
    expect(db.insert).toHaveBeenCalledWith(conversationMessageArchives)
    const vals = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(vals.conversationId).toBe(CONV_ID)
    expect(vals.messageCount).toBe(2)
    expect(vals.coveredChars).toBe(13) // 'hello'.length + 'hi there'.length
    expect(vals.messages).toEqual(messages)
  })

  it('DB 失败降级:console.warn + 返回 null,绝不抛错影响压缩主流程', async () => {
    mockInsertValues.mockRejectedValue(new Error('db connection lost'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await persistMessageArchive(CONV_ID, [
      { role: 'user', content: 'hello' },
    ])
    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0]?.[0]).toContain('[ConversationArchive]')
  })
})

describe('GET /api/chat/conversations/:id/archives — 归档列表', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResult.mockResolvedValue([])
    mockAuth()
  })

  it('未认证返回 401', async () => {
    mockNoAuth()
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('会话不存在返回 404', async () => {
    vi.mocked(findConversationById).mockResolvedValue(undefined as never)
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
  })

  it('非本人会话返回 404(不泄露会话存在性)', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      id: CONV_ID,
      userId: USER_B,
    } as never)
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
  })

  it('本人会话正常返回归档列表(不含 messages 大字段)', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      id: CONV_ID,
      userId: USER_A,
    } as never)
    mockSelectResult.mockResolvedValue([
      {
        id: ARCHIVE_ID,
        conversationId: CONV_ID,
        messageCount: 5,
        coveredChars: 1200,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.archives).toHaveLength(1)
    expect(body.data.archives[0]).toMatchObject({
      id: ARCHIVE_ID,
      messageCount: 5,
      coveredChars: 1200,
    })
    expect(body.data.archives[0].messages).toBeUndefined()
  })
})

describe('GET /api/chat/conversations/:id/archives/:archiveId — 归档详情', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResult.mockResolvedValue([])
    mockAuth()
  })

  it('非本人会话返回 404', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      id: CONV_ID,
      userId: USER_B,
    } as never)
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives/${ARCHIVE_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
  })

  it('归档不存在返回 404', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      id: CONV_ID,
      userId: USER_A,
    } as never)
    mockSelectResult.mockResolvedValue([]) // findMessageArchive 查不到
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives/${ARCHIVE_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(404)
  })

  it('正常返回单条归档完整 messages', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      id: CONV_ID,
      userId: USER_A,
    } as never)
    const archivedMessages = [
      { role: 'user', content: '帮我写一个排序算法' },
      { role: 'assistant', content: '好的,这是快速排序实现…' },
    ]
    mockSelectResult.mockResolvedValue([
      {
        id: ARCHIVE_ID,
        conversationId: CONV_ID,
        messages: archivedMessages,
        messageCount: 2,
        coveredChars: 20,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/conversations/${CONV_ID}/archives/${ARCHIVE_ID}`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.archive.id).toBe(ARCHIVE_ID)
    expect(body.data.archive.messageCount).toBe(2)
    expect(body.data.archive.messages).toEqual(archivedMessages)
  })
})
