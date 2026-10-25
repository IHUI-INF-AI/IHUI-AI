// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分兑换的事务行为锁(守门 243 G1 立因那一格的运行时证据)。
 *
 * 形状门只能证明"这条写链没把影响行读回来",证不了**读回来之后做了什么**。
 * 本用例钉的是并发抢空库存时的三件事:
 *   ① 不扣积分(不能"积分照扣、货没给出");
 *   ② 不落订单(不能生成一条无库存对应的订单);
 *   ③ 明确回 400 库存不足(不能回 200 假装成功)。
 * 并成对留正向对照:抢到库存时,扣积分与落单都发生、且都落在**同一事务句柄**上
 * (跨句柄就是半截态的成因 —— 断言 tx 同一性,而不是只看调用发生过)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { calls, plan } = vi.hoisted(() => ({
  calls: [] as Array<{ op: string; tx?: unknown; arg?: unknown }>,
  plan: {
    product: null as unknown,
    stockRows: [] as unknown[],
    orderRows: [] as unknown[],
    tx: null as unknown,
  },
}))

// 链式 mock:每个方法回到自身,被 await 时按预设档位给结果并记账(op = 哪一种写)
vi.mock('../../db/index.js', () => {
  const chain = (op: string, resolve: () => unknown) => {
    const q: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'for', 'limit', 'set', 'values', 'returning', 'orderBy'])
      q[m] = () => q
    q.then = (res: (v: unknown) => unknown) => {
      calls.push({ op, tx: txRef })
      return Promise.resolve(res(resolve()))
    }
    return q
  }
  const txRef = {
    select: () => chain('select', () => (plan.product ? [plan.product] : [])),
    update: () => chain('update-products', () => plan.stockRows),
    insert: () => chain('insert-order', () => plan.orderRows),
  }
  return {
    db: {
      transaction: async (fn: (t: typeof txRef) => unknown) => {
        plan.tx = txRef // 交测试断言"扣积分与落单用的是同一个事务句柄"
        calls.push({ op: 'transaction' })
        return fn(txRef)
      },
    },
    dbRead: { select: () => chain('read', () => (plan.product ? [plan.product] : [])) },
  }
})

vi.mock('../../plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: any) => {
    if (request.headers.authorization !== 'Bearer tok-a')
      throw Object.assign(new Error('未登录'), { statusCode: 401 })
    request.userId = 'user-a'
    return { userId: 'user-a' }
  }),
}))

const { spendPoints } = vi.hoisted(() => ({
  // 显式带形参的签名:否则 TS 把 calls 的元素推成 [] ,取第 6 个实参(事务句柄)会报类型错
  spendPoints: vi.fn(async (..._args: unknown[]) => ({ points: { points: 40 }, transaction: {} })),
}))
vi.mock('../../services/points-service.js', () => ({ spendPoints, adjustPoints: vi.fn() }))

import { pointsMallUserRoutes } from '../points-mall-user.js'

const PRODUCT = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'on',
  stock: 1,
  sold: 0,
  pointsCost: 10,
  limitPerUser: 0,
  startTime: null,
  endTime: null,
}

describe('积分兑换:库存抢空时不得扣积分/落单', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(pointsMallUserRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  const post = () =>
    app.inject({
      method: 'POST',
      url: '/api/points/mall/redeem/' + PRODUCT.id,
      headers: { authorization: 'Bearer tok-a' },
    })

  it('条件 UPDATE 匹配 0 行(并发抢空)⇒ 400 库存不足,且积分与订单都没动', async () => {
    calls.length = 0
    spendPoints.mockClear()
    plan.product = PRODUCT
    plan.stockRows = [] // 守卫 stock>0 没抢到
    plan.orderRows = [{ id: 'o1' }]

    const res = await post()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toContain('库存不足')
    expect(spendPoints, '抢空时一积分都不能扣').not.toHaveBeenCalled()
    expect(calls.filter((c) => c.op === 'insert-order')).toHaveLength(0)
    expect(calls.filter((c) => c.op === 'transaction')).toHaveLength(1)
  })

  it('正向对照:抢到库存 ⇒ 扣积分与落单同发生,且都落在那一个事务句柄上', async () => {
    calls.length = 0
    spendPoints.mockClear()
    plan.product = PRODUCT
    plan.stockRows = [{ id: 'p1' }] // 影响行取回来了
    plan.orderRows = [{ id: 'o1' }]

    const res = await post()
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toMatchObject({ orderId: 'o1', points: 40, redeemed: 10 })

    expect(spendPoints).toHaveBeenCalledTimes(1)
    const args = spendPoints.mock.calls[0] as unknown[]
    expect(args.length, '兑换必须把事务句柄作为第 6 个实参透传给扣积分').toBeGreaterThanOrEqual(6)
    const txArg = args[5]
    expect(txArg, '扣积分必须跑在兑换的那个事务里,而不是自开一个事务').toBeTruthy()
    expect(txArg).toBe(plan.tx)
    const insertCall = calls.find((c) => c.op === 'insert-order')
    expect(insertCall, '订单必须经同一事务写入').toBeTruthy()
    expect(insertCall!.tx).toBe(plan.tx)
  })

  it('商品不存在 ⇒ 404,且不扣积分', async () => {
    calls.length = 0
    spendPoints.mockClear()
    plan.product = null
    plan.stockRows = [{ id: 'p1' }]
    const res = await post()
    expect(res.statusCode).toBe(404)
    expect(spendPoints).not.toHaveBeenCalled()
  })

  it('并发扣光积分(spend 抛"积分余额不足")⇒ 400,不生成订单行', async () => {
    calls.length = 0
    plan.product = PRODUCT
    plan.stockRows = [{ id: 'p1' }]
    spendPoints.mockRejectedValueOnce(new Error('积分余额不足'))
    const res = await post()
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toContain('积分余额不足')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
