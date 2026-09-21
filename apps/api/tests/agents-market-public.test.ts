// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:市场公开化游客视图测试 — 列表/详情游客仅见 published + 脱敏

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

vi.mock('../src/config/index.js', () => ({
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
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

const { mockAuthenticate, mockCheckAuth, mockListAgents, mockGetDetail } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  mockListAgents: vi.fn(),
  mockGetDetail: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  requireActiveUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

// checkAuth 模拟真实语义:authenticate 成功 → true;失败 → 发送 401 并返回 false
mockCheckAuth.mockImplementation(async (request: { userId?: string }, reply: any) => {
  try {
    await mockAuthenticate(request)
    return true
  } catch (e) {
    reply.status(401).send({ code: 401, message: (e as Error).message })
    return false
  }
})

vi.mock('../src/services/agent-service.js', () => ({
  listAgents: mockListAgents,
  getAgentDetail: mockGetDetail,
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {},
  dbClient: {},
}))

import { agentsRoutes, sanitizePublicAgent } from '../src/routes/agents.js'

const REGULAR_USER = '00000000-0000-4000-8000-000000000002'

function mockUser() {
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = REGULAR_USER
  })
}

function mockGuest() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

/** 全量敏感字段行(模拟 DB 真实行形态) */
function fullAgentRow(overrides: Record<string, unknown> = {}) {
  return {
    agentId: '11111111-1111-4111-8111-111111111111',
    name: '市场智能体',
    description: 'desc',
    avatar: null,
    cover: null,
    categoryId: null,
    userId: REGULAR_USER,
    workspaceId: 'ws-internal-1',
    status: 'published',
    price: 0,
    isFree: true,
    isVipExclusive: false,
    sort: 0,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    remark: 'internal-remark',
    agentVersion: '1.0',
    agentPrompt: 'SECRET-PROMPT',
    agentModel: 'gpt-x',
    agentTemperature: 7,
    agentMaxTokens: 4096,
    agentVariables: '{"k":"v"}',
    botId: 'bot-123',
    botIdStr: 'bot-str-123',
    botName: 'bot-name',
    publishChannel: 'coze',
    cozeAccountId: 'coze-1',
    suggestedQuestions: null,
    usageCount: 5,
    likeCount: 1,
    shareCount: 0,
    collectCount: 2,
    userName: 'creator',
    ...overrides,
  }
}

describe('agents 市场公开化 — 游客视图', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockListAgents.mockReset().mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 12 })
    mockGetDetail.mockReset()
    mockGuest()
  })

  it('游客 GET /api/agents/list → 200,强制 status=published 且响应脱敏', async () => {
    mockListAgents.mockResolvedValue({
      list: [fullAgentRow()],
      total: 1,
      page: 1,
      pageSize: 12,
    })
    const res = await server.inject({ method: 'GET', url: '/api/agents/list?page=1&pageSize=12' })
    expect(res.statusCode).toBe(200)
    expect(mockListAgents).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', userId: undefined }),
    )
    const body = JSON.parse(res.body)
    const row = body.data.list[0]
    expect(row.name).toBe('市场智能体')
    expect(row).not.toHaveProperty('agentPrompt')
    expect(row).not.toHaveProperty('botId')
    expect(row).not.toHaveProperty('agentVariables')
    expect(row).not.toHaveProperty('cozeAccountId')
    expect(row).not.toHaveProperty('remark')
    expect(row).not.toHaveProperty('workspaceId')
  })

  it('游客传 status=pending 仍被强制为 published', async () => {
    await server.inject({ method: 'GET', url: '/api/agents/list?status=pending' })
    expect(mockListAgents).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }))
  })

  it('游客 GET /api/agents(新契约路径)同样公开', async () => {
    await server.inject({ method: 'GET', url: '/api/agents' })
    expect(mockListAgents).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }))
  })

  it('登录用户列表行为不变:status 透传,响应不脱敏', async () => {
    mockUser()
    mockListAgents.mockResolvedValue({ list: [fullAgentRow()], total: 1, page: 1, pageSize: 12 })
    const res = await server.inject({ method: 'GET', url: '/api/agents/list?status=pending' })
    expect(res.statusCode).toBe(200)
    expect(mockListAgents).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }))
    const row = JSON.parse(res.body).data.list[0]
    expect(row.agentPrompt).toBe('SECRET-PROMPT')
  })

  it('游客 GET 已发布详情 → 200 且脱敏', async () => {
    mockGetDetail.mockResolvedValue({ agent: fullAgentRow() })
    const res = await server.inject({
      method: 'GET',
      url: '/api/agents/11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(200)
    const row = JSON.parse(res.body).data
    expect(row.name).toBe('市场智能体')
    expect(row).not.toHaveProperty('agentPrompt')
    expect(row).not.toHaveProperty('botId')
  })

  it('游客 GET 未发布详情 → 404(不泄露存在性)', async () => {
    mockGetDetail.mockResolvedValue({ agent: fullAgentRow({ status: 'pending' }) })
    const res = await server.inject({
      method: 'GET',
      url: '/api/agents/11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(404)
  })

  it('游客 GET /api/agents/my 仍 401(我的 Agent 不公开)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/agents/my' })
    expect(res.statusCode).toBe(401)
  })

  it('游客写操作仍被拒:POST /api/agents/create → 401', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/agents/create',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('sanitizePublicAgent 纯函数:剥离敏感键,保留展示键', () => {
    const out = sanitizePublicAgent(fullAgentRow()) as Record<string, unknown>
    for (const k of [
      'agentPrompt',
      'agentVariables',
      'agentModel',
      'agentTemperature',
      'agentMaxTokens',
      'botId',
      'botIdStr',
      'botName',
      'publishChannel',
      'cozeAccountId',
      'workspaceId',
      'remark',
      'suggestedQuestions',
      'agentVersion',
    ]) {
      expect(out).not.toHaveProperty(k)
    }
    expect(out.name).toBe('市场智能体')
    expect(out.usageCount).toBe(5)
    expect(out.userName).toBe('creator')
  })
})
