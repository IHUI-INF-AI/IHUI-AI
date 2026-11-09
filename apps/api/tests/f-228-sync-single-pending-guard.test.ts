// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-228 残留口夹具:POST /settlement/sync-single/:buyRecordId 对 pending 订单
// 不得产生应付(agent_settlements.unsettled)。
//
// 改前:单条同步只查「记录存在」就插入 unsettled,批量同步的 status='active'
// 过滤没有覆盖这条路径 ⇒ 未支付先记账。
// 改后:非 active 返回 409 且 db.insert 零调用。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const state = vi.hoisted(() => ({
  inserts: 0,
  selects: [] as unknown[][],
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (_req: unknown, _reply: unknown, done: () => void) => done()),
  checkAuth: vi.fn(async (request: Record<string, unknown>) => {
    request.userId = 'admin-1'
    return true
  }),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async (request: { userId?: string; jwtPayload?: { roleId?: number } }) => {
    request.userId = 'admin-1'
    request.jwtPayload = { roleId: 1 }
  },
  isSystemAdmin: (request: { jwtPayload?: { roleId?: number } }) =>
    (request.jwtPayload?.roleId ?? 0) >= 1,
}))
vi.mock('../src/services/agent-service.js', () => ({
  getAgentDetail: vi.fn(),
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}))
vi.mock('../src/db/agents-queries.js', () => ({
  findExamineById: vi.fn(),
  updateExamine: vi.fn(),
  createSettlement: vi.fn(),
  findAgentByAgentId: vi.fn(),
  unpublishAgentByAgentId: vi.fn(),
  findAgentSuggestions: vi.fn(),
  updateAgentDetails: vi.fn(),
  deleteSettlements: vi.fn(),
  settleSettlement: vi.fn(),
}))

const chainOf = (rows: unknown[]) => {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  chain.limit = async () => rows
  return chain
}

vi.mock('../src/db/index.js', () => ({
  dbRead: {
    select: () => chainOf(state.selects.shift() ?? []),
  },
  db: {
    insert: () => ({
      values: () => {
        state.inserts += 1
        return Promise.resolve()
      },
    }),
  },
}))

const A_UUID = '123e4567-e89b-42d3-a456-426614174000'

let app: FastifyInstance

beforeAll(async () => {
  const { agentsRoutes } = await import('../src/routes/agents.js')
  app = Fastify()
  app.setErrorHandler((error, _request, reply) => {
    reply.send(error)
  })
  await app.register(agentsRoutes, { prefix: '/api' })
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  state.inserts = 0
  state.selects = []
})

const pendingBuy = {
  id: A_UUID,
  agentId: A_UUID,
  price: '9.90',
  status: 'pending',
}

describe('F-228 单条结算同步不许给 pending 订单记应付', () => {
  it('pending 订单 ⇒ 409 且零插入(改前 200 + 插入 1 条 unsettled)', async () => {
    state.selects = [[], [pendingBuy]]

    const res = await app.inject({
      method: 'POST',
      url: `/api/settlement/sync-single/${A_UUID}`,
    })

    expect(res.statusCode).toBe(409)
    expect(state.inserts).toBe(0)
  })

  it('active 订单照常同步(闸不误伤正当请求)', async () => {
    state.selects = [[], [{ ...pendingBuy, status: 'active' }]]

    const res = await app.inject({
      method: 'POST',
      url: `/api/settlement/sync-single/${A_UUID}`,
    })

    expect(res.statusCode).toBe(200)
    expect(state.inserts).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
