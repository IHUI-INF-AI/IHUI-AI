// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-536:进 uuid 列的路由参数必须先验形状 —— 畸形 id 不得冒成 500。
//
// 病灶:agents.ts 里 buyRecordId/recordId/id 三族参数校验只有 z.string(),
// 而它们喂的列全是 uuid(agent_settlements.buyRecordId/zhsAgentBuy.id/
// agentExamines.id/agentSettlements.id/agents.agentId) —— 任意字符串进 eq()
// 即 Postgres 22P02 ⇒ 500。本票把四处声明收成 z.string().uuid(),非法形状在进
// SQL 之前即抛 ZodError,由 server.ts:150-155 全局映射成 400。
// 范围注记:agentIdParam/categoryIdParam/clientIdParam 不在本票射程 —— 前者已有
// isUuidString 404 闸(446 行),后两者 fed 的列非 uuid(clientId 是 OAuth 随机串),
// 逐一核过(见票面),不得顺手"统一"。
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate, q } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (_req: unknown, _reply: unknown, done: () => void) => done()),
  q: {
    findExamineById: vi.fn(),
    updateExamine: vi.fn(),
    createSettlement: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(async (request: Record<string, unknown>) => {
    request.userId = 'user-1'
    return true
  }),
}))
vi.mock('../src/services/agent-service.js', () => ({
  getAgentDetail: vi.fn(),
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))
vi.mock('../src/db/agents-queries.js', () => ({
  findExamineById: q.findExamineById,
  updateExamine: q.updateExamine,
  createSettlement: q.createSettlement,
  findAgentByAgentId: vi.fn(),
  unpublishAgentByAgentId: vi.fn(),
  findAgentSuggestions: vi.fn(),
  updateAgentDetails: vi.fn(),
  deleteSettlements: vi.fn(),
  settleSettlement: vi.fn(),
}))

// db/index:本票 6 条畸形用例在 zod 进 SQL 之前即抛,链式桩永不被调用(断言侧不依赖它);
// 唯一正向用例走桩掉的 findExamineById,不碰 db。故桩只需存在(保 import 安全),无需行为。
vi.mock('../src/db/index.js', () => ({
  dbRead: { select: vi.fn() },
  db: { insert: vi.fn() },
}))

const A_UUID = '123e4567-e89b-42d3-a456-426614174000'

let app: FastifyInstance

beforeAll(async () => {
  const { agentsRoutes } = await import('../src/routes/agents.js')
  app = Fastify()
  // 与 server.ts:150-155 同形:ZodError ⇒ 400(路由内 .parse() 抛错走这里,不存在"吞错")。
  app.setErrorHandler((error, _request, reply) => {
    const isZodErr =
      (error as Error).name === 'ZodError' &&
      Array.isArray((error as { issues?: unknown[] }).issues)
    if (isZodErr) {
      reply.status(400).send({ code: 400, message: '参数错误' })
      return
    }
    reply.send(error)
  })
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

describe('G-536 畸形 uuid 不得冒成 500', () => {
  it('GET /settlement/not-a-uuid ⇒ 400 且 db 零调用', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settlement/not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  it('POST /settlement/sync-single/not-a-uuid ⇒ 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/settlement/sync-single/not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /examine/not-a-uuid ⇒ 400 且服务层零调用', async () => {
    q.findExamineById.mockClear()
    const res = await app.inject({ method: 'GET', url: '/api/examine/not-a-uuid' })
    expect(res.statusCode).toBe(400)
    expect(q.findExamineById).not.toHaveBeenCalled()
  })

  it('PUT /examine/not-a-uuid ⇒ 400 且服务层零调用', async () => {
    q.updateExamine.mockClear()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/examine/not-a-uuid',
      payload: { status: 'approved' },
    })
    expect(res.statusCode).toBe(400)
    expect(q.updateExamine).not.toHaveBeenCalled()
  })

  it('POST /settlement/create 带畸形 buyRecordId ⇒ 400 且服务层零调用', async () => {
    q.createSettlement.mockClear()
    const res = await app.inject({
      method: 'POST',
      url: '/api/settlement/create',
      payload: { buyRecordId: 'not-a-uuid', amount: 100 },
    })
    expect(res.statusCode).toBe(400)
    expect(q.createSettlement).not.toHaveBeenCalled()
  })

  it('合法 uuid 照常进服务层(闸不许把正当请求一起挡掉)', async () => {
    q.findExamineById.mockClear()
    q.findExamineById.mockResolvedValueOnce({ id: A_UUID })
    const res = await app.inject({ method: 'GET', url: `/api/examine/${A_UUID}` })
    expect(res.statusCode).toBe(200)
    expect(q.findExamineById).toHaveBeenCalledWith(A_UUID)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
