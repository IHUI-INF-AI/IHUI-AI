import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import { mockAuthenticate, setMockAdmin, resetMockAuth } from './helpers/mock-auth.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireActiveUser: vi.fn(),
}))

const { adminMissingRoutes } = await import('../src/routes/admin-missing-routes.js')

async function createUser(phone: string, level: number = 0) {
  const [row] = await db
    .insert(users)
    .values({ phone, nickname: `U-${phone}`, level })
    .returning()
  return row
}

describe('admin-missing-routes /member/users — level 字段完整处理', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(adminMissingRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    resetMockAuth()
    // 只删除 phone 以 5 开头的测试用户;不能用 email LIKE '5%@%' 因为会误删 system admin (502319984@qq.com)
    await db.execute(sql`DELETE FROM users WHERE phone LIKE '5%'`)
  })

  it('GET /api/admin/member/users — 列表返回 level 字段', async () => {
    await createUser('5001', 0)
    await createUser('5002', 2)
    await createUser('5003', 3)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?page=1&pageSize=50',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const list = body.data.list.filter(
      (u: { phone: string | null }) => u.phone?.startsWith('5') && u.phone !== '5999',
    )
    expect(list.length).toBe(3)
    const phone2level = new Map(
      list.map((u: { phone: string | null; level: number }) => [u.phone, u.level]),
    )
    expect(phone2level.get('5001')).toBe(0)
    expect(phone2level.get('5002')).toBe(2)
    expect(phone2level.get('5003')).toBe(3)
  })

  it('GET /api/admin/member/users — level 查询参数过滤', async () => {
    await createUser('5010', 0)
    await createUser('5011', 0)
    await createUser('5012', 2)
    await createUser('5013', 3)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?level=2&page=1&pageSize=50',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const list = body.data.list.filter((u: { phone: string }) => u.phone?.startsWith('5'))
    expect(list.length).toBe(1)
    expect(list[0].level).toBe(2)
    expect(list[0].phone).toBe('5012')
  })

  it('GET /api/admin/member/users — level=0 查询返回所有 level=0 用户', async () => {
    await createUser('5020', 0)
    await createUser('5021', 0)
    await createUser('5022', 1)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?level=0&page=1&pageSize=50',
    })
    const body = res.json()
    const list = body.data.list.filter((u: { phone: string }) => u.phone?.startsWith('5'))
    expect(list.length).toBe(2)
    for (const u of list) expect(u.level).toBe(0)
  })

  it('GET /api/admin/member/users — level 超过 3 返回 400', async () => {
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?level=5&page=1&pageSize=10',
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /api/admin/member/users/:id — 更新 level(单独)', async () => {
    const u = await createUser('5030', 0)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/member/users/${u.id}`,
      payload: { level: 2 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.level).toBe(2)
    const [dbRow] = await db
      .select()
      .from(users)
      .where(sql`id = ${u.id}`)
    expect(dbRow?.level).toBe(2)
  })

  it('PATCH /api/admin/member/users/:id — 同时更新 status 和 level', async () => {
    const u = await createUser('5031', 1)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/member/users/${u.id}`,
      payload: { status: 0, level: 3 },
    })
    expect(res.statusCode).toBe(200)
    const [dbRow] = await db
      .select()
      .from(users)
      .where(sql`id = ${u.id}`)
    expect(dbRow?.status).toBe(0)
    expect(dbRow?.level).toBe(3)
  })

  it('PATCH /api/admin/member/users/:id — 空 body 返回 400', async () => {
    const u = await createUser('5032', 0)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/member/users/${u.id}`,
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /api/admin/member/users/:id — level 越界返回 400', async () => {
    const u = await createUser('5033', 0)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'PATCH',
      url: `/api/admin/member/users/${u.id}`,
      payload: { level: 10 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/admin/member/users — 创建用户可指定 level', async () => {
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/member/users',
      payload: { nickname: '新用户', phone: '5040', password: 'secret123', level: 2 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.level).toBe(2)
    const [dbRow] = await db
      .select()
      .from(users)
      .where(sql`phone = '5040'`)
    expect(dbRow?.level).toBe(2)
  })

  it('POST /api/admin/member/users — 不指定 level 时默认 0', async () => {
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/member/users',
      payload: { nickname: '新用户2', email: '5041@example.com', password: 'secret123' },
    })
    expect(res.statusCode).toBe(201)
    const [dbRow] = await db
      .select()
      .from(users)
      .where(sql`email = '5041@example.com'`)
    expect(dbRow?.level).toBe(0)
  })

  it('GET /api/admin/member/users — 默认过滤注销用户(status=3)', async () => {
    await createUser('5050', 0)
    await createUser('5051', 1)
    const cancelled = await createUser('5052', 2)
    await db
      .update(users)
      .set({ status: 3 })
      .where(sql`id = ${cancelled.id}`)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?page=1&pageSize=50',
    })
    const list = res.json().data.list.filter((u: { phone: string }) => u.phone?.startsWith('5'))
    const phones = list.map((u: { phone: string }) => u.phone)
    expect(phones).toContain('5050')
    expect(phones).toContain('5051')
    expect(phones).not.toContain('5052')
  })

  it('GET /api/admin/member/users — includeDeleted=true 返回注销用户', async () => {
    const cancelled = await createUser('5060', 2)
    await db
      .update(users)
      .set({ status: 3 })
      .where(sql`id = ${cancelled.id}`)
    const admin = await createUser('5999', 3)
    setMockAdmin(admin.id)
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/member/users?includeDeleted=true&page=1&pageSize=50',
    })
    const list = res.json().data.list.filter((u: { phone: string }) => u.phone === '5060')
    expect(list.length).toBe(1)
    expect(list[0].status).toBe(3)
    expect(list[0].level).toBe(2)
  })
})
