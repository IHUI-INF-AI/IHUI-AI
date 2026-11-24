// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const OTHER_ID = '00000000-0000-4000-8000-000000000099'
const PREFIX = '/api'

/**
 * 库层用假实现:本文件判的是**路由 + 投影**(状态词汇、过期派生、分页诚实性、主体来源),
 * 而 `listUserCoupons` 是既有服务(开发者中转站那条路由也在用它),其 SQL 不属本票射程。
 */
const mockListUserCoupons = vi.fn()
vi.mock('../src/services/coupon-service.js', () => ({
  listUserCoupons: (...args: unknown[]) => mockListUserCoupons(...args),
}))

import miscRoutes from '../src/routes/user/misc-routes.js'

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000)
const PAST = new Date(Date.now() - 24 * 3600 * 1000)

/** 一条 user_coupons ⋈ promo_coupons 行(取投影真正读到的那些列) */
function row(opts: {
  id: string
  status: 'unused' | 'used' | 'expired'
  type: 'discount' | 'deduction' | 'referral'
  value: string
  minSpend?: number | null
  expiresAt: Date
  name?: string
  code?: string
}) {
  return {
    id: opts.id,
    userId: USER_ID,
    couponId: `c-${opts.id}`,
    status: opts.status,
    referrerUserId: null,
    referredBy: null,
    usedAt: null,
    usedOnOrderId: null,
    usedOnCallLogId: null,
    discountCents: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    coupon: {
      id: `c-${opts.id}`,
      code: opts.code ?? `IHUI-COUPON-${opts.id.toUpperCase()}`,
      name: opts.name ?? `满减券 ${opts.id}`,
      type: opts.type,
      value: opts.value,
      minSpend: opts.minSpend ?? 1000,
      referrerGets: null,
      referralValue: null,
      applicableModels: null,
      applicableScope: 'relay',
      totalQuota: null,
      issuedCount: 1,
      perUserLimit: 1,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: opts.expiresAt,
      enabled: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
  }
}

describe('GET /api/coupons —— 我的优惠券(web 会员券页 / RN CouponScreen / 小程序 member/coupon 的共同数据源)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    // 承载层身份注入点:真实 app 里由全局鉴权钩子写 request.userId,
    // 测试里用同一条通道,才能证明 handler 读的是它而不是客户端自报的 userId。
    server.addHook('onRequest', async (request) => {
      request.userId = USER_ID
    })
    await server.register(miscRoutes, { prefix: PREFIX })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  it('未登录不发查询:401 且 listUserCoupons 一次都没被调(副作用没发生)', async () => {
    mockListUserCoupons.mockClear()
    const anon = Fastify({ logger: false })
    // 没有身份注入钩子的独立实例 ⇒ request.userId 为 undefined
    await anon.register(miscRoutes, { prefix: PREFIX })
    await anon.ready()
    const res = await anon.inject({ method: 'GET', url: `${PREFIX}/coupons` })
    expect(res.statusCode).toBe(401)
    expect(mockListUserCoupons).not.toHaveBeenCalled()
    await anon.close()
  })

  it('载荷四键成套 + 行键集精确(信封是 {list,total,page,pageSize},不是裸数组)', async () => {
    mockListUserCoupons.mockResolvedValue([
      row({ id: 'a1', status: 'used', type: 'deduction', value: '200', expiresAt: FUTURE }),
    ])
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/coupons` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Object.keys(body.data).sort()).toEqual(['list', 'page', 'pageSize', 'total'])
    expect(body.data).toMatchObject({ total: 1, page: 1, pageSize: 20 })
    expect(Object.keys(body.data.list[0]).sort()).toEqual(
      ['amount', 'code', 'discountRate', 'expiresAt', 'id', 'minSpend', 'name', 'status', 'type'].sort(),
    )
  })

  it('状态词汇只有一套:库里 unused 但券已过期 ⇒ 读成 expired,且按 unused 筛时不再返回它', async () => {
    mockListUserCoupons.mockResolvedValue([
      row({ id: 'stale', status: 'unused', type: 'deduction', value: '200', expiresAt: PAST }),
      row({ id: 'fresh', status: 'unused', type: 'deduction', value: '300', expiresAt: FUTURE }),
    ])
    const all = (await server.inject({ method: 'GET', url: `${PREFIX}/coupons` })).json()
    expect(all.data.list.map((c: { id: string; status: string }) => [c.id, c.status])).toEqual([
      ['stale', 'expired'],
      ['fresh', 'unused'],
    ])

    const unused = (
      await server.inject({ method: 'GET', url: `${PREFIX}/coupons?status=unused` })
    ).json()
    // 筛在投影之后:这条才是"未使用"页该看见的集合(库里的 unused 含已过期的)
    expect(unused.data.list.map((c: { id: string }) => c.id)).toEqual(['fresh'])
    expect(unused.data.total).toBe(1)
  })

  it('折扣券没有固定面额 ⇒ amount=0 而 discountRate 出真值;满减券反之', async () => {
    mockListUserCoupons.mockResolvedValue([
      row({ id: 'd1', status: 'unused', type: 'discount', value: '0.80', expiresAt: FUTURE }),
      row({ id: 'm1', status: 'unused', type: 'deduction', value: '500', expiresAt: FUTURE }),
    ])
    const body = (await server.inject({ method: 'GET', url: `${PREFIX}/coupons` })).json()
    const [disc, ded] = body.data.list
    expect(disc).toMatchObject({ id: 'd1', amount: 0, discountRate: 0.8, type: 'discount' })
    expect(ded).toMatchObject({ id: 'm1', amount: 500, discountRate: null, type: 'deduction' })
    // numeric 列在 drizzle 里是字符串 ⇒ 投影必须落成数字,不能把 "500" 交给端上做 /100
    expect(typeof ded.amount).toBe('number')
  })

  it('分页诚实:total 是全集条数而不是本页条数,page=2 拿第二窗', async () => {
    mockListUserCoupons.mockResolvedValue([
      row({ id: 'p1', status: 'unused', type: 'deduction', value: '1', expiresAt: FUTURE }),
      row({ id: 'p2', status: 'unused', type: 'deduction', value: '2', expiresAt: FUTURE }),
      row({ id: 'p3', status: 'unused', type: 'deduction', value: '3', expiresAt: FUTURE }),
    ])
    const body = (
      await server.inject({ method: 'GET', url: `${PREFIX}/coupons?page=2&pageSize=1` })
    ).json()
    expect(body.data.list.map((c: { id: string }) => c.id)).toEqual(['p2'])
    expect(body.data).toMatchObject({ total: 3, page: 2, pageSize: 1 })
  })

  it('主体只认承载层:查询用的是钩子注入的身份;客户端自报 userId 连同任何未知键一律 400', async () => {
    mockListUserCoupons.mockClear().mockResolvedValue([])
    const ok = (await server.inject({ method: 'GET', url: `${PREFIX}/coupons` })).json()
    expect(ok.code).toBe(0)
    expect(mockListUserCoupons.mock.calls[0]?.[0]).toBe(USER_ID)

    // strict 之下"客户端塞身份"这条路结构上就不存在 ⇒ 不是"塞了被忽略",而是"塞了不通过"
    const spoof = await server.inject({ method: 'GET', url: `${PREFIX}/coupons?userId=${OTHER_ID}` })
    expect(spoof.statusCode).toBe(400)
    expect(mockListUserCoupons).toHaveBeenCalledTimes(1)

    const unknownKey = await server.inject({ method: 'GET', url: `${PREFIX}/coupons?sort=asc` })
    expect(unknownKey.statusCode).toBe(400)

    const badStatus = await server.inject({ method: 'GET', url: `${PREFIX}/coupons?status=all` })
    expect(badStatus.statusCode).toBe(400)
  })

  it('在册(门 8 从此看得见这条客户端字面量:RN 与小程序都已改写 /api/ 紧邻形态)', async () => {
    const tree = server.printRoutes()
    // printRoutes 是**前缀树**:`/api/c` 这一节点被 /categories 与 /coupons 共用,
    // 叶子只剩段尾(`oupons (GET, HEAD)`)⇒ 整条 "coupons (GET" 在文本里根本不存在。
    expect(tree).toMatch(/\n\s+└── c\n/)
    expect(tree).toMatch(/oupons \(GET/)
    // 阳性对照:同插件既有路由必须在同一棵树里,否则"看不见"是清单坏了而不是没注册
    expect(tree).toMatch(/vip\/benefits \(GET/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
