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

/**
 * 夹具 id 必须是**合法 uuid** —— 这不是迁就实现,而是这两条事实的合取:
 *  ① `agents.agent_id` 是 uuid 主键列(`packages/database/src/schema/agents-extended.ts:34`
 *     `uuid('agent_id').defaultRandom().primaryKey()`),所以真实世界里根本不存在 'agent-001' 这种 id;
 *  ② 详情/更新/删除三端点在进 SQL 之前有一道形状闸(`agents.ts:332` / `:383` / `:408`,由提交
 *     `cc6a1d1ce7`(2026-09-28)立,唯一判据 `apps/api/src/utils/uuid.ts` 的 `isUuidString`)——
 *     它拦的是"游客可访问的路由把 'carousel' 喂进 uuid 列 ⇒ Postgres 22P02 ⇒ 回 **500**",
 *     闸本身有专属套件 `apps/api/tests/agent-detail-malformed-id.test.ts` 钉着(含"合法 uuid
 *     仍进服务层"的反向对照),所以它是**被证明过的产品行为**,不是这次要修的缺陷。
 *
 * 旧夹具 'agent-001' / 'unknown' 全部撞在闸上 ⇒ 服务层一次都没被调用:
 * 读侧两枚"恰好也回 404"的用例(游客读未发布 / 智能体不存在)是**绿着错**——名字里的语义
 * 一条没测;写侧四枚直接红。修法是让夹具回到真实形状,并把"这一支到底走没走到服务层"
 * 用 `toHaveBeenCalled*` 钉死(只断言状态码会同时放过"闸产出 404"与"服务层产出 404"两种写法)。
 */
