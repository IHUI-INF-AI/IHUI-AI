// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// ---------- 可控鉴权 mock ----------
const { mockCheckAuth, mockRequireAdmin } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: mockCheckAuth,
  authenticate: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  requirePermission: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// ---------- 业务服务 mock ----------
const { mockGetAgentDetail, mockListAgents, mockCreateAgent, mockUpdateAgent, mockDeleteAgent } =
  vi.hoisted(() => ({
    mockGetAgentDetail: vi.fn(),
    mockListAgents: vi.fn(),
    mockCreateAgent: vi.fn(),
    mockUpdateAgent: vi.fn(),
    mockDeleteAgent: vi.fn(),
  }))

vi.mock('../src/services/agent-service.js', () => ({
  getAgentDetail: mockGetAgentDetail,
  listAgents: mockListAgents,
  createAgent: mockCreateAgent,
  updateAgent: mockUpdateAgent,
  deleteAgent: mockDeleteAgent,
  submitForReview: vi.fn(),
  publishAgent: vi.fn(),
  offlineAgent: vi.fn(),
  executeAgent: vi.fn(),
}))

// agents-queries 仅 mock 用到的高频函数,其余给出空实现避免导入副作用
vi.mock('../src/db/agents-queries.js', () => ({
  findAgentById: vi.fn(),
  findAgentsList: vi.fn(),
  findCategoryList: vi.fn(),
  findCategoryById: vi.fn(),
  findCategoriesByIds: vi.fn(),
  findCategoryByAgentId: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  findSettlementList: vi.fn(),
  findSettlementSummary: vi.fn(),
  findSettlementByOrder: vi.fn(),
  createSettlement: vi.fn(),
  settleSettlement: vi.fn(),
  deleteSettlements: vi.fn(),
  findExamineList: vi.fn(),
  findExamineStats: vi.fn(),
  findExamineById: vi.fn(),
  createExamine: vi.fn(),
  updateExamine: vi.fn(),
  deleteExamine: vi.fn(),
  approveExamine: vi.fn(),
  rejectExamine: vi.fn(),
  findThumb: vi.fn(),
  addThumb: vi.fn(),
  removeThumb: vi.fn(),
  findCollect: vi.fn(),
  addCollect: vi.fn(),
  removeCollect: vi.fn(),
  recordAgentUse: vi.fn(),
  findAgentByBotId: vi.fn(),
  findAgentByAgentId: vi.fn(),
  unpublishAgentByAgentId: vi.fn(),
  findAgentSuggestions: vi.fn(),
  updateAgentDetails: vi.fn(),
}))

vi.mock('../src/db/oauth-queries.js', () => ({
  listOAuthApps: vi.fn(),
  findAuditLogList: vi.fn(),
  findAuditLogStats: vi.fn(),
  findOAuthAppByClientId: vi.fn(),
  createOAuthApp: vi.fn(),
  updateOAuthApp: vi.fn(),
  deleteOAuthApp: vi.fn(),
  regenerateOAuthAppSecret: vi.fn(),
  listActiveScopeMeta: vi.fn(),
  findThirdPartyAccount: vi.fn(),
  createThirdPartyBinding: vi.fn(),
}))

// db / dbRead:heat/generate 等端点直接使用,提供链式 mock 避免真实查询
// dbRead.select 提升为可控 mock:stats 端点测试可覆写返回行,默认仍返回链式 Proxy(行为不变)
const { mockDbExecute, mockDbReadSelect, makeDbChain } = vi.hoisted(() => {
  const makeDbChain = () => {
    const obj: Record<string, ReturnType<typeof vi.fn>> = {}
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_t, prop) {
        if (prop === 'then' || prop === 'catch') return undefined
        if (!obj[prop as string]) obj[prop as string] = vi.fn().mockReturnValue(proxy)
        return obj[prop as string]
      },
    }
    const proxy = new Proxy({}, handler)
    return proxy
  }
  return {
    makeDbChain,
    mockDbExecute: vi.fn().mockResolvedValue([]),
    mockDbReadSelect: vi.fn().mockImplementation(() => makeDbChain()),
  }
})

