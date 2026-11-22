// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60 服务端分叉端点(现行唯一端点 POST /conversations/:id/branch)的离线回归。
// 覆盖四格:①正常分叉 201 + fork 族信息(正控);②他人会话 403 且分叉函数零调用
// (副作用没发生);③分叉点消息级越权/不存在 404;④幂等重放 200 + replayed,
// 且身份只认令牌主体(body 里自报的 userId 不参与归属判定)。
import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

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

const { mockAuthenticate, mockFindConversationById, mockBranch } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindConversationById: vi.fn(),
  mockBranch: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 路由文件与 chat-queries 的真实实现都会 import db/index;这里给空壳,
// 让离线用例不加载真实连接池(与 chat-fork-branch-queries.test.ts 同一手法)。
vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
      'for',
    ]) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return chain
  }
  return {
    db: {
      select: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
      update: vi.fn(() => makeChain()),
      delete: vi.fn(() => makeChain()),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain()) },
  }
})

// 只覆盖本轮涉及的两个函数,其余保留真实实现(错误类必须是真类,路由按 instanceof 分流)
vi.mock('../src/db/chat-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ChatQueries>()
  return {
    ...actual,
    findConversationById: mockFindConversationById,
    branchConversationFrom: mockBranch,
  }
})

import { chatRoutes } from '../src/routes/chat'
import {
  ForkIdempotencyConflictError,
  ForkSourceRejectedError,
  type BranchForkResult,
} from '../src/db/chat-queries.js'
import type * as ChatQueries from '../src/db/chat-queries.js'
import type { ChatConversation } from '@ihui/database'

const CONV_ID = '11111111-1111-4111-8111-111111111111'
const MSG_ID = '22222222-2222-4222-8222-222222222222'
const NEW_CONV_ID = '33333333-3333-4333-8333-333333333333'
const CRID = '44444444-4444-4444-8444-444444444444'

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

function forkResult(overrides: Partial<BranchForkResult> = {}): BranchForkResult {
  return {
    conversation: { ...ownedConversation, id: NEW_CONV_ID } as ChatConversation,
    forkedFromMessageId: MSG_ID,
    sourceRootId: MSG_ID,
    sourceSiblingIndex: null,
    copiedMessageCount: 3,
    replayed: false,
    ...overrides,
  }
}

describe('POST /conversations/:id/branch(票60 服务端分叉)', () => {
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

  it('正常分叉:201,返回新 id 与族信息(正控)', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockResolvedValueOnce(forkResult())

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID, clientRequestId: CRID },
    })

    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.conversation.id).toBe(NEW_CONV_ID)
    expect(data.fork).toEqual({
      sourceConversationId: CONV_ID,
      forkedFromMessageId: MSG_ID,
      sourceRootId: MSG_ID,
      sourceSiblingIndex: null,
      messageCount: 3,
    })
    expect(data.replayed).toBe(false)
    // 身份由令牌主体入参,幂等键原样传到 queries 层
    expect(mockBranch).toHaveBeenCalledWith(
      CONV_ID,
      MSG_ID,
      expect.objectContaining({ userId: 'user-1', clientRequestId: CRID }),
    )
  })

  it('越权:他人会话 403 且分叉函数零调用(副作用没发生)', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'attacker'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation) // 属于 user-1

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID },
    })

    expect(res.statusCode).toBe(403)
    expect(mockBranch).not.toHaveBeenCalled()
  })

  it('body 自报 userId 不被采信:归属仍按令牌主体判', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockResolvedValueOnce(forkResult())

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID, userId: 'attacker' },
    })

    expect(res.statusCode).toBe(201)
    expect(mockBranch).toHaveBeenCalledWith(
      CONV_ID,
      MSG_ID,
      expect.objectContaining({ userId: 'user-1' }),
    )
  })

  it('分叉点消息不存在/不属于该会话:404(按错误类型分流,不比对文本)', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockRejectedValueOnce(new ForkSourceRejectedError('消息不存在或不属于该对话'))

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID },
    })

    expect(res.statusCode).toBe(404)
  })

  it('幂等重放:200 + replayed=true,仍返回首建会话 id', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockResolvedValueOnce(forkResult({ replayed: true }))

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID, clientRequestId: CRID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.replayed).toBe(true)
    expect(res.json().data.conversation.id).toBe(NEW_CONV_ID)
  })

  it('幂等键撞在别的分叉点上:409', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)
    mockBranch.mockRejectedValueOnce(
      new ForkIdempotencyConflictError('同一 clientRequestId 已用于其它分叉点'),
    )

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID, clientRequestId: CRID },
    })

    expect(res.statusCode).toBe(409)
  })

  it('clientRequestId 形态非法:400,不触库', async () => {
    mockAuthenticate.mockImplementationOnce(async (request: any) => {
      request.userId = 'user-1'
    })
    mockFindConversationById.mockResolvedValueOnce(ownedConversation)

    const res = await server.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/branch`,
      body: { messageId: MSG_ID, clientRequestId: 'not-a-uuid' },
    })

    expect(res.statusCode).toBe(400)
    expect(mockBranch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
