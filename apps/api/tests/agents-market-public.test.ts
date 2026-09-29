// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

  // ===========================================================================
  // G-814410(2026-09-29)公开投影 allow-list 的两条断言
  //   ① 未发布的行读不到 —— 逐状态 + 列表行级(不能只证明"查询参数传对了")
  //   ② 本地身份字段不出现在响应体 —— 逐字段名断言,三个面(列表/详情/纯函数)各判一遍
  // 口径对齐 AGENTS §5:"测试要断言未发布读不到 + 脱敏字段不出现,不得只断言 200"。
  // ===========================================================================

  /** 本地身份字段:能定位到某个账号/某个工作区的都算(与源码 LOCAL_IDENTITY_AGENT_KEYS 同集合) */
  const LOCAL_IDENTITY_FIELDS = [
    'userId',
    'workspaceId',
    'cozeAccountId',
    'botId',
    'botIdStr',
    'botName',
    'publishChannel',
  ] as const

  /** 内容敏感字段(提示词全文与模型配置、内部备注、推荐问句、版本戳) */
  const PRIVATE_CONTENT_FIELDS = [
    'agentVersion',
    'agentPrompt',
    'agentModel',
    'agentTemperature',
    'agentMaxTokens',
    'agentVariables',
    'remark',
    'suggestedQuestions',
  ] as const

  /** 游客响应的全部字段契约 = allow-list(PUBLIC_AGENT_KEYS);漏一个就是砸现有端上的展示 */
  const PUBLIC_CONTRACT_FIELDS = [
    'agentId',
    'name',
    'description',
    'avatar',
    'cover',
    'categoryId',
    'status',
    'price',
    'isFree',
    'isVipExclusive',
    'sort',
    'publishedAt',
    'createdAt',
    'updatedAt',
    'usageCount',
    'likeCount',
    'shareCount',
    'collectCount',
    'publishStatus',
    'userName',
  ] as const

  /** 逐字段名断言"不出现":既查键在不在,也查那一份**值**有没有从别处漏出去 */
  function expectFieldsAbsent(
    obj: Record<string, unknown>,
    fields: readonly string[],
    rawBody?: string,
  ) {
    for (const field of fields) {
      expect(obj, `公开响应不得出现字段 ${field}`).not.toHaveProperty(field)
    }
    if (rawBody !== undefined) {
      // 夹具里每个身份/敏感字段的取值都是独有串:整份响应体里搜不到,才排除了
      // "换了个键名照样把值发出去"这一型(逐键判据对它是盲的)。
      expect(rawBody).not.toContain('ws-internal-1')
      expect(rawBody).not.toContain('coze-1')
      expect(rawBody).not.toContain('bot-123')
      expect(rawBody).not.toContain('bot-str-123')
      expect(rawBody).not.toContain('bot-name')
      expect(rawBody).not.toContain('internal-remark')
      expect(rawBody).not.toContain('SECRET-PROMPT')
      expect(rawBody).not.toContain('{"k":"v"}')
      expect(rawBody).not.toContain(REGULAR_USER)
    }
  }

  it('① 游客逐个未发布状态读详情一律 404,且响应不泄露名称', async () => {
    for (const status of ['pending', 'rejected', 'offline', 'draft', 'archived']) {
      mockGetDetail.mockResolvedValue({ agent: fullAgentRow({ status }) })
      const res = await server.inject({
        method: 'GET',
        url: '/api/agents/11111111-1111-4111-8111-111111111111',
      })
      expect(res.statusCode, `status=${status} 必须读不到`).toBe(404)
      expect(res.body).not.toContain('市场智能体')
    }
  })

  it('① 游客列表逐行判已发布:即便查询返回了未发布行也不发出去', async () => {
    mockListAgents.mockResolvedValue({
      list: [
        fullAgentRow(),
        fullAgentRow({
          agentId: '22222222-2222-4222-8222-222222222222',
          name: '待审核智能体',
          status: 'pending',
        }),
        fullAgentRow({
          agentId: '33333333-3333-4333-8333-333333333333',
          name: '已下架智能体',
          status: 'offline',
        }),
      ],
      total: 3,
      page: 1,
      pageSize: 12,
    })
    const res = await server.inject({ method: 'GET', url: '/api/agents/list' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as { data: { list: Array<{ agentId?: string }> } }
    expect(body.data.list.map((r) => r.agentId)).toEqual([
      '11111111-1111-4111-8111-111111111111',
    ])
    expect(res.body).not.toContain('待审核智能体')
    expect(res.body).not.toContain('已下架智能体')
  })

  it('② 游客列表响应:本地身份字段与内容敏感字段逐键不出现', async () => {
    mockListAgents.mockResolvedValue({
      list: [fullAgentRow({ publishStatus: 'published' })],
      total: 1,
      page: 1,
      pageSize: 12,
    })
    const res = await server.inject({ method: 'GET', url: '/api/agents/list' })
    expect(res.statusCode).toBe(200)
    const row = (JSON.parse(res.body) as { data: { list: Record<string, unknown>[] } }).data.list[
      0
    ] as Record<string, unknown>
    expectFieldsAbsent(row, LOCAL_IDENTITY_FIELDS, res.body)
    expectFieldsAbsent(row, PRIVATE_CONTENT_FIELDS, res.body)
    for (const field of PUBLIC_CONTRACT_FIELDS) {
      expect(row, `公开契约字段 ${field} 必须还在`).toHaveProperty(field)
    }
    // 作者展示走 userName(冗余列),不是 userId
    expect(row.userName).toBe('creator')
  })

  it('② 游客详情响应:本地身份字段与内容敏感字段逐键不出现', async () => {
    mockGetDetail.mockResolvedValue({ agent: fullAgentRow({ publishStatus: 'published' }) })
    const res = await server.inject({
      method: 'GET',
      url: '/api/agents/11111111-1111-4111-8111-111111111111',
    })
    expect(res.statusCode).toBe(200)
    const row = JSON.parse(res.body).data as Record<string, unknown>
    expectFieldsAbsent(row, LOCAL_IDENTITY_FIELDS, res.body)
    expectFieldsAbsent(row, PRIVATE_CONTENT_FIELDS, res.body)
    for (const field of PUBLIC_CONTRACT_FIELDS) {
      expect(row, `公开契约字段 ${field} 必须还在`).toHaveProperty(field)
    }
  })

  it('② sanitizePublicAgent 纯函数:身份字段即使真在行里也不进投影', () => {
    const out = sanitizePublicAgent(fullAgentRow({ publishStatus: 'published' }))
    expectFieldsAbsent(out, LOCAL_IDENTITY_FIELDS)
    expectFieldsAbsent(out, PRIVATE_CONTENT_FIELDS)
    for (const field of PUBLIC_CONTRACT_FIELDS) {
      expect(out, `公开契约字段 ${field} 必须还在`).toHaveProperty(field)
    }
  })

  it('allow-list 买到的行为变化:表新增未知列默认不进公开面(黑名单时代会漏出去)', () => {
    const futureRow = fullAgentRow({
      // 模拟 agents 表日后新增的一列(旧写法 { ...row } + delete 会把它原样发给游客)
      internalSecret: 'LEAK-ME-IF-DENYLIST',
      newCozeRuntimeField: { nested: 'LEAK-ME-NESTED' },
      publishStatus: 'published',
    })
    const out = sanitizePublicAgent(futureRow)
    expect(out).not.toHaveProperty('internalSecret')
    expect(out).not.toHaveProperty('newCozeRuntimeField')
    expect(Object.keys(out).sort()).toEqual([...PUBLIC_CONTRACT_FIELDS].sort())

    // 同一条判据伸到 HTTP 面:整份响应体里搜不到那两串取值
    mockListAgents.mockResolvedValue({
      list: [futureRow],
      total: 1,
      page: 1,
      pageSize: 12,
    })
    mockGetDetail.mockResolvedValue({ agent: futureRow })
    return Promise.all([
      server.inject({ method: 'GET', url: '/api/agents/list' }).then((res) => {
        expect(res.body).not.toContain('LEAK-ME-IF-DENYLIST')
        expect(res.body).not.toContain('LEAK-ME-NESTED')
      }),
      server
        .inject({
          method: 'GET',
          url: '/api/agents/11111111-1111-4111-8111-111111111111',
        })
        .then((res) => {
          expect(res.body).not.toContain('LEAK-ME-IF-DENYLIST')
          expect(res.body).not.toContain('LEAK-ME-NESTED')
        }),
    ])
  })

  it('值缺席不建键、null 原样保留(跨版本交换格式的两种"没有"必须可分辨)', () => {
    const out = sanitizePublicAgent({ agentId: 'a', name: 'n', avatar: null, description: null })
    expect(out).not.toHaveProperty('createdAt')
    expect(out.avatar).toBeNull()
    expect(out.description).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