vi.mock('../src/db/index.js', () => {
  return {
    db: { execute: mockDbExecute },
    dbRead: new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'select') return mockDbReadSelect
          return vi.fn().mockReturnValue(makeDbChain())
        },
      },
    ),
    returningOne: vi.fn(),
  }
})

import { agentsRoutes } from '../src/routes/agents.js'

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    agentId: 'agent-001',
    name: '测试智能体',
    description: '',
    avatar: '',
    cover: '',
    categoryId: null,
    userId: 'user-001',
    workspaceId: null,
    status: 'published',
    price: 0,
    isFree: true,
    sort: 0,
    remark: '',
    likeCount: 0,
    shareCount: 0,
    collectCount: 0,
    usageCount: 0,
    heatScore: 0,
    ...overrides,
  }
}

// stats 端点单条聚合查询 mock:
//   select().from(x)          → 可直接 await(无 where 的查询)
//   select().from(x).where(c) → 返回 Promise
// 两者均 resolve 为 rows(与 drizzle 真实行为一致)
function statsQuery(rows: Array<Record<string, unknown>>) {
  const fromResult = {
    where: () => Promise.resolve(rows),
    then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(rows).then(onFulfilled),
  }
  return { from: () => fromResult }
}

// 按端点内 Promise.all 的 6 条聚合查询顺序注入返回行:
// totalAgents / publishedCount / pendingCount / totalUsers / totalCalls / avgRating
function mockStatsRows(
  rows: [
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>,
  ],
) {
  for (const row of rows) {
    mockDbReadSelect.mockImplementationOnce(() => statsQuery([row]))
  }
}

