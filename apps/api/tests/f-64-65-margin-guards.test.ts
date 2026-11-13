// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-64 / F-65:/finance/margin/* 资金面守卫。
 *
 * F-64 退款方向与幂等键:
 *  · 退款必须显式指定目标账户,不得落到操作者(管理员)自己;
 *  · 退款走独立 opType=3 + related_order_no=`refund:<orderNo>`,与充值的
 *    (orderNo, opType=0) 幂等键互不干扰;
 *  · 订单归属与金额都要校验。
 * F-65 数量守卫:
 *  · 负数 / 0 / 小数 / 非数字一律 400,不得进入资金查询层;
 *  · 目标账户可由参数指定,缺省仍是调用者。
 *
 * 模式沿用 o13b-batch2-admingate-contract.test.ts:真实路由 + mock 鉴权与 db,
 * 不连真实数据库。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  // 列 stub:真实 drizzle 的 eq()/select({...}) 只做 SQL 拼装,不会被执行(mock db)
  const orders = { orderNo: 'order_no', status: 'status', userId: 'user_id', amount: 'amount' }
  const userMargins = { userId: 'user_id', tokenQuantity: 'token_quantity' }
  const tokenFlows = { id: 'id', userId: 'user_id', relatedOrderNo: 'related_order_no' }
  const commissionFlows = { beneficiaryId: 'beneficiary_id' }
  const withdrawalFlows = { id: 'id', status: 'status' }
  const identityProportions = {}
  const users = { id: 'id' }

  const state = {
    orderRow: null as null | Record<string, unknown>,
    margin: { tokenQuantity: 100 } as Record<string, unknown>,
    inserted: [] as Array<Record<string, unknown>>,
  }

  const tableChain = (table: unknown) => ({
    limit: async () =>
      table === orders ? (state.orderRow ? [state.orderRow] : []) : [state.margin],
    for: () => ({ limit: async () => [state.margin] }),
  })

  const selectImpl = () => ({
    from: (table: unknown) => ({ where: () => tableChain(table) }),
  })

  const insertImpl = () => ({
    values: async (v: Record<string, unknown>) => {
      state.inserted.push(v)
    },
  })

  // update().set().where() 既可被 await(退款扣回),也可 .returning()(充值)
  const updateImpl = () => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ tokenQuantity: 110 }],
        then: (resolve: (v: unknown[]) => void) => Promise.resolve([]).then(resolve),
      }),
    }),
  })

  const tx = { select: vi.fn(selectImpl), insert: vi.fn(insertImpl), update: vi.fn(updateImpl) }

  const db = {
    select: vi.fn(selectImpl),
    insert: vi.fn(insertImpl),
    update: vi.fn(updateImpl),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  }

  return {
    orders,
    userMargins,
    tokenFlows,
    commissionFlows,
    withdrawalFlows,
    identityProportions,
    users,
    state,
    db,
  }
})

const { mockAuthenticate, mockRequireAdmin } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRequireAdmin: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
  ADMIN_ROLE_ID: 1,
}))

vi.mock('../src/db/index.js', () => ({
  db: h.db,
  dbRead: { select: vi.fn(), execute: vi.fn() },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  orders: h.orders,
  userMargins: h.userMargins,
  tokenFlows: h.tokenFlows,
  commissionFlows: h.commissionFlows,
  withdrawalFlows: h.withdrawalFlows,
  identityProportions: h.identityProportions,
  users: h.users,
}))

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  rechargeToken: vi.fn(),
  deductToken: vi.fn(),
  refundTokenDeduct: vi.fn(),
  expireToken: vi.fn(),
  listTokenFlows: vi.fn(),
  listCommissionFlows: vi.fn(),
  commissionSummary: vi.fn(),
  applyWithdrawal: vi.fn(),
  approveWithdrawal: vi.fn(),
  rejectWithdrawal: vi.fn(),
  listWithdrawals: vi.fn(),
  withdrawalSummary: vi.fn(),
  availableWithdrawal: vi.fn(),
  listSubordinates: vi.fn(),
  teamCenter: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => mocks)

import { financeRoutes } from '../src/routes/finance.js'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_ID = '33333333-3333-4333-8333-333333333333'
const ORDER_NO = 'ORD-20261113-0001'

interface MockAuthRequest {
  userId?: string
}