const AGENT_ID = '7c9e6679-7425-40de-983b-e5c1c0d0a1b2' // 形状合法(version 4 / variant 9)
const MISSING_AGENT_ID = '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0' // 同样合法,但服务层查无此行
const MALFORMED_ID = 'carousel' // 不是 uuid:必须被形状闸拦下,且一次都不进服务层

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    agentId: AGENT_ID,
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
    // 2026-09-21 市场公开化:列表对游客开放,但 handler 必须强制 status=published、
    // 忽略游客传的 userId/status 过滤,并脱敏。原"未登录返回 401"停留在该决策之前。
    it('游客列表返回 200,强制 published 且逐条脱敏', async () => {
      mockListAgents.mockResolvedValueOnce({
        list: [makeAgent({ agentPrompt: '私有提示词', botId: 'bot-secret' })],
        total: 1,
        page: 1,
        pageSize: 20,
      })
      const res = await app.inject({ method: 'GET', url: '/api/agents/list?status=draft' })
      expect(res.statusCode).toBe(200)
      expect(mockListAgents).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published', userId: undefined }),
      )
      expect(res.json().data.list[0].agentPrompt).toBeUndefined()
      expect(res.json().data.list[0].botId).toBeUndefined()
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
    // 2026-09-21 市场公开化:GET /agents/:agentId 对游客开放,但只允许已发布且必须脱敏。
    // 原断言"未登录返回 401"停留在该决策之前,故改为断言现在的契约(并顺带把脱敏钉住)。
    //
    // 正向对照(本组三枚 404 的另一半):合法 uuid 且已发布 ⇒ 必须仍回 200 且脱敏 ——
    // 只留反向那一半的话,闸可能只是把功能改坏了而账面全绿。
    it('游客读已发布详情返回 200 且响应脱敏', async () => {
      mockGetAgentDetail.mockResolvedValueOnce({
        agent: makeAgent({ status: 'published', agentPrompt: '私有提示词', botId: 'bot-secret' }),
        category: null,
      })
      const res = await app.inject({ method: 'GET', url: `/api/agents/${AGENT_ID}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      // 成功分支的身份:统一契约 code=0 / message='success'(utils/response.ts 的 success())
      expect(body.code).toBe(0)
      expect(body.message).toBe('success')
      expect(body.data.name).toBe('测试智能体')
      expect(body.data.agentId).toBe(AGENT_ID)
      expect(body.data.agentPrompt).toBeUndefined()
      expect(body.data.botId).toBeUndefined()
      // 私有字段不得以任意形态漏出(整串兜底,防"换个键名再漏")
      expect(JSON.stringify(body)).not.toContain('私有提示词')
      expect(JSON.stringify(body)).not.toContain('bot-secret')
      // 闸不许把正当请求一起挡掉:这一枚必须真的进了服务层
      expect(mockGetAgentDetail).toHaveBeenCalledTimes(1)
      expect(mockGetAgentDetail).toHaveBeenCalledWith(AGENT_ID)
    })

    it('游客读未发布详情返回 404(不因公开化而泄露草稿)', async () => {
      mockGetAgentDetail.mockResolvedValueOnce({
        agent: makeAgent({ status: 'draft' }),
        category: null,
      })
      const res = await app.inject({ method: 'GET', url: `/api/agents/${AGENT_ID}` })
      expect(res.statusCode).toBe(404)
      // 这一支的 404 必须由 `agents.ts:338`(服务层查到行、但游客不可见未发布)产出,
      // 而不是由 `agents.ts:332` 的形状闸产出 —— 两者响应体逐字同形,状态码分不出,
      // 所以唯一可判的证据是服务层被调用过。
      expect(mockGetAgentDetail).toHaveBeenCalledTimes(1)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toBe('智能体不存在')
      expect(body.data).toBeUndefined()
      expect(JSON.stringify(body)).not.toContain('draft')
      expect(JSON.stringify(body)).not.toContain(AGENT_ID)
    })

    it('智能体不存在返回 404(合法 uuid,由服务层的 null 产出)', async () => {
      authAs()
      mockGetAgentDetail.mockResolvedValueOnce(null)
      const res = await app.inject({ method: 'GET', url: `/api/agents/${MISSING_AGENT_ID}` })
      expect(res.statusCode).toBe(404)
      expect(mockGetAgentDetail).toHaveBeenCalledTimes(1)
      expect(mockGetAgentDetail).toHaveBeenCalledWith(MISSING_AGENT_ID)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toContain('不存在')
    })

    it('存在的智能体返回 200', async () => {
      authAs()
      const agent = makeAgent()
      mockGetAgentDetail.mockResolvedValueOnce({ agent, category: null })
      const res = await app.inject({ method: 'GET', url: `/api/agents/${AGENT_ID}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.agentId).toBe(AGENT_ID)
      expect(mockGetAgentDetail).toHaveBeenCalledTimes(1)
    })

    // 形状闸本身(读侧):非 uuid 的一段不得冒成 500,也不得进服务层。
    // **同形设计(刻意,不是巧合)**:畸形 id / 查无此行 / 未发布对游客,三者在读侧回
    // **同一个 code 与同一句 message**(`agents.ts:332/:335/:338` 三处都是
    // `error(404, '智能体不存在')`)—— 读侧一旦区分"形状不对"与"没有",响应就变成了
    // 存在性预言机(AGENTS §5"两条同形的拒绝口径");所以这里断言"必须同形",
    // 而不是断言它能区分。区分归属由上面两枚用例的 `toHaveBeenCalled` 负责。
    it('畸形 id(非 uuid)⇒ 404 且服务层零调用(与"不存在"刻意同形)', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/agents/${MALFORMED_ID}` })
      expect(res.statusCode).toBe(404)
      expect(mockGetAgentDetail).not.toHaveBeenCalled()
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toBe('智能体不存在')
      // 不得把"形状不对"这件事从读侧漏出来(那等于给畸形输入开了一个存在性旁路)
      expect(JSON.stringify(body)).not.toContain('格式')
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
        url: `/api/agents/${AGENT_ID}`,
        payload: { name: 'updated' },
      })
      expect(res.statusCode).toBe(401)
      expect(mockUpdateAgent).not.toHaveBeenCalled()
    })

    it('智能体不存在返回 404(合法 uuid,由服务层的 null 产出)', async () => {
      authAs()
      mockUpdateAgent.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agents/${MISSING_AGENT_ID}`,
        payload: { name: 'updated' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      // 这一支必须真的走到服务层(否则 404 可能来自闸,而闸的 400/404 与本契约不是一回事)
      expect(mockUpdateAgent).toHaveBeenCalledTimes(1)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toBe('智能体不存在')
    })

    it('更新成功返回 200', async () => {
      authAs()
      mockUpdateAgent.mockResolvedValueOnce(makeAgent({ name: 'updated' }))
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agents/${AGENT_ID}`,
        payload: { name: 'updated' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.name).toBe('updated')
      expect(body.data.agentId).toBe(AGENT_ID)
      // 属主必须由路由把令牌主体交给服务层,不得由请求体自报
      // (`agents.ts:400` `updateAgent(agentId, body.data, request.userId)`)
      expect(mockUpdateAgent).toHaveBeenCalledWith(
        AGENT_ID,
        expect.objectContaining({ name: 'updated' }),
        'user-001',
      )
    })

    // body 校验(写侧):合法 uuid + 类型不符的字段 ⇒ 400 的身份必须是"参数错误",
    // 而不是形状闸那条 —— 只断状态码时,把 body 校验整段删掉这条也不会红。
    it('body 字段类型不符 ⇒ 400 参数错误且服务层零调用(合法 uuid 已排除形状闸)', async () => {
      authAs()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agents/${AGENT_ID}`,
        payload: { name: 'updated', price: 'not-a-number' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toBe('参数错误')
      // 两条 400 必须分家:这一支的 id 是合法 uuid,闸结构上不可能产出它
      expect(body.message).not.toBe('agentId 格式不正确')
      expect(mockUpdateAgent).not.toHaveBeenCalled()
    })

    // 形状闸(写侧):畸形 id 是客户端错误 ⇒ 400,且一次都不进服务层。
    // **写侧与读侧刻意不同形**:400 只说明"你给的根本不是 id 形状"(不含存在性信息),
    // 而 404 才携带存在性,所以读侧把三种成因收敛成同一条消息、写侧不必(见 agents.ts:382 注释)。
    it('畸形 id(非 uuid)⇒ 400 且服务层零调用', async () => {
      authAs()
      const res = await app.inject({
        method: 'PUT',
        url: `/api/agents/${MALFORMED_ID}`,
        payload: { name: 'updated' },
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(mockUpdateAgent).not.toHaveBeenCalled()
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toBe('agentId 格式不正确')
      // 不得与"参数错误"(body schema 失败,`agents.ts:399`)混成一条 —— 两者身份不同
      expect(body.message).not.toBe('参数错误')
    })
  })

  describe('DELETE /api/agents/:agentId', () => {
    it('未登录返回 401', async () => {
      const res = await app.inject({ method: 'DELETE', url: `/api/agents/${AGENT_ID}` })
      expect(res.statusCode).toBe(401)
      expect(mockDeleteAgent).not.toHaveBeenCalled()
    })

    it('智能体不存在返回 404(合法 uuid,由服务层的 null 产出)', async () => {
      authAs()
      mockDeleteAgent.mockResolvedValueOnce(null)
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/agents/${MISSING_AGENT_ID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(404)
      expect(mockDeleteAgent).toHaveBeenCalledTimes(1)
      const body = res.json()
      expect(body.code).toBe(404)
      expect(body.message).toBe('智能体不存在')
    })

    it('删除成功返回 200', async () => {
      authAs()
      mockDeleteAgent.mockResolvedValueOnce(makeAgent())
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/agents/${AGENT_ID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.deleted).toBe(true)
      // 同 PUT:属主取令牌主体并交给服务层(`agents.ts:409`)
      expect(mockDeleteAgent).toHaveBeenCalledWith(AGENT_ID, 'user-001')
    })

    it('畸形 id(非 uuid)⇒ 400 且服务层零调用', async () => {
      authAs()
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/agents/${MALFORMED_ID}`,
        headers: { authorization: 'Bearer t' },
      })
      expect(res.statusCode).toBe(400)
      expect(mockDeleteAgent).not.toHaveBeenCalled()
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toBe('agentId 格式不正确')
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
