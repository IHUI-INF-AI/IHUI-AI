import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import {
  users,
  eduPointChannels,
  eduPoints,
  eduPointChannelRelations,
  eduPointRecords,
} from '@ihui/database'
import {
  mockAuthenticate,
  setMockUser,
  setMockAdmin,
  setMockUnauthorized,
  resetMockAuth,
} from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const pointRoutes = (await import('../src/routes/point.ts')).pointRoutes
const adminPointRoutes = (await import('../src/routes/point.ts')).adminPointRoutes

async function createUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

async function createChannel(data: { name: string; code?: string; status?: number; sort?: number }) {
  const [row] = await db
    .insert(eduPointChannels)
    .values({
      name: data.name,
      code: data.code,
      status: data.status ?? 1,
      sort: data.sort ?? 0,
    })
    .returning()
  return row
}

async function createPoint(data: {
  name: string
  channelId?: string | null
  point?: number
  status?: number
}) {
  const [row] = await db
    .insert(eduPoints)
    .values({
      name: data.name,
      channelId: data.channelId ?? null,
      point: data.point ?? 10,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

async function createRecord(data: {
  memberId?: string | null
  point: number
  balance: number
  type: string
}) {
  const [row] = await db
    .insert(eduPointRecords)
    .values({
      memberId: data.memberId ?? null,
      point: data.point,
      balance: data.balance,
      type: data.type,
    })
    .returning()
  return row
}

describe('point-routes — 积分系统需鉴权真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(pointRoutes, { prefix: '/api' })
    await server.register(adminPointRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    await db.execute(sql`DELETE FROM edu_point_records`)
    await db.execute(sql`DELETE FROM edu_point_channel_relations`)
    await db.execute(sql`DELETE FROM edu_points`)
    await db.execute(sql`DELETE FROM edu_point_channels`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  // =====================================================================
  // 公共路由:鉴权
  // =====================================================================

  it('GET /api/edu-points/channels — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/channels' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/edu-points/my-points — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/my-points' })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // 公共路由:GET /edu-points/channels(活跃)
  // =====================================================================

  it('GET /api/edu-points/channels — 仅返回启用渠道(status=1)', async () => {
    const user = await createUser('1001', '用户')
    await createChannel({ name: '启用渠道', status: 1 })
    await createChannel({ name: '禁用渠道', status: 0 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/channels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('启用渠道')
  })

  it('GET /api/edu-points/channels — 空表返回空列表', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/channels' })
    const body = res.json()
    expect(body.data.list).toEqual([])
  })

  // =====================================================================
  // 公共路由:GET /edu-points/channels/:id
  // =====================================================================

  it('GET /api/edu-points/channels/:id — 渠道不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/edu-points/channels/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/edu-points/channels/:id — 返回渠道详情', async () => {
    const user = await createUser('1001', '用户')
    const ch = await createChannel({ name: '详情渠道' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/edu-points/channels/${ch.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.channel.id).toBe(ch.id)
    expect(body.data.channel.name).toBe('详情渠道')
  })

  it('GET /api/edu-points/channels/:id — 非法 uuid 返回 400', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/channels/not-a-uuid' })
    expect(res.statusCode).toBe(400)
  })

  // =====================================================================
  // 公共路由:GET /edu-points/rules/:id
  // =====================================================================

  it('GET /api/edu-points/rules/:id — 规则不存在返回 404', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/edu-points/rules/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/edu-points/rules/:id — 返回规则详情', async () => {
    const user = await createUser('1001', '用户')
    const pt = await createPoint({ name: '签到积分', point: 10 })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: `/api/edu-points/rules/${pt.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.point.id).toBe(pt.id)
    expect(body.data.point.name).toBe('签到积分')
  })

  // =====================================================================
  // 公共路由:GET /edu-points/my-points
  // =====================================================================

  it('GET /api/edu-points/my-points — 无记录返回 0', async () => {
    const user = await createUser('1001', '用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/my-points' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.points).toBe(0)
  })

  it('GET /api/edu-points/my-points — 返回最新一条记录的余额', async () => {
    const user = await createUser('1001', '用户')
    await createRecord({ memberId: user.id, point: 10, balance: 10, type: 'earn' })
    await createRecord({ memberId: user.id, point: 5, balance: 15, type: 'earn' })
    await createRecord({ memberId: user.id, point: -3, balance: 12, type: 'spend' })
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/my-points' })
    const body = res.json()
    expect(body.data.points).toBe(12)
  })

  it('GET /api/edu-points/my-points — userId 隔离,不返回其他用户余额', async () => {
    const userA = await createUser('1001', '用户A')
    const userB = await createUser('1002', '用户B')
    await createRecord({ memberId: userA.id, point: 50, balance: 50, type: 'earn' })
    await createRecord({ memberId: userB.id, point: 200, balance: 200, type: 'earn' })
    setMockUser(userA.id)
    const res = await server.inject({ method: 'GET', url: '/api/edu-points/my-points' })
    const body = res.json()
    expect(body.data.points).toBe(50)
  })

  // =====================================================================
  // Admin:鉴权
  // =====================================================================

  it('GET /api/admin/edu-points/channels — 非 admin 返回 403', async () => {
    const user = await createUser('1001', '普通用户')
    setMockUser(user.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/channels' })
    expect(res.statusCode).toBe(403)
  })

  it('POST /api/admin/edu-points/channels — 未登录返回 401', async () => {
    setMockUnauthorized()
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/channels',
      payload: { name: '渠道' },
    })
    expect(res.statusCode).toBe(401)
  })

  // =====================================================================
  // Admin:渠道 CRUD
  // =====================================================================

  it('POST /api/admin/edu-points/channels — 创建渠道返回 201', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/channels',
      payload: { name: '课堂积分', code: 'CLASS', status: 1, sort: 10 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.channel.name).toBe('课堂积分')
    expect(body.data.channel.code).toBe('CLASS')
    expect(body.data.channel.sort).toBe(10)
  })

  it('POST /api/admin/edu-points/channels — 缺 name 返回 400', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/channels',
      payload: { code: 'NO-NAME' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/admin/edu-points/channels — 列表返回渠道(含禁用)', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createChannel({ name: '启用', status: 1 })
    await createChannel({ name: '禁用', status: 0 })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/channels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/edu-points/channels — name 关键字筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createChannel({ name: '课堂积分' })
    await createChannel({ name: '作业积分' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/edu-points/channels?name=课堂',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('课堂积分')
  })

  it('GET /api/admin/edu-points/channels — status 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createChannel({ name: '启用', status: 1 })
    await createChannel({ name: '禁用', status: 0 })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/channels?status=0' })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('禁用')
  })

  it('PUT /api/admin/edu-points/channels/:id — 更新渠道', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const ch = await createChannel({ name: '旧名称' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/edu-points/channels/${ch.id}`,
      payload: { name: '新名称', status: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.channel.name).toBe('新名称')
    expect(body.data.channel.status).toBe(0)
  })

  it('PUT /api/admin/edu-points/channels/:id — 渠道不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/channels/00000000-0000-0000-0000-000000000000',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/edu-points/channels/:id — 删除渠道', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const ch = await createChannel({ name: '待删除' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/edu-points/channels/${ch.id}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ok).toBe(true)
  })

  it('DELETE /api/admin/edu-points/channels/:id — 渠道不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/edu-points/channels/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  // =====================================================================
  // Admin:积分规则 CRUD
  // =====================================================================

  it('POST /api/admin/edu-points/rules — 创建规则返回 201', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const ch = await createChannel({ name: '渠道' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/rules',
      payload: { name: '完成作业', channelId: ch.id, point: 20, status: 1 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.point.name).toBe('完成作业')
    expect(body.data.point.point).toBe(20)
    expect(body.data.point.channelId).toBe(ch.id)
  })

  it('POST /api/admin/edu-points/rules — 缺 name 返回 400', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/edu-points/rules',
      payload: { point: 10 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/admin/edu-points/rules — 列表返回规则', async () => {
    const admin = await createUser('admin-1001', '管理员')
    await createPoint({ name: '规则A' })
    await createPoint({ name: '规则B' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/rules' })
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
  })

  it('GET /api/admin/edu-points/rules — channelId 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const chA = await createChannel({ name: '渠道A' })
    const chB = await createChannel({ name: '渠道B' })
    await createPoint({ name: '规则A1', channelId: chA.id })
    await createPoint({ name: '规则B1', channelId: chB.id })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/edu-points/rules?channelId=${chA.id}`,
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].name).toBe('规则A1')
  })

  it('PUT /api/admin/edu-points/rules/:id — 更新规则', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const pt = await createPoint({ name: '旧规则', point: 10 })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: `/api/admin/edu-points/rules/${pt.id}`,
      payload: { name: '新规则', point: 50, status: 0 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.point.name).toBe('新规则')
    expect(body.data.point.point).toBe(50)
    expect(body.data.point.status).toBe(0)
  })

  it('PUT /api/admin/edu-points/rules/:id — 规则不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/rules/00000000-0000-0000-0000-000000000000',
      payload: { name: 'x' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/admin/edu-points/rules/:id — 删除规则', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const pt = await createPoint({ name: '待删除' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: `/api/admin/edu-points/rules/${pt.id}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.ok).toBe(true)
  })

  it('DELETE /api/admin/edu-points/rules/:id — 规则不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/edu-points/rules/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
  })

  // =====================================================================
  // Admin:关联管理
  // =====================================================================

  it('PUT /api/admin/edu-points/relations — 全量覆盖规则关联渠道', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const ch1 = await createChannel({ name: '渠道1' })
    const ch2 = await createChannel({ name: '渠道2' })
    const pt = await createPoint({ name: '规则' })
    // 先插入一条旧关联
    await db.insert(eduPointChannelRelations).values({ pointId: pt.id, channelId: ch1.id })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/relations',
      payload: { pointId: pt.id, channelIds: [ch2.id] },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.channelIds).toEqual([ch2.id])
    // 验证 DB 中旧关联被删除,只剩新关联
    const rels = await db
      .select()
      .from(eduPointChannelRelations)
      .where(sql`point_id = ${pt.id}`)
    expect(rels).toHaveLength(1)
    expect(rels[0].channelId).toBe(ch2.id)
  })

  it('PUT /api/admin/edu-points/relations — 规则不存在返回 404', async () => {
    const admin = await createUser('admin-1001', '管理员')
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PUT',
      url: '/api/admin/edu-points/relations',
      payload: {
        pointId: '00000000-0000-0000-0000-000000000000',
        channelIds: [],
      },
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/admin/edu-points/relations — 按 pointId 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const ch = await createChannel({ name: '渠道' })
    const pt1 = await createPoint({ name: '规则1' })
    const pt2 = await createPoint({ name: '规则2' })
    await db.insert(eduPointChannelRelations).values({ pointId: pt1.id, channelId: ch.id })
    await db.insert(eduPointChannelRelations).values({ pointId: pt2.id, channelId: ch.id })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/edu-points/relations?pointId=${pt1.id}`,
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].pointId).toBe(pt1.id)
  })

  // =====================================================================
  // Admin:积分记录列表
  // =====================================================================

  it('GET /api/admin/edu-points/records — 列表返回记录', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    await createRecord({ memberId: user.id, point: 10, balance: 10, type: 'earn' })
    await createRecord({ memberId: user.id, point: -5, balance: 5, type: 'spend' })
    setMockAdmin(admin.id)
    const res = await server.inject({ method: 'GET', url: '/api/admin/edu-points/records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.list).toHaveLength(2)
    expect(body.data.total).toBe(2)
  })

  it('GET /api/admin/edu-points/records — memberId 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const userA = await createUser('1001', '学员A')
    const userB = await createUser('1002', '学员B')
    await createRecord({ memberId: userA.id, point: 10, balance: 10, type: 'earn' })
    await createRecord({ memberId: userB.id, point: 20, balance: 20, type: 'earn' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: `/api/admin/edu-points/records?memberId=${userA.id}`,
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
  })

  it('GET /api/admin/edu-points/records — type 筛选', async () => {
    const admin = await createUser('admin-1001', '管理员')
    const user = await createUser('1001', '学员')
    await createRecord({ memberId: user.id, point: 10, balance: 10, type: 'earn' })
    await createRecord({ memberId: user.id, point: -5, balance: 5, type: 'spend' })
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/edu-points/records?type=earn',
    })
    const body = res.json()
    expect(body.data.list).toHaveLength(1)
    expect(body.data.list[0].type).toBe('earn')
  })
})
