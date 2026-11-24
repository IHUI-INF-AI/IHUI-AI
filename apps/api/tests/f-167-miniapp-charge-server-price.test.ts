// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-167 夹具:小程序 /agents/charge 三个端点不得由客户端定价/自封 active,
// 且扣币成功必须激活待支付订单并生成结算。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mocks, state } = vi.hoisted(() => ({
  mocks: {
    deductToken: vi.fn(),
    syncSettlement: vi.fn(),
  },
  state: {
    readQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
    insertValues: [] as Array<Record<string, unknown>>,
    updateQueue: [] as unknown[][],
    updateSets: [] as Array<Record<string, unknown>>,
  },
}))

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const AGENT_ID = '11111111-1111-4111-8111-111111111111'
const BUY_ID = '22222222-2222-4222-8222-222222222222'
const FLOW_ID = 'flow-1'

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = USER_ID
    return true
  },
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => undefined,
}))
vi.mock('../src/db/commission-queries.js', () => ({
  deductToken: mocks.deductToken,
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: mocks.syncSettlement,
}))

vi.mock('../src/db/index.js', () => {
  function readChain(): Record<string, unknown> {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'from', 'where', 'orderBy']) c[m] = () => c
    const take = () => Promise.resolve(state.readQueue.shift() ?? [])
    c.limit = take
    c.then = (resolve: (v: unknown) => unknown) => take().then(resolve)
    return c
  }
  function insertChain(): Record<string, unknown> {
    const c: Record<string, unknown> = {}
    c.values = (values: Record<string, unknown>) => {
      state.insertValues.push(values)
      return c
    }
    c.returning = () => Promise.resolve(state.insertQueue.shift() ?? [])
    return c
  }
  function updateChain(): Record<string, unknown> {
    const c: Record<string, unknown> = {}
    c.set = (values: Record<string, unknown>) => {
      state.updateSets.push(values)
      return c
    }
    c.where = () => c
    c.returning = () => Promise.resolve(state.updateQueue.shift() ?? [])
    return c
  }
  const dbMock = {
    select: readChain,
    insert: insertChain,
    update: updateChain,
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { miniappCompatRoutes } from '../src/routes/miniapp-compat-routes.js'

const errorHandler = (
  err: Error & { name?: string; issues?: Array<{ message?: string }>; statusCode?: number },
  _req: unknown,
  reply: { status: (code: number) => { send: (body: unknown) => void }; sent?: boolean },
): void => {
  if (reply.sent) return
  const isZod = err.name === 'ZodError' && Array.isArray(err.issues)
  const statusCode = isZod
    ? 400
    : typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500
  reply.status(statusCode).send({
    code: statusCode,
    message: isZod ? (err.issues?.[0]?.message ?? '参数错误') : (err.message ?? '服务器错误'),
  })
}

describe('F-167 小程序智能体收费', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.setErrorHandler(errorHandler as never)
    await app.register(miniappCompatRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    state.readQueue.length = 0
    state.insertQueue.length = 0
    state.insertValues.length = 0
    state.updateQueue.length = 0
    state.updateSets.length = 0
    mocks.syncSettlement.mockResolvedValue(true)
  })

  it('POST 忽略客户端 price,按 agents.price 落库(分→元)', async () => {
    state.readQueue.push([{ price: 9900, isFree: false }])
    state.insertQueue.push([{ id: BUY_ID }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/charge',
      payload: { agentId: AGENT_ID, price: 0, duration: 7 },
    })

    expect(res.statusCode).toBe(200)
    expect(state.insertValues).toHaveLength(1)
    expect(state.insertValues[0]?.price).toBe('99.00')
    expect(state.insertValues[0]?.status).toBe('pending')
    // 变异自证:恢复 price: body.price.toString() 后,这里会拿到 '0' 而翻红。
  })

  it('POST 智能体不存在 ⇒ 404,不落收费记录', async () => {
    state.readQueue.push([])

    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/charge',
      payload: { agentId: AGENT_ID, duration: 7 },
    })

    expect(res.statusCode).toBe(404)
    expect(state.insertValues).toHaveLength(0)
  })

  it('POST 时长超过上限 ⇒ 400,不落收费记录', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/charge',
      payload: { agentId: AGENT_ID, duration: 3651 },
    })

    expect(res.statusCode).toBe(400)
    expect(state.insertValues).toHaveLength(0)
  })

  it('PUT 不得自封 status、改价或改时长', async () => {
    state.readQueue.push([{ id: BUY_ID }])
    state.updateQueue.push([{ id: BUY_ID, status: 'pending' }])

    const res = await app.inject({
      method: 'PUT',
      url: '/api/agents/charge',
      payload: {
        id: BUY_ID,
        status: 'active',
        price: 0,
        duration: 3650,
        paymentMethod: 'wxpay',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(state.updateSets).toHaveLength(1)
    const set = state.updateSets[0]!
    expect(set.status).toBeUndefined()
    expect(set.price).toBeUndefined()
    expect(set.duration).toBeUndefined()
    expect(set.expiresAt).toBeUndefined()
    expect(set.paymentMethod).toBe('wxpay')
    // 变异自证:恢复 schema 的 status/price/duration 后,三个字段会进入 SET 而翻红。
  })

  it('pay-history 扣币成功后激活 pending 订单并同步结算', async () => {
    const pending = {
      id: BUY_ID,
      agentId: AGENT_ID,
      userId: USER_ID,
      price: '99.00',
      duration: 30,
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-01-31T00:00:00Z'),
      paymentMethod: null,
      paymentId: null,
    }
    mocks.deductToken.mockResolvedValue({ balanceAfter: 40, flowId: FLOW_ID })
    state.readQueue.push([pending])
    state.updateQueue.push([{ ...pending, status: 'active', paymentId: FLOW_ID }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/charge/pay-history',
      payload: { agentId: AGENT_ID, quantity: 10 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.activeBuyId).toBe(BUY_ID)
    expect(state.updateSets[0]?.status).toBe('active')
    expect(mocks.syncSettlement).toHaveBeenCalledTimes(1)
    expect(mocks.syncSettlement.mock.calls[0]?.[0]).toMatchObject({
      id: BUY_ID,
      status: 'active',
    })
    // 变异自证:删掉激活块后,activeBuyId 不存在、updateSets 为空、settlement 未被调用。
  })

  it('pay-history 扣币失败 ⇒ 402,不激活任何订单', async () => {
    mocks.deductToken.mockRejectedValue(new Error('Token 余额不足'))
    state.readQueue.push([{ id: BUY_ID, status: 'pending' }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/agents/charge/pay-history',
      payload: { agentId: AGENT_ID, quantity: 10 },
    })

    expect(res.statusCode).toBe(402)
    expect(state.updateSets).toHaveLength(0)
    expect(mocks.syncSettlement).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
