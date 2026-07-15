import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, userMargins, tokenFlows } from '@ihui/database'
import { mockAuthenticate, setMockUser, setMockUnauthorized, resetMockAuth } from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const walletRoutes = (await import('../src/routes/wallet.ts')).default

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createMargin(data: { userId: string; tokenQuantity?: number; frozenQuantity?: number }) {
  const [row] = await db
    .insert(userMargins)
    .values({
      userId: data.userId,
      tokenQuantity: data.tokenQuantity ?? 0,
      frozenQuantity: data.frozenQuantity ?? 0,
    })
    .returning()
  return row
}

async function createFlow(data: { userId: string; opType: number; quantity: number; balanceAfter?: number; remark?: string }) {
  const [row] = await db
    .insert(tokenFlows)
    .values({
      userId: data.userId,
      opType: data.opType,
      quantity: data.quantity,
      balanceAfter: data.balanceAfter ?? 0,
      remark: data.remark,
    })
    .returning()
  return row
}

describe('wallet-routes — 钱包需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(walletRoutes, { prefix: '/api/wallet' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM token_flows`)
    await db.execute(sql`DELETE FROM user_margins`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权
  // =====================================================================

  it('GET /api/wallet/balance — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/wallet/balance' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/wallet/recharge — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { amount: 100, payMethod: 'wechat' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/wallet/withdraw — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { amount: 100, account: 'test', accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // GET /api/wallet/balance
  // =====================================================================

  it('GET /api/wallet/balance — 无 margin 记录返回全 0', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/balance' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toEqual({ balance: 0, frozenBalance: 0, totalRecharge: 0, totalWithdraw: 0 })
  })

  it('GET /api/wallet/balance — 返回余额 + 冻结 + 累计充值/提现', async () => {
    const user = await createUser('1001', '用户')
    await createMargin({ userId: user.id, tokenQuantity: 500, frozenQuantity: 100 })
    await createFlow({ userId: user.id, opType: 0, quantity: 1000, balanceAfter: 1000 })
    await createFlow({ userId: user.id, opType: 0, quantity: 500, balanceAfter: 1500 })
    await createFlow({ userId: user.id, opType: 1, quantity: -200, balanceAfter: 1300 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/balance' })
    const body = res.json()
    expect(body.data.balance).toBe(500)
    expect(body.data.frozenBalance).toBe(100)
    expect(body.data.totalRecharge).toBe(1500)
    expect(body.data.totalWithdraw).toBe(200)
  })

  // =====================================================================
  // POST /api/wallet/recharge
  // =====================================================================

  it('POST /api/wallet/recharge — 成功充值(无 margin 记录时自动创建)', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { amount: 100, payMethod: 'wechat' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.orderNo).toMatch(/^RC\d+$/)
    expect(body.data.flow.opType).toBe(0)
    expect(body.data.flow.quantity).toBe(100)
    expect(body.data.flow.balanceAfter).toBe(100)

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, user.id))
      .limit(1)
    expect(margin.tokenQuantity).toBe(100)
  })

  it('POST /api/wallet/recharge — 已有 margin 记录时累加余额', async () => {
    const user = await createUser('1001', '用户')
    await createMargin({ userId: user.id, tokenQuantity: 200 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { amount: 300, payMethod: 'alipay' },
    })
    const body = res.json()
    expect(body.data.flow.balanceAfter).toBe(500)

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, user.id))
      .limit(1)
    expect(margin.tokenQuantity).toBe(500)
  })

  it('POST /api/wallet/recharge — amount 缺失返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { payMethod: 'wechat' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/wallet/recharge — amount <= 0 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { amount: 0, payMethod: 'wechat' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/wallet/recharge — 缺 payMethod 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/recharge',
      body: { amount: 100 },
    })
    expect(res.statusCode).toBe(400)
  })

  // =====================================================================
  // POST /api/wallet/withdraw
  // =====================================================================

  it('POST /api/wallet/withdraw — 余额充足时成功提现', async () => {
    const user = await createUser('1001', '用户')
    await createMargin({ userId: user.id, tokenQuantity: 1000 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { amount: 300, account: 'wechat_acc', accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.success).toBe(true)

    const [margin] = await db
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, user.id))
      .limit(1)
    expect(margin.frozenQuantity).toBe(300)
  })

  it('POST /api/wallet/withdraw — 余额不足返回 400', async () => {
    const user = await createUser('1001', '用户')
    await createMargin({ userId: user.id, tokenQuantity: 100 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { amount: 200, account: 'acc', accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.message).toBe('可用余额不足')
  })

  it('POST /api/wallet/withdraw — 冻结余额影响可用余额', async () => {
    const user = await createUser('1001', '用户')
    await createMargin({ userId: user.id, tokenQuantity: 500, frozenQuantity: 400 })
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { amount: 200, account: 'acc', accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(400) // 可用 = 500 - 400 = 100 < 200
  })

  it('POST /api/wallet/withdraw — 缺 amount 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { account: 'acc', accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/wallet/withdraw — 缺 account 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/wallet/withdraw',
      body: { amount: 100, accountType: 'wechat' },
    })
    expect(res.statusCode).toBe(400)
  })

  // =====================================================================
  // GET /api/wallet/recharge/records
  // =====================================================================

  it('GET /api/wallet/recharge/records — 返回充值记录', async () => {
    const user = await createUser('1001', '用户')
    await createFlow({ userId: user.id, opType: 0, quantity: 100, balanceAfter: 100 })
    await createFlow({ userId: user.id, opType: 0, quantity: 200, balanceAfter: 300 })
    await createFlow({ userId: user.id, opType: 1, quantity: -50, balanceAfter: 250 }) // 提现,不应出现
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/recharge/records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
    expect(body.data.list[0].type).toBe('recharge')
    expect(body.data.list[0].status).toBe('success')
  })

  it('GET /api/wallet/recharge/records — 按 userId 隔离', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createFlow({ userId: userA.id, opType: 0, quantity: 100 })
    await createFlow({ userId: userB.id, opType: 0, quantity: 200 })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/recharge/records' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  it('GET /api/wallet/recharge/records — 分页', async () => {
    const user = await createUser('1001', '用户')
    for (let i = 0; i < 5; i++) {
      await createFlow({ userId: user.id, opType: 0, quantity: 100 })
    }
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/recharge/records?page=1&pageSize=2' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
  })

  // =====================================================================
  // GET /api/wallet/withdraw/records
  // =====================================================================

  it('GET /api/wallet/withdraw/records — 返回提现记录', async () => {
    const user = await createUser('1001', '用户')
    await createFlow({ userId: user.id, opType: 1, quantity: -100, balanceAfter: 400 })
    await createFlow({ userId: user.id, opType: 0, quantity: 500, balanceAfter: 900 }) // 充值,不应出现
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/withdraw/records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].type).toBe('withdraw')
    expect(body.data.list[0].amount).toBe(100) // abs(-100)
    expect(body.data.list[0].status).toBe('pending')
  })

  it('GET /api/wallet/withdraw/records — 按 userId 隔离', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createFlow({ userId: userA.id, opType: 1, quantity: -100 })
    await createFlow({ userId: userB.id, opType: 1, quantity: -200 })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/withdraw/records' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/wallet/balance' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