describe('F-64/F-65 /finance/margin/* 资金面守卫', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    h.state.orderRow = null
    h.state.margin = { tokenQuantity: 100 }
    h.state.inserted.length = 0
    mockAuthenticate.mockImplementation(async (request: MockAuthRequest) => {
      request.userId = ADMIN_ID
    })
    mockRequireAdmin.mockImplementation(async (request: MockAuthRequest) => {
      request.userId = ADMIN_ID
    })
    mocks.deductToken.mockResolvedValue(50)
    mocks.rechargeToken.mockResolvedValue(130)
    mocks.refundTokenDeduct.mockResolvedValue(70)
    mocks.expireToken.mockResolvedValue(0)
    if (!app) {
      app = Fastify({ logger: false })
      await app.register(financeRoutes, { prefix: '/api' })
      await app.ready()
    }
  })

  afterAll(async () => {
    await app?.close()
  })

  describe('F-65 数量守卫:负数/0/小数/非数字一律拒绝', () => {
    const bad = ['-100', '0', '1.5', 'abc', 'NaN', 'Infinity']

    for (const quantity of bad) {
      it(`deduct quantity=${quantity} → 400 且不触达资金查询层`, async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/finance/margin/deduct?quantity=${quantity}`,
        })
        expect(res.statusCode).toBe(400)
        expect(mocks.deductToken).not.toHaveBeenCalled()
      })
    }

    it('recharge quantity=-1 → 400 且不触达资金查询层', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/recharge?quantity=-1&outTradeNo=${ORDER_NO}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.rechargeToken).not.toHaveBeenCalled()
    })

    it('expire quantity=0.5 → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/margin/expire?quantity=0.5',
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.expireToken).not.toHaveBeenCalled()
    })

    it('commission quantity=-1000000 → 400(不再反向铸币)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/margin/commission?quantity=-1000000',
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.rechargeToken).not.toHaveBeenCalled()
    })

    it('refund quantity=-100 → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=-100&orderNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })
  })

  describe('F-65 目标账户:参数指定,缺省仍是调用者', () => {
    it('deduct 指定 userId → 扣的是目标账户', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/deduct?quantity=100&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(200)
      expect(mocks.deductToken).toHaveBeenCalledWith(TARGET_ID, 100, '')
    })

    it('deduct 未指定 userId → 仍是调用者(文档口径不变)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/margin/deduct?quantity=10',
      })
      expect(res.statusCode).toBe(200)
      expect(mocks.deductToken).toHaveBeenCalledWith(ADMIN_ID, 10, '')
    })

    it('commission 用 invitedUserId 作为入账目标', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/commission?quantity=500&invitedUserId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(200)
      expect(mocks.rechargeToken).toHaveBeenCalledWith(TARGET_ID, 500, undefined, 'invite')
    })

    it('deduct userId 非 uuid → 400(不让 22P02 变 500)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/margin/deduct?quantity=10&userId=not-a-uuid',
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.deductToken).not.toHaveBeenCalled()
    })

    it('非管理员 → 403 且不触达资金查询层', async () => {
      mockRequireAdmin.mockImplementationOnce(async (_request, reply) => {
        reply.status(403).send({ code: 403, message: '需要管理员权限' })
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/margin/deduct?quantity=10',
      })
      expect(res.statusCode).toBe(403)
      expect(mocks.deductToken).not.toHaveBeenCalled()
    })
  })

  describe('F-64 退款:目标必须显式指定且不得是操作者', () => {
    it('缺 userId → 400(不再默认操作者)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=100&orderNo=${ORDER_NO}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })

    it('userId 等于操作者 → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=100&orderNo=${ORDER_NO}&userId=${ADMIN_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })

    it('正常退款 → 扣目标账户,且不走充值幂等通道', async () => {
      h.state.orderRow = { status: 'paid', userId: TARGET_ID, amount: 10000 }
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=300&orderNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual({ balance: 70 })
      expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(TARGET_ID, 300, ORDER_NO, undefined)
      // 关键回归:退款绝不能再走 rechargeToken(那会把 token 加给操作者)
      expect(mocks.rechargeToken).not.toHaveBeenCalled()
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalledWith(
        ADMIN_ID,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      )
    })
  })

  describe('F-64 退款:订单归属与金额校验', () => {
    it('订单不存在 → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=100&orderNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })

    it('订单归属与目标账户不符 → 403', async () => {
      h.state.orderRow = { status: 'paid', userId: OTHER_ID, amount: 10000 }
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=100&orderNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(403)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })

    it('退款数量超过原单金额 → 400', async () => {
      h.state.orderRow = { status: 'paid', userId: TARGET_ID, amount: 100 }
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/refund?quantity=101&orderNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    })
  })

  describe('F-65 充值:目标账户与订单归属/金额一致', () => {
    it('目标账户与订单归属不符 → 403', async () => {
      h.state.orderRow = { status: 'paid', userId: OTHER_ID, amount: 10000 }
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/recharge?quantity=100&outTradeNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(403)
      expect(mocks.rechargeToken).not.toHaveBeenCalled()
    })

    it('充值数量超过订单金额 → 400(小额已支付单不能充大额)', async () => {
      h.state.orderRow = { status: 'paid', userId: TARGET_ID, amount: 1 }
      const res = await app.inject({
        method: 'POST',
        url: `/api/finance/margin/recharge?quantity=1000000000&outTradeNo=${ORDER_NO}&userId=${TARGET_ID}`,
      })
      expect(res.statusCode).toBe(400)
      expect(mocks.rechargeToken).not.toHaveBeenCalled()
    })
  })

  describe('F-64 幂等键:退款与原充值互不干扰(真实查询层语义)', () => {
    it('同一 orderNo:充值写 (orderNo, opType=0),退款写 (refund:orderNo, opType=3)', async () => {
      const actual = await vi.importActual<{
        rechargeToken: (
          userId: string,
          quantity: number,
          orderNo?: string,
          remark?: string,
        ) => Promise<number>
        refundTokenDeduct: (
          userId: string,
          quantity: number,
          orderNo: string,
          remark?: string,
        ) => Promise<number>
      }>('../src/db/commission-queries.js')

      h.state.inserted.length = 0
      await actual.rechargeToken(TARGET_ID, 500, ORDER_NO, '充值')
      expect(h.state.inserted[0]).toMatchObject({
        opType: 0,
        relatedOrderNo: ORDER_NO,
        quantity: 500,
      })

      h.state.inserted.length = 0
      h.state.margin = { tokenQuantity: 1000 }
      await actual.refundTokenDeduct(TARGET_ID, 500, ORDER_NO, '退款')
      expect(h.state.inserted[0]).toMatchObject({
        opType: 3,
        relatedOrderNo: `refund:${ORDER_NO}`,
        quantity: 500,
      })
      // 两条幂等键不同 ⇒ unique 索引不会把退款当成"重复充值"吞掉
      expect((h.state.inserted[0] as { relatedOrderNo: string }).relatedOrderNo).not.toBe(ORDER_NO)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