describe('agents routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(agentsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // 默认鉴权失败(checkAuth 发送 401 并返回 false)
    mockCheckAuth.mockImplementation((_req, reply) => {
      reply.status(401).send({ code: 401, message: 'Authentication required' })
      return Promise.resolve(false)
    })
    // 默认非管理员(requireAdmin 发送 403)
    mockRequireAdmin.mockImplementation((_req, reply) => {
      reply.status(403).send({ code: 403, message: '需要管理员权限' })
      return Promise.resolve()
    })
  })

  function authAs(userId = 'user-001', roleId = 0) {
    mockCheckAuth.mockImplementation((req, _reply) => {
      req.userId = userId
      req.jwtPayload = { userId, roleId } as never
      return Promise.resolve(true)
    })
  }

  function authAsAdmin(userId = 'admin-001') {
    authAs(userId, 1)
    mockRequireAdmin.mockImplementation((_req, _reply) => Promise.resolve())
  }

  describe('GET /api/agents/list', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/list' })
      expect(res.statusCode).toBe(401)
    })

    it('登录后返回 200 与列表', async () => {
      authAs()
      mockListAgents.mockResolvedValueOnce({
        list: [makeAgent()],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents/list?page=1&pageSize=20',
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(1)
      expect(mockListAgents).toHaveBeenCalled()
    })
  })

  describe('GET /api/agents/:agentId', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/agent-001' })
      expect(res.statusCode).toBe(401)
    })

    it('智能体不存在返回 404', async () => {
      authAs()
      mockGetAgentDetail.mockResolvedValueOnce(null)
      const res = await app.inject({ method: 'GET', url: '/api/agents/unknown' })
      expect(res.statusCode).toBe(404)
      expect(res.json().message).toContain('不存在')
    })

    it('存在的智能体返回 200', async () => {
      authAs()
      const agent = makeAgent()
      mockGetAgentDetail.mockResolvedValueOnce({ agent, category: null })
      const res = await app.inject({ method: 'GET', url: '/api/agents/agent-001' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.agentId).toBe('agent-001')
    })
  })

  describe('POST /api/agents/create', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/create',
        payload: { name: 'x' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('缺少 name 返回 400', async () => {
      authAs()
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/create',
        payload: { description: 'no name' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('name')
    })

    it('创建成功返回 200', async () => {
      authAs()
      mockCreateAgent.mockResolvedValueOnce(makeAgent())
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/create',
        payload: { name: '新智能体', status: 'offline' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.name).toBe('测试智能体')
      expect(mockCreateAgent).toHaveBeenCalled()
    })
  })

  describe('PUT /api/agents/:agentId', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agents/agent-001',
        payload: { name: 'updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('智能体不存在返回 404', async () => {
      authAs()
      mockUpdateAgent.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agents/unknown',
        payload: { name: 'updated' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('更新成功返回 200', async () => {
      authAs()
      mockUpdateAgent.mockResolvedValueOnce(makeAgent({ name: 'updated' }))
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agents/agent-001',
        payload: { name: 'updated' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.name).toBe('updated')
    })
  })

  describe('DELETE /api/agents/:agentId', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/agent-001' })
      expect(res.statusCode).toBe(401)
    })

    it('智能体不存在返回 404', async () => {
      authAs()
      mockDeleteAgent.mockResolvedValueOnce(null)
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/unknown' })
      expect(res.statusCode).toBe(404)
    })

    it('删除成功返回 200', async () => {
      authAs()
      mockDeleteAgent.mockResolvedValueOnce(makeAgent())
      const res = await app.inject({ method: 'DELETE', url: '/api/agents/agent-001' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.deleted).toBe(true)
    })
  })

  describe('GET /api/agents/health', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/health' })
      expect(res.statusCode).toBe(401)
    })

    it('登录后返回 200 与 status ok', async () => {
      authAs()
      const res = await app.inject({ method: 'GET', url: '/api/agents/health' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.status).toBe('ok')
      expect(body.data).toHaveProperty('timestamp')
    })
  })

  describe('GET /api/agents/stats', () => {
    it('市场统计公开:未登录可访问,返回 CLI 契约全部 6 字段', async () => {
      mockStatsRows([{ c: 10 }, { c: 7 }, { c: 3 }, { c: 5 }, { c: 42 }, { v: '4.50' }])
      const res = await app.inject({ method: 'GET', url: '/api/agents/stats' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      // 契约字段完整性(以 apps/cli/src/commands/agents.ts AgentStats 为准,一个不能缺)
      expect(body.data).toEqual({
        totalAgents: 10,
        totalCalls: 42,
        totalUsers: 5,
        avgRating: 4.5,
        publishedCount: 7,
        pendingCount: 3,
      })
      expect(Object.keys(body.data).sort()).toEqual(
        [
          'totalAgents',
          'totalCalls',
          'totalUsers',
          'avgRating',
          'publishedCount',
          'pendingCount',
        ].sort(),
      )
    })

    it('空表时各字段均回落为 0', async () => {
      mockStatsRows([{}, {}, {}, {}, {}, {}])
      const res = await app.inject({ method: 'GET', url: '/api/agents/stats' })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({
        totalAgents: 0,
        totalCalls: 0,
        totalUsers: 0,
        avgRating: 0,
        publishedCount: 0,
        pendingCount: 0,
      })
    })
  })

  describe('POST /api/agents/stats', () => {
    it('POST 为同契约别名:未登录可访问,字段与 GET 一致', async () => {
      mockStatsRows([{ c: 8 }, { c: 6 }, { c: 2 }, { c: 4 }, { c: 30 }, { v: '3.80' }])
      const res = await app.inject({ method: 'POST', url: '/api/agents/stats' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toEqual({
        totalAgents: 8,
        totalCalls: 30,
        totalUsers: 4,
        avgRating: 3.8,
        publishedCount: 6,
        pendingCount: 2,
      })
    })
  })

  describe('POST /api/agents/heat/generate', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/agents/heat/generate' })
      expect(res.statusCode).toBe(401)
    })

    it('非管理员返回 403', async () => {
      authAs('user-001', 0)
      const res = await app.inject({ method: 'POST', url: '/api/agents/heat/generate' })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })

    it('管理员触发返回 200', async () => {
      authAsAdmin()
      const res = await app.inject({ method: 'POST', url: '/api/agents/heat/generate' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data).toHaveProperty('weights')
      expect(body.data).toHaveProperty('generated_at')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
