import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

// Mock config 避免导入时 env 校验触发 process.exit(1)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    COZE_API_KEY: '',
  },
}))

const { mockAuthenticate, mockFindConversationById, mockRegenerate, mockBranch, mockUpdateConversation } =
  vi.hoisted(() => ({
    mockAuthenticate: vi.fn(),
    mockFindConversationById: vi.fn(),
    mockRegenerate: vi.fn(),
    mockBranch: vi.fn(),
    mockUpdateConversation: vi.fn(),
  }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 覆盖 chat-queries 的个别函数(保留其余真实实现,避免导入失败)
vi.mock('../src/db/chat-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db/chat-queries.js')>()
  return {
    ...actual,
    findConversationById: mockFindConversationById,
    regenerateConversationMessages: mockRegenerate,
    branchConversationFrom: mockBranch,
    updateConversation: mockUpdateConversation,
  }
})

import { chatRoutes } from '../src/routes/chat'
import type { ChatConversation } from '@ihui/database'

const CONV_ID = '11111111-1111-4111-8111-111111111111'
const MSG_ID = '22222222-2222-4222-8222-222222222222'

const ownedConversation = {
  id: CONV_ID,
  userId: 'user-1',
  title: '测试会话',
  model: 'auto',
  systemPrompt: null,
  metadata: null,
  lastMessageAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  compressedAt: null,
  compressedContext: null,
  pinned: false,
  pinnedAt: null,
} as unknown as ChatConversation

describe('chat regenerate / branch / pin 端点', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(chatRoutes, { prefix: '/api/chat' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /conversations/:id/regenerate 未登录返回 401', async () => {
    const err = Object.assign(new Error('Authentication required'), { statusCode: 401 })
    mockAuthenticate.mockRejectedValueOnce(err)
    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/regenerate`,
      body: { messageId: MSG_ID },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /conversations/:id/regenerate body 缺少 messageId 返回 400', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/regenerate`,
      body: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /conversations/:id/regenerate 成功删除目标消息及之后内容', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockRegenerate.mockResolvedValueOnce({ regeneratedFrom: MSG_ID, remainingCount: 3 })
    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/regenerate`,
      body: { messageId: MSG_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ regeneratedFrom: MSG_ID, remainingCount: 3 })
  })

  it('POST /conversations/:id/branch 未登录返回 401', async () => {
    const err = Object.assign(new Error('Authentication required'), { statusCode: 401 })
    mockAuthenticate.mockRejectedValueOnce(err)
    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /conversations/:id/branch 成功创建新会话', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockResolvedValueOnce({
      ...ownedConversation,
      id: '33333333-3333-4333-8333-333333333333',
    } as ChatConversation)
    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.conversation.id).toBe('33333333-3333-4333-8333-333333333333')
  })

  it('PATCH /conversations/:id 支持 pinned 置顶字段', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockUpdateConversation.mockResolvedValueOnce({
      ...ownedConversation,
      pinned: true,
      pinnedAt: new Date(),
    } as ChatConversation)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/chat/conversations/${CONV_ID}`,
      body: { pinned: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.conversation.pinned).toBe(true)
  })
})
