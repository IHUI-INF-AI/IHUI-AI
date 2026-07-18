import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, vipLevels, userVips, orders } from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

// 测试环境强制 mock 微信支付(即使本地已配置真实证书,也不发起真实微信支付 API 请求)
// 注意:必须包含 generateOutTradeNo,因为 payment-queries.ts 的 createOrder 依赖它生成订单号
vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: () => false,
  jsapiPrepay: vi.fn(),
  nativePrepay: vi.fn(),
  h5Prepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  generateOutTradeNo: vi.fn(
    (prefix = 'WX') => `${prefix}${Date.now()}${Math.floor(Math.random() * 100000)}`,
  ),
}))

process.env.NODE_ENV = 'development'

const { vipRoutes, adminVipRoutes } = await import('../src/routes/vip.js')

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname, isVip: 0 }).returning()
  return row
}

async function createVipLevel(data: {
  levelName: string
  price: number
  durationDays?: number
  status?: number
}) {
  const [row] = await db
    .insert(vipLevels)
    .values({
      levelName: data.levelName,
      price: data.price,
      durationDays: data.durationDays ?? 30,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createUserVip(data: {
  userId: string
  vipLevelId: string
  levelValue?: number
  startTime?: Date
  endTime?: Date
  status?: number
}) {
  const now = new Date()
  const end = data.endTime ?? new Date(now.getTime() + 30 * 86400_000)
  const [row] = await db
    .insert(userVips)
    .values({
      userId: data.userId,
      vipLevelId: data.vipLevelId,
      levelValue: data.levelValue ?? 1,
      startTime: data.startTime ?? now,
      endTime: end,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

describe('vip-auth-routes — 需鉴权路由真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(vipRoutes, { prefix: '/api' })
    await server.register(adminVipRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM user_vips`)
    await db.execute(sql`DELETE FROM orders`)
    await db.execute(sql`DELETE FROM vip_levels`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // GET /api/vip/my
  // =====================================================================

  it('GET /api/vip/my — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/vip/my — 登录但无 VIP 记录返回 vip=null', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.vip).toBeNull()
  })

  it('GET /api/vip/my — 有效 VIP 记录返回详情 + levelName', async () => {
    const user = await createUser('1001', 'VIP 用户')
    const level = await createVipLevel({ levelName: '黄金会员', price: 100 })
    const vip = await createUserVip({
      userId: user.id,
      vipLevelId: level.id,
      levelValue: 2,
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.vip).not.toBeNull()
    expect(body.data.vip.id).toBe(vip.id)
    expect(body.data.vip.userId).toBe(user.id)
    expect(body.data.vip.levelName).toBe('黄金会员')
    expect(body.data.vip.levelValue).toBe(2)
    expect(body.data.vip.status).toBe(1)
  })

  it('GET /api/vip/my — status=2 (已取消) 的 VIP 不返回', async () => {
    const user = await createUser('1001', '已取消 VIP')
    const level = await createVipLevel({ levelName: '白银', price: 50 })
    await createUserVip({
      userId: user.id,
      vipLevelId: level.id,
      status: 2,
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    const body = res.json()
    expect(body.data.vip).toBeNull()
  })

  it('GET /api/vip/my — endTime 已过期的 VIP 不返回', async () => {
    const user = await createUser('1001', '过期 VIP')
    const level = await createVipLevel({ levelName: '月卡', price: 30 })
    await createUserVip({
      userId: user.id,
      vipLevelId: level.id,
      startTime: new Date(Date.now() - 60 * 86400_000),
      endTime: new Date(Date.now() - 1 * 86400_000),
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    const body = res.json()
    expect(body.data.vip).toBeNull()
  })

  it('GET /api/vip/my — 多条 VIP 记录返回最近创建的', async () => {
    const user = await createUser('1001', '多条 VIP')
    const level1 = await createVipLevel({ levelName: '旧', price: 10 })
    const level2 = await createVipLevel({ levelName: '新', price: 20 })
    await createUserVip({
      userId: user.id,
      vipLevelId: level1.id,
      startTime: new Date(Date.now() - 60 * 86400_000),
      endTime: new Date(Date.now() + 100 * 86400_000),
    })
    const recent = await createUserVip({
      userId: user.id,
      vipLevelId: level2.id,
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    const body = res.json()
    expect(body.data.vip.id).toBe(recent.id)
    expect(body.data.vip.levelName).toBe('新')
  })

  it('GET /api/vip/my — 不同用户隔离(用户 A 看不到用户 B 的 VIP)', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    const level = await createVipLevel({ levelName: '共享等级', price: 100 })
    await createUserVip({ userId: userB.id, vipLevelId: level.id })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    const body = res.json()
    expect(body.data.vip).toBeNull()
  })

  // =====================================================================
  // POST /api/vip/purchase
  // =====================================================================

  it('POST /api/vip/purchase — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/vip/purchase — 不存在的 VIP 等级返回 404', async () => {
    const user = await createUser('1001', '购买者')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('VIP 等级不存在')
  })

  it('POST /api/vip/purchase — status=0 的 VIP 等级返回 404', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '已下架', price: 100, status: 0 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: level.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/vip/purchase — 成功购买创建订单 (development 环境直接激活)', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 3000 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: level.id },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.orderId).toBeDefined()
    expect(body.data.orderNo).toBeDefined()
    expect(body.data.amount).toBe(3000)
    expect(body.data.vipLevelId).toBe(level.id)

    // 验证订单已在 DB 中
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.data.orderId))
      .limit(1)
    expect(orderRow).toBeDefined()
    expect(orderRow.userId).toBe(user.id)
    expect(Number(orderRow.amount)).toBe(3000)

    // 验证 VIP 已在 DB 中激活(development 环境)
    const [vipRow] = await db.select().from(userVips).where(eq(userVips.userId, user.id)).limit(1)
    expect(vipRow).toBeDefined()
    expect(vipRow.vipLevelId).toBe(level.id)
    expect(vipRow.status).toBe(1)
  })

  it('POST /api/vip/purchase — paymentMethod 默认 wechat', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 100 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: level.id },
    })
    const body = res.json()
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.data.orderId))
      .limit(1)
    expect(orderRow.paymentMethod).toBe('wechat')
  })

  it('POST /api/vip/purchase — paymentMethod 可指定 alipay', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 100 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: level.id, paymentMethod: 'alipay' },
    })
    const body = res.json()
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.data.orderId))
      .limit(1)
    expect(orderRow.paymentMethod).toBe('alipay')
  })

  it('POST /api/vip/purchase — 缺 vipLevelId 时 zod 抛错(测试 server 无全局 errorHandler 返回 500)', async () => {
    const user = await createUser('1001', '购买者')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: {},
    })
    expect(res.statusCode).toBe(500)
  })

  it('POST /api/vip/purchase — VIP 等级不存在返回 404', async () => {
    const user = await createUser('1001', '购买者')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/purchase',
      body: { vipLevelId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.message).toBe('VIP 等级不存在')
  })

  // =====================================================================
  // Admin: GET /api/admin/vip/users
  // =====================================================================

  it('GET /api/admin/vip/users — 普通用户返回 403', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id, 0)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/vip/users',
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET /api/admin/vip/users — 管理员返回所有用户 VIP 列表', async () => {
    const admin = await createUser('1001', '管理员')
    const user1 = await createUser('1002', '用户1')
    const user2 = await createUser('1003', '用户2')
    const level = await createVipLevel({ levelName: '黄金', price: 100 })
    await createUserVip({ userId: user1.id, vipLevelId: level.id })
    await createUserVip({ userId: user2.id, vipLevelId: level.id })
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/vip/users',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.items).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/vip/users — 按 userId 筛选', async () => {
    const admin = await createUser('1001', '管理员')
    const user1 = await createUser('1002', '用户1')
    const user2 = await createUser('1003', '用户2')
    const level = await createVipLevel({ levelName: '黄金', price: 100 })
    await createUserVip({ userId: user1.id, vipLevelId: level.id })
    await createUserVip({ userId: user2.id, vipLevelId: level.id })
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/vip/users?userId=${user1.id}`,
    })
    const body = res.json()
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].userId).toBe(user1.id)
  })

  it('GET /api/admin/vip/users — 分页', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const level = await createVipLevel({ levelName: '黄金', price: 100 })
    for (let i = 0; i < 5; i++) {
      const u = await createUser(`user-${i}`, `用户${i}`)
      await createUserVip({ userId: u.id, vipLevelId: level.id })
    }
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/vip/users?page=1&limit=2',
    })
    const body = res.json()
    expect(body.data.items).toHaveLength(2)
    expect(body.data.total).toBe(5)
  })

  // =====================================================================
  // Admin: PUT /api/admin/vip/users/:id/cancel
  // =====================================================================

  it('PUT /api/admin/vip/users/:id/cancel — 取消用户 VIP', async () => {
    const admin = await createUser('1001', '管理员')
    const user = await createUser('1002', '用户')
    const level = await createVipLevel({ levelName: '黄金', price: 100 })
    const vip = await createUserVip({ userId: user.id, vipLevelId: level.id })
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/vip/users/${vip.id}/cancel`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.cancelled).toBe(true)

    const [updated] = await db.select().from(userVips).where(eq(userVips.id, vip.id)).limit(1)
    expect(updated.status).toBe(2)
  })

  // =====================================================================
  // Admin: VIP 等级 CRUD
  // =====================================================================

  it('POST /api/admin/vip/levels — 管理员创建 VIP 等级', async () => {
    const admin = await createUser('1001', '管理员')
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/vip/levels',
      body: {
        levelName: '钻石会员',
        price: 999,
        durationDays: 365,
        benefits: [{ name: '专属客服' }],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.levelName).toBe('钻石会员')
    expect(body.data.price).toBe(999)
    expect(body.data.durationDays).toBe(365)
  })

  it('PUT /api/admin/vip/levels/:id — 更新 VIP 等级', async () => {
    const admin = await createUser('1001', '管理员')
    const level = await createVipLevel({ levelName: '旧名称', price: 100 })
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/vip/levels/${level.id}`,
      body: { levelName: '新名称', price: 200, status: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.updated).toBe(true)
  })

  it('DELETE /api/admin/vip/levels/:id — 删除 VIP 等级', async () => {
    const admin = await createUser('1001', '管理员')
    const level = await createVipLevel({ levelName: '待删除', price: 100 })
    setMockUser(admin.id, 1)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/vip/levels/${level.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('Admin 路由 — 普通用户访问任意 admin 端点返回 403', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id, 0)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/vip/levels',
      body: { levelName: '测试', price: 100 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/vip/my' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })

  // =====================================================================
  // POST /api/vip/order — VIP 订单创建 + 微信预下单
  // =====================================================================

  it('POST /api/vip/order — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/vip/order — 缺 vipLevelId 参数返回 400 (safeParse 失败)', async () => {
    const user = await createUser('1001', '购买者')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('POST /api/vip/order — 不存在的 VIP 等级返回 404', async () => {
    const user = await createUser('1001', '购买者')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.message).toBe('VIP 等级不存在')
  })

  it('POST /api/vip/order — status=0 的 VIP 等级返回 404', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '已下架', price: 100, status: 0 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/vip/order — 成功创建订单 + payInfo.mock=true (本地无证书走 mock 模式)', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 3000 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.orderId).toBeDefined()
    expect(body.data.orderNo).toBeDefined()
    expect(body.data.amount).toBe(3000)
    expect(body.data.vipLevelId).toBe(level.id)
    expect(body.data.quantity).toBe(1)
    expect(body.data.payInfo).toBeDefined()
    expect(body.data.payInfo.mock).toBe(true)
    expect(body.data.payInfo.method).toBe('jsapi')

    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.data.orderId))
      .limit(1)
    expect(orderRow).toBeDefined()
    expect(orderRow.userId).toBe(user.id)
    expect(Number(orderRow.amount)).toBe(3000)
    expect(orderRow.status).toBe('pending')
  })

  it('POST /api/vip/order — quantity=2 时 amount = price * 2', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '季卡', price: 5000 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id, quantity: 2 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.amount).toBe(10000)
    expect(body.data.quantity).toBe(2)
  })

  it('POST /api/vip/order — paymentMethod=wechat_native → payInfo.method=native + mock=true', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 1000 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id, paymentMethod: 'wechat_native' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.payInfo.method).toBe('native')
    expect(body.data.payInfo.mock).toBe(true)
  })

  it('POST /api/vip/order — resolveOpenId 无绑定不阻塞订单创建 (不传 openId)', async () => {
    const user = await createUser('1001', '无微信绑定用户')
    const level = await createVipLevel({ levelName: '月卡', price: 500 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.orderId).toBeDefined()
    expect(body.data.payInfo.mock).toBe(true)
  })

  it('POST /api/vip/order — 显式传 openId 时 payInfo 仍走 mock (因无证书)', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 800 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id, openId: 'oXXX_mock_openid_XXX' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.payInfo.mock).toBe(true)
    expect(body.data.payInfo.method).toBe('jsapi')
  })

  // =====================================================================
  // GET /api/vip/order/:orderNo/payinfo — 支付参数查询
  // =====================================================================

  it('GET /api/vip/order/:orderNo/payinfo — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'GET',
      url: '/api/vip/order/NOT_EXIST_ORDER/payinfo',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/vip/order/:orderNo/payinfo — 订单不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/vip/order/NOT_EXIST_ORDER/payinfo',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.message).toBe('订单不存在')
  })

  it('GET /api/vip/order/:orderNo/payinfo — 归属人校验 403 (他人订单)', async () => {
    const owner = await createUser('1001', '订单所有者')
    const intruder = await createUser('1002', '闯入者')
    const level = await createVipLevel({ levelName: '月卡', price: 1000 })
    setMockUser(owner.id)
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    const orderNo = createRes.json().data.orderNo

    setMockUser(intruder.id)
    const res = await server.inject({
      method: 'GET',
      url: `/api/vip/order/${orderNo}/payinfo`,
    })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.message).toBe('无权查看此订单')
  })

  it('GET /api/vip/order/:orderNo/payinfo — paid 订单返回 {status:paid}', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 1500 })
    setMockUser(user.id)
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    const orderNo = createRes.json().data.orderNo

    await db
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(orders.orderNo, orderNo))

    const res = await server.inject({
      method: 'GET',
      url: `/api/vip/order/${orderNo}/payinfo`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('paid')
    expect(body.data.payInfo).toBeUndefined()
  })

  it('GET /api/vip/order/:orderNo/payinfo — pending 订单重新预下单返回 payInfo', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 2000 })
    setMockUser(user.id)
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    const orderNo = createRes.json().data.orderNo

    const res = await server.inject({
      method: 'GET',
      url: `/api/vip/order/${orderNo}/payinfo`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('pending')
    expect(body.data.payInfo).toBeDefined()
    expect(body.data.payInfo.mock).toBe(true)
  })

  it('GET /api/vip/order/:orderNo/payinfo — cancelled 订单返回 {status:cancelled} (不重新预下单)', async () => {
    const user = await createUser('1001', '购买者')
    const level = await createVipLevel({ levelName: '月卡', price: 600 })
    setMockUser(user.id)
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/vip/order',
      body: { vipLevelId: level.id },
    })
    const orderNo = createRes.json().data.orderNo

    await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.orderNo, orderNo))

    const res = await server.inject({
      method: 'GET',
      url: `/api/vip/order/${orderNo}/payinfo`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.status).toBe('cancelled')
    expect(body.data.payInfo).toBeUndefined()
  })
})
