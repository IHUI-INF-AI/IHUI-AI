import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, signInRecords, signInRules } from '@ihui/database'
import { mockAuthenticate, setMockUser, setMockAdmin, setMockUnauthorized, resetMockAuth } from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const checkinDefault = (await import('../src/routes/checkin.ts')).default
const { adminCheckinRoutes } = await import('../src/routes/checkin.ts')

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function createSignInRecord(data: { userId: string; signInDate: string; consecutiveDays?: number; rewardPoints?: number }) {
  const [row] = await db
    .insert(signInRecords)
    .values({
      userId: data.userId,
      signInDate: data.signInDate,
      consecutiveDays: data.consecutiveDays ?? 1,
      rewardPoints: data.rewardPoints ?? 10,
    })
    .returning()
  return row
}

describe('checkin-routes — 签到需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(checkinDefault, { prefix: '/api/checkin' })
    await server.register(adminCheckinRoutes, { prefix: '/api/admin/checkin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM sign_in_records`)
    await db.execute(sql`DELETE FROM sign_in_rules`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 鉴权
  // =====================================================================

  it('POST /api/checkin — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'POST', url: '/api/checkin' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/checkin/today — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/checkin/today' })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // POST /api/checkin
  // =====================================================================

  it('POST /api/checkin — 首次签到返回 201 + 连续 1 天 + 奖励 10 分', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'POST', url: '/api/checkin' })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.consecutiveDays).toBe(1)
    expect(body.data.rewardPoints).toBe(10)
    expect(body.data.record.signInDate).toBe(todayStr())
  })

  it('POST /api/checkin — 今日重复签到返回 409', async () => {
    const user = await createUser('1001', '用户')
    await createSignInRecord({ userId: user.id, signInDate: todayStr() })
    setMockUser(user.id)
    const res = await server.inject({ method: 'POST', url: '/api/checkin' })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.code).toBe(409)
    expect(body.message).toBe('今日已签到')
  })

  it('POST /api/checkin — 昨日已签到,今日连续天数 +1', async () => {
    const user = await createUser('1001', '用户')
    const yesterday = shiftDate(todayStr(), -1)
    await createSignInRecord({ userId: user.id, signInDate: yesterday, consecutiveDays: 3, rewardPoints: 20 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'POST', url: '/api/checkin' })
    const body = res.json()
    expect(body.data.consecutiveDays).toBe(4)
    expect(body.data.rewardPoints).toBe(25) // 10 + (4-1)*5
  })

  it('POST /api/checkin — 连续签到第 7 天起奖励封顶 50 分', async () => {
    const user = await createUser('1001', '用户')
    const yesterday = shiftDate(todayStr(), -1)
    await createSignInRecord({ userId: user.id, signInDate: yesterday, consecutiveDays: 6, rewardPoints: 35 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'POST', url: '/api/checkin' })
    const body = res.json()
    expect(body.data.consecutiveDays).toBe(7)
    expect(body.data.rewardPoints).toBe(50)
  })

  // =====================================================================
  // GET /api/checkin/today
  // =====================================================================

  it('GET /api/checkin/today — 未签到返回 signedIn=false + 预估奖励', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/today' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.signedIn).toBe(false)
    expect(body.data.consecutiveDays).toBe(0)
    expect(body.data.todayReward).toBe(10) // 首日 10 分
    expect(body.data.record).toBeUndefined()
  })

  it('GET /api/checkin/today — 已签到返回 signedIn=true + 记录', async () => {
    const user = await createUser('1001', '用户')
    const record = await createSignInRecord({
      userId: user.id,
      signInDate: todayStr(),
      consecutiveDays: 5,
      rewardPoints: 30,
    })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/today' })
    const body = res.json()
    expect(body.data.signedIn).toBe(true)
    expect(body.data.consecutiveDays).toBe(5)
    expect(body.data.todayReward).toBe(30)
    expect(body.data.record.id).toBe(record.id)
  })

  it('GET /api/checkin/today — 昨日有签到,今日未签到,返回连续天数+预估奖励', async () => {
    const user = await createUser('1001', '用户')
    const yesterday = shiftDate(todayStr(), -1)
    await createSignInRecord({ userId: user.id, signInDate: yesterday, consecutiveDays: 2, rewardPoints: 15 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/today' })
    const body = res.json()
    expect(body.data.signedIn).toBe(false)
    expect(body.data.consecutiveDays).toBe(2)
    expect(body.data.todayReward).toBe(20) // 10 + (3-1)*5
  })

  // =====================================================================
  // GET /api/checkin/history
  // =====================================================================

  it('GET /api/checkin/history — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/history' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('GET /api/checkin/history — 按 userId 隔离', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSignInRecord({ userId: userA.id, signInDate: todayStr() })
    await createSignInRecord({ userId: userB.id, signInDate: todayStr() })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/history' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  it('GET /api/checkin/history — 按 yearMonth 筛选', async () => {
    const user = await createUser('1001', '用户')
    const ym = todayStr().slice(0, 7)
    await createSignInRecord({ userId: user.id, signInDate: todayStr() })
    await createSignInRecord({ userId: user.id, signInDate: shiftDate(todayStr(), -40) })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/checkin/history?yearMonth=${ym}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  it('GET /api/checkin/history — 非法 yearMonth 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/history?yearMonth=invalid' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/checkin/history — 分页', async () => {
    const user = await createUser('1001', '用户')
    for (let i = 0; i < 5; i++) {
      await createSignInRecord({ userId: user.id, signInDate: shiftDate(todayStr(), -i) })
    }
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/history?page=1&pageSize=2' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(5)
  })

  // =====================================================================
  // GET /api/checkin/streak
  // =====================================================================

  it('GET /api/checkin/streak — 今日已签到返回 signedIn=true + streak', async () => {
    const user = await createUser('1001', '用户')
    await createSignInRecord({ userId: user.id, signInDate: todayStr(), consecutiveDays: 7 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/streak' })
    const body = res.json()
    expect(body.data.signedIn).toBe(true)
    expect(body.data.streak).toBe(7)
  })

  it('GET /api/checkin/streak — 今日未签到返回昨日 streak', async () => {
    const user = await createUser('1001', '用户')
    const yesterday = shiftDate(todayStr(), -1)
    await createSignInRecord({ userId: user.id, signInDate: yesterday, consecutiveDays: 3 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/streak' })
    const body = res.json()
    expect(body.data.signedIn).toBe(false)
    expect(body.data.streak).toBe(3)
  })

  it('GET /api/checkin/streak — 无任何签到记录返回 streak=0', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/streak' })
    const body = res.json()
    expect(body.data.signedIn).toBe(false)
    expect(body.data.streak).toBe(0)
  })

  // =====================================================================
  // Admin: GET /api/admin/checkin/list
  // =====================================================================

  it('GET /api/admin/checkin/list — 普通用户返回 403', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id, 0)
    const res = await server.inject({ method: 'GET', url: '/api/admin/checkin/list' })
    expect(res.statusCode).toBe(403)
  })

  it('GET /api/admin/checkin/list — 管理员返回所有用户签到记录', async () => {
    const admin = await createUser('admin', '管理员')
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSignInRecord({ userId: userA.id, signInDate: todayStr() })
    await createSignInRecord({ userId: userB.id, signInDate: todayStr() })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/checkin/list' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/checkin/list — 按 userId 筛选', async () => {
    const admin = await createUser('admin', '管理员')
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSignInRecord({ userId: userA.id, signInDate: todayStr() })
    await createSignInRecord({ userId: userB.id, signInDate: todayStr() })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: `/api/admin/checkin/list?userId=${userA.id}` })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  // =====================================================================
  // Admin: GET /api/admin/checkin/stats
  // =====================================================================

  it('GET /api/admin/checkin/stats — 返回签到统计', async () => {
    const admin = await createUser('admin', '管理员')
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createSignInRecord({ userId: userA.id, signInDate: todayStr() })
    await createSignInRecord({ userId: userA.id, signInDate: shiftDate(todayStr(), -1) })
    await createSignInRecord({ userId: userB.id, signInDate: todayStr() })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/checkin/stats' })
    const body = res.json()
    expect(body.data.totalCheckins).toBe(3)
    expect(body.data.todayCheckins).toBe(2)
    expect(body.data.activeUsers).toBe(2)
  })

  // =====================================================================
  // Admin: 签到规则 CRUD
  // =====================================================================

  it('POST /api/admin/checkin/rules — 管理员创建签到规则', async () => {
    const admin = await createUser('admin', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/checkin/rules',
      body: { name: '7天连签', consecutiveDays: 7, rewardPoints: 50 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.name).toBe('7天连签')
    expect(body.data.consecutiveDays).toBe(7)
    expect(body.data.rewardPoints).toBe(50)
  })

  it('GET /api/admin/checkin/rules — 返回签到规则列表', async () => {
    const admin = await createUser('admin', '管理员')
    await db.insert(signInRules).values({
      name: '3天连签',
      consecutiveDays: 3,
      rewardPoints: 20,
    })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/checkin/rules' })
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('3天连签')
  })

  it('PUT /api/admin/checkin/rules/:id — 更新签到规则', async () => {
    const admin = await createUser('admin', '管理员')
    const [rule] = await db
      .insert(signInRules)
      .values({ name: '旧规则', consecutiveDays: 3, rewardPoints: 20 })
      .returning()
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/checkin/rules/${rule.id}`,
      body: { name: '新规则', rewardPoints: 30 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.name).toBe('新规则')
    expect(body.data.rewardPoints).toBe(30)
  })

  it('PUT /api/admin/checkin/rules/:id — 不存在返回 404', async () => {
    const admin = await createUser('admin', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/checkin/rules/00000000-0000-0000-0000-000000000000',
      body: { name: '新规则' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/checkin/rules/:id — 删除签到规则', async () => {
    const admin = await createUser('admin', '管理员')
    const [rule] = await db
      .insert(signInRules)
      .values({ name: '待删除', consecutiveDays: 1, rewardPoints: 10 })
      .returning()
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'DELETE', url: `/api/admin/checkin/rules/${rule.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('DELETE /api/admin/checkin/rules/:id — 不存在返回 404', async () => {
    const admin = await createUser('admin', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'DELETE', url: '/api/admin/checkin/rules/00000000-0000-0000-0000-000000000000' })
    expect(res.statusCode).toBe(404)
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    const user = await createUser('1001', '格式校验')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/checkin/today' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
  })
})
