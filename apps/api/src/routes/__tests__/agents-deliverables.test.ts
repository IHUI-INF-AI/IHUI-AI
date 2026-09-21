// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27:会话级交付清单代理端点测试(GET /api/v1/ai/agents/sessions/:sessionId/deliverables)。
 *
 * 覆盖三态 + 认证:
 *  - ai-service 返回 200 + deliverables 对象 → 统一包装 { code:0, data:{ sessionId, deliverables } }
 *  - deliverables 为 null → 原样透传
 *  - ai-service 返回非 2xx / fetch 抛错(网络不可达) → 503
 *  - 插件级 preHandler 的 checkAuth 被调用(鉴权钩子生效)
 *
 * agents.ts 依赖链(db/表/服务层/鉴权)全部 mock,避免拉起真实连接与 workspace 包。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockCheckAuth, mockAiServiceFetch } = vi.hoisted(() => ({
  mockCheckAuth: vi.fn(async () => true),
  mockAiServiceFetch: vi.fn(),
}))

// 鉴权插件 mock:checkAuth 默认放行(插件级 preHandler 对 /api/v1/ai/... 自动生效)
vi.mock('../../plugins/auth.js', () => ({ checkAuth: mockCheckAuth }))
vi.mock('../../plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

// db mock:通用链式 builder(then-able,agents.ts 各 handler 内的查询不会在注册期执行)
vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
    dbRead: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
    },
  }
})

// @ihui/database 表对象:agents.ts 解构的表仅作为查询 builder 入参,注册期不触达
vi.mock('@ihui/database', () => ({
  agents: {},
  zhsAgentBuy: {},
  agentSettlements: {},
  zhsAgentNeedTask: {},
  agentExamines: {},
  agentBillings: {},
  agentCallbacks: {},
  agentUseDetails: {},
  agentReviews: {},
}))

// 服务层 / 查询层 mock(agents.ts 顶层解构的名字全量覆盖)
vi.mock('../../services/agent-service.js', () => ({
  getAgentDetail: vi.fn(),
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))
// agents-queries / oauth-queries mock:显式覆盖 agents.ts 顶层解构的全部函数名
vi.mock('../../db/agents-queries.js', () => ({
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
vi.mock('../../db/oauth-queries.js', () => ({
  listOAuthApps: vi.fn(),
  findAuditLogList: vi.fn(),
  findAuditLogStats: vi.fn(),
  findOAuthAppByClientId: vi.fn(),
  createOAuthApp: vi.fn(),
  updateOAuthApp: vi.fn(),
  deleteOAuthApp: vi.fn(),
  regenerateOAuthAppSecret: vi.fn(),
  listActiveScopeMeta: vi.fn(),
}))

// @ihui/shared:避免真实导入 workspace 包(仓库既有 vitest 退出码问题)
vi.mock('@ihui/shared', () => ({ toUserFriendlyMessage: vi.fn((e: unknown) => String(e)) }))

// D27 核心:ai-service 网关 fetch mock(控制三态)
vi.mock('../../utils/ai-service-fetch.js', () => ({ aiServiceSystemFetch: mockAiServiceFetch }))

import { agentsRoutes } from '../agents.js'

/** 构造 aiServiceSystemFetch 的 Response 形状(手工对象,不依赖全局 Response) */
function fakeUpstream(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

describe('D27 代理端点 GET /api/v1/ai/agents/sessions/:sessionId/deliverables', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false, pluginTimeout: 120_000 })
    // 与生产注册一致(index.ts 以 { prefix: '/api' } 挂载 agentsRoutes)
    await app.register(agentsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckAuth.mockImplementation(async () => true)
  })

  it('ai-service 返回 deliverables 对象 → 200 包装 { sessionId, deliverables },checkAuth 生效', async () => {
    const deliverables = {
      citations: [{ source: 'wiki', label: '部署指南', url: '/repo-wiki' }],
      filesChanged: [{ path: 'a.ts', kind: 'add', stepIds: ['c1'], additions: 2, deletions: 0 }],
      toolsSummary: { total: 1, byTool: { write_file: 1 } },
      outputSummary: '摘要',
      generatedAt: '2026-09-20T00:00:00.000Z',
    }
    mockAiServiceFetch.mockResolvedValueOnce(fakeUpstream({ session_id: 'sess-1', deliverables }))
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/agents/sessions/sess-1/deliverables',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ sessionId: 'sess-1', deliverables })
    // 鉴权钩子与上游调用均按预期发生
    expect(mockCheckAuth).toHaveBeenCalled()
    expect(mockAiServiceFetch).toHaveBeenCalledWith('/api/agents/sessions/sess-1/deliverables', {
      method: 'GET',
    })
  })

  it('ai-service 返回 deliverables=null → 原样透传,不报错', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(
      fakeUpstream({ session_id: 'sess-2', deliverables: null }),
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/agents/sessions/sess-2/deliverables',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ sessionId: 'sess-2', deliverables: null })
  })

  it('ai-service 返回非 2xx(resp.ok=false) → 503', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(fakeUpstream('upstream boom', false, 500))
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/agents/sessions/sess-3/deliverables',
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.code).toBe(503)
    expect(body.message).toContain('AI service unavailable')
    expect(body.message).toContain('upstream boom')
  })

  it('ai-service fetch 抛错(网络不可达) → 503', async () => {
    mockAiServiceFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/agents/sessions/sess-4/deliverables',
    })
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe(503)
    expect(res.json().message).toContain('connect ECONNREFUSED')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
