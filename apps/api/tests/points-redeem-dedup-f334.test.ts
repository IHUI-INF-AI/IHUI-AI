// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-334 夹具:旧积分兑换端点去重必须精确到 referenceId,并有并发唯一索引兜底。
 *
 * 改前(红):
 * - 判重只看"最近 20 条"并按 description 字符串匹配;兑换满 21 个不同商品后,
 *   第 1 个商品的流水已被挤出窗口 → 重复兑换再次扣 500;
 * - 并发两请求同时通过"查无流水",各自扣一次(只发一件却扣 1000)。
 *
 * 改后(绿):
 * - 按 user_id + source='redeem' + reference_id 精确查询;第 21 次之后仍 409;
 * - 唯一索引 ux_point_transactions_redeem_user_ref 令并发第二笔在事务内 23505
 *   回滚,路由映射为 409,不产生第二次扣减。
 *
 * 真实并发由数据库唯一索引保证;本夹具用可注入账本 + 23505 映射验证应用侧契约。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { pointRedeemItems } from '@ihui/database'

const ITEM_ID = '11111111-1111-4111-8111-111111111111'

const h = vi.hoisted(() => ({
  exactDuplicateRows: [] as Array<{ id: string }>,
  recentRows: [] as Array<{ description: string }>,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'user-1'
  },
}))

vi.mock('../src/services/points-service.js', () => ({
  spendPoints: vi.fn(),
}))

const findPointTransactionsMock = vi.fn()
vi.mock('../src/db/gamification-queries.js', () => ({
  ensureUserPoints: vi.fn(async () => ({ points: 1000 })),
  findPointTransactions: (...args: unknown[]) => findPointTransactionsMock(...args),
}))

vi.mock('../src/db/index.js', () => ({
  dbRead: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () =>
            Promise.resolve(
              table === pointRedeemItems
                ? [{ id: ITEM_ID, points: 500 }]
                : h.exactDuplicateRows,
            ),
        }),
      }),
    }),
  },
  db: {},
}))

import { spendPoints } from '../src/services/points-service.js'
import { memberRoutes } from '../src/routes/other/member-routes.js'

const spendSpy = vi.mocked(spendPoints)

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(memberRoutes, { prefix: '/api' })
  return server
}

function redeem(server: FastifyInstance) {
  return server.inject({ method: 'POST', url: `/api/points/redeem/${ITEM_ID}` })
}

beforeEach(() => {
  h.exactDuplicateRows = []
  h.recentRows = []
  spendSpy.mockReset()
  spendSpy.mockResolvedValue({
    points: { points: 500 } as never,
    transaction: {} as never,
  })
  findPointTransactionsMock.mockReset()
  findPointTransactionsMock.mockResolvedValue({ list: h.recentRows, total: h.recentRows.length })
})

describe('F-334 积分兑换去重', () => {
  it('已兑 21 个不同商品(第 1 个已滑出最近 20 条)后重复兑换第 1 个 → 409 且不再扣分', async () => {
    // 模拟历史缺陷现场:最近 20 条全是别的商品(描述里没有 item-1)
    h.recentRows = Array.from({ length: 20 }, (_, i) => ({ description: `redeem:other-${i}` }))
    // 精确查询按 referenceId 命中第 1 个商品的既有流水
    h.exactDuplicateRows = [{ id: 'txn-item-1' }]
    const server = await buildServer()
    const res = await redeem(server)
    await server.close()

    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe('该商品已兑换过')
    expect(spendSpy).not.toHaveBeenCalled()
  })

  it('无既有流水 → 扣分一次,且 referenceId 精确为 redeem:<itemId>', async () => {
    const server = await buildServer()
    const res = await redeem(server)
    await server.close()

    expect(res.statusCode).toBe(200)
    expect(spendSpy).toHaveBeenCalledTimes(1)
    expect(spendSpy).toHaveBeenCalledWith(
      'user-1',
      500,
      'redeem',
      `redeem:${ITEM_ID}`,
      ITEM_ID,
    )
  })

  it('并发第二笔撞唯一索引(23505)→ 409,事务回滚不产生第二次扣减', async () => {
    spendSpy.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
    const server = await buildServer()
    const res = await redeem(server)
    await server.close()

    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe('该商品已兑换过')
    // 唯一索引拒绝后只应有一次扣分尝试;没有第二次
    expect(spendSpy).toHaveBeenCalledTimes(1)
  })

  it('非唯一冲突仍按原错误抛出(不被误映射成 409)', async () => {
    spendSpy.mockRejectedValueOnce(new Error('db offline'))
    const server = await buildServer()
    const res = await redeem(server)
    await server.close()

    expect(res.statusCode).toBe(500)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
