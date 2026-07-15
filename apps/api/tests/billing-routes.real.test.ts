import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { plans } from '@ihui/database'
import { billingRoutes } from '../src/routes/billing'
import { success, error } from '../src/utils/response'

async function createPlan(data: {
  name: string
  price: number
  interval: string
  isActive?: boolean
  sortOrder?: number
  features?: unknown
}) {
  const [row] = await db
    .insert(plans)
    .values({
      name: data.name,
      price: data.price,
      interval: data.interval,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      features: data.features ?? [],
    })
    .returning()
  return row
}

describe('billing-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(billingRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM plans`)
  })

  it('GET /api/plans — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/plans' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.plans).toEqual([])
  })

  it('GET /api/plans — 仅返回 isActive=true,按 sortOrder 升序', async () => {
    await createPlan({ name: 'P3', price: 3000, interval: 'year', sortOrder: 3, isActive: true })
    await createPlan({ name: 'P1', price: 1000, interval: 'month', sortOrder: 1, isActive: true })
    await createPlan({ name: 'Hidden', price: 500, interval: 'month', isActive: false })
    const res = await server.inject({ method: 'GET', url: '/api/plans' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.plans).toHaveLength(2)
    expect(body.data.plans[0].name).toBe('P1')
    expect(body.data.plans[1].name).toBe('P3')
  })

  it('GET /api/plans — features jsonb 结构保留', async () => {
    await createPlan({
      name: 'Pro',
      price: 9900,
      interval: 'year',
      features: ['unlimited', { seats: 10 }],
    })
    const res = await server.inject({ method: 'GET', url: '/api/plans' })
    const body = res.json()
    expect(body.data.plans[0].features).toEqual(['unlimited', { seats: 10 }])
  })

  it('GET /api/plans/:id — 返回方案详情', async () => {
    const p = await createPlan({ name: 'Solo', price: 500, interval: 'month' })
    const res = await server.inject({ method: 'GET', url: `/api/plans/${p.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.plan.name).toBe('Solo')
    expect(body.data.plan.price).toBe(500)
  })

  it('GET /api/plans/:id — 不存在返回 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/plans/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('方案不存在')
  })

  it('GET /api/plans/:id — isActive=false 返回 404', async () => {
    const p = await createPlan({ name: 'Hidden', price: 100, interval: 'month', isActive: false })
    const res = await server.inject({ method: 'GET', url: `/api/plans/${p.id}` })
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('方案不存在')
  })

  it('GET /api/plans/:id — 非法 UUID 被拦截(400 或 500)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/plans/not-a-uuid' })
    // 测试环境未注册全局 errorHandler,Fastify schema 验证或 zod 校验拦截非法 UUID
    // 生产环境由 errorHandler 统一转换为 400
    expect([400, 500]).toContain(res.statusCode)
    const body = res.json()
    expect(body).toHaveProperty('message')
  })

  it('响应格式符合 { code, message, data } 规范', async () => {
    await createPlan({ name: 'X', price: 100, interval: 'month' })
    const res = await server.inject({ method: 'GET', url: '/api/plans' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(typeof body.code).toBe('number')
    expect(typeof body.message).toBe('string')
    expect(typeof body.data).toBe('object')
  })

  it('success / error 工具函数格式一致', () => {
    const s = success({ foo: 1 })
    const e = error(400, 'bad')
    expect(s).toEqual({ code: 0, message: 'success', data: { foo: 1 } })
    expect(e).toEqual({ code: 400, message: 'bad' })
  })
})
