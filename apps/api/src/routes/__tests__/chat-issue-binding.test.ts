// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D179 会话 Issue 绑定流 —— api 绑定/解绑 + 搜索转发端点测试。
 *
 * mock 风格与 conversation-archive.test.ts 一致:mock @ihui/auth + db/index.js +
 * chat-queries + ai-service-fetch,构建独立 Fastify 实例只挂本路由。
 * 全程不连生产库(§5 测试隔离铁律)。
 *
 * 验收口径(AGENTS §5b 测试规则):
 * - 越权用例必须断言「副作用没发生」(patchConversationMetadata 未被调用),
 *   不能只断言错误码 —— 否则"先改了再抛 403"会漏;
 * - 成对留正向对照(属主本人仍能完成)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
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

const { mockVerifyAccessToken, mockAiServiceFetch } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}))

vi.mock('../../db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
}))

vi.mock('../../db/chat-queries.js', () => ({
  findConversationById: vi.fn(),
  patchConversationMetadata: vi.fn(),
}))

vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
}))

import { chatIssueBindingRoutes } from '../chat-issue-binding.js'
import { findConversationById, patchConversationMetadata } from '../../db/chat-queries.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'
const AUTH_HEADERS = { authorization: 'Bearer mock-user-token' }

const CONVERSATION_A = {
  id: CONV_ID,
  userId: USER_A,
  title: '新对话',
  model: 'gpt-4o-mini',
  systemPrompt: null,
  metadata: { workspacePath: '/repo' },
  lastMessageAt: new Date('2026-09-30T00:00:00Z'),
  lastReadAt: null,
  createdAt: new Date('2026-09-30T00:00:00Z'),
  updatedAt: new Date('2026-09-30T00:00:00Z'),
  archivedAt: null,
  compressedAt: null,
  compressedContext: null,
  pinned: false,
  pinnedAt: null,
  shareToken: null,
  historyProjectionState: null,
  groupId: null,
}

const BINDING_BODY = {
  provider: 'github',
  id: '1001',
  title: '登录页样式漂移',
  url: 'https://github.com/org/repo/issues/42',
}

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

describe('POST /api/chat/conversations/:id/issue — 绑定/换绑', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatIssueBindingRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('未认证返回 401,不进属主查询', async () => {
    mockNoAuth()
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
      payload: BINDING_BODY,
    })
    expect(res.statusCode).toBe(401)
    expect(findConversationById).not.toHaveBeenCalled()
  })

  it('会话不存在返回 404,副作用不发生', async () => {
    vi.mocked(findConversationById).mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
      payload: BINDING_BODY,
    })
    expect(res.statusCode).toBe(404)
    expect(patchConversationMetadata).not.toHaveBeenCalled()
  })

  it('非属主返回 403,且绑定副作用不发生(先查归属后写,断言写库未执行)', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      ...CONVERSATION_A,
      userId: USER_B,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
      payload: BINDING_BODY,
    })
    expect(res.statusCode).toBe(403)
    expect(patchConversationMetadata).not.toHaveBeenCalled()
  })

  it('属主本人绑定成功:服务端盖章 boundAt,metadata 走 patch 通道', async () => {
    vi.mocked(findConversationById).mockResolvedValue(CONVERSATION_A)
    vi.mocked(patchConversationMetadata).mockResolvedValue({
      ...CONVERSATION_A,
      metadata: { ...CONVERSATION_A.metadata, issueBinding: BINDING_BODY },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
      payload: BINDING_BODY,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.issueBinding.provider).toBe('github')
    expect(body.data.issueBinding.url).toBe(BINDING_BODY.url)
    expect(typeof body.data.issueBinding.boundAt).toBe('string')
    expect(patchConversationMetadata).toHaveBeenCalledWith(
      CONV_ID,
      USER_A,
      expect.objectContaining({ issueBinding: expect.objectContaining({ provider: 'github' }) }),
    )
  })

  it('非法 uuid 被本层拦下(400),不进 DB 查询', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/conversations/not-a-uuid/issue',
      headers: AUTH_HEADERS,
      payload: BINDING_BODY,
    })
    expect(res.statusCode).toBe(400)
    expect(findConversationById).not.toHaveBeenCalled()
  })

  it('body 缺字段返回 400', async () => {
    vi.mocked(findConversationById).mockResolvedValue(CONVERSATION_A)
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
      payload: { provider: 'github', id: 'x' },
    })
    expect(res.statusCode).toBe(400)
    expect(patchConversationMetadata).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/chat/conversations/:id/issue — 解绑(改为独立任务)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatIssueBindingRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('非属主返回 403,且解绑副作用不发生', async () => {
    vi.mocked(findConversationById).mockResolvedValue({
      ...CONVERSATION_A,
      userId: USER_B,
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(403)
    expect(patchConversationMetadata).not.toHaveBeenCalled()
  })

  it('属主本人解绑成功:issueBinding 置 null(清空绑定),其余 metadata 键不丢', async () => {
    vi.mocked(findConversationById).mockResolvedValue(CONVERSATION_A)
    vi.mocked(patchConversationMetadata).mockResolvedValue(CONVERSATION_A)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/chat/conversations/${CONV_ID}/issue`,
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ unbound: true })
    const mergeArg = vi.mocked(patchConversationMetadata).mock.calls[0]?.[2] as Record<
      string,
      unknown
    >
    expect('issueBinding' in mergeArg).toBe(true)
    expect(mergeArg.issueBinding).toBeNull()
  })
})

describe('POST /api/chat/issues/search — ai-service MCP 搜索转发', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatIssueBindingRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
  })

  it('转发 ai-service 规范化结果(provider 未配置 = configured:false 原样透传)', async () => {
    mockAiServiceFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            provider: 'linear',
            serverName: null,
            configured: false,
            error: null,
            items: [],
          },
        }),
        { status: 200 },
      ),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/issues/search',
      headers: AUTH_HEADERS,
      payload: { provider: 'linear', query: '同步' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ configured: false, items: [] })
    expect(mockAiServiceFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/api/agent/issues/search',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('ai-service 失败 → 502 不炸', async () => {
    mockAiServiceFetch.mockResolvedValue(new Response('upstream boom', { status: 500 }))
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/issues/search',
      headers: AUTH_HEADERS,
      payload: { provider: 'github', query: 'q' },
    })
    expect(res.statusCode).toBe(502)
  })

  it('provider 白名单外 → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/issues/search',
      headers: AUTH_HEADERS,
      payload: { provider: 'jira', query: 'q' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockAiServiceFetch).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
