import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { vipLevels } from '@ihui/database'
import { vipRoutes } from '../src/routes/vip.js'

async function createLevel(data: {
  levelName: string
  levelValue?: number
  price: number
  durationDays?: number
  benefits?: unknown[]
  status?: number
  sortOrder?: number
}) {
  const [row] = await db
    .insert(vipLevels)
    .values({
      levelName: data.levelName,
      levelValue: data.levelValue ?? 1,
      price: data.price,
      durationDays: data.durationDays ?? 30,
      benefits: data.benefits ?? [],
      status: data.status ?? 1,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning()
  return row
}

describe('vip-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(vipRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM vip_levels`)
  })

  it('GET /api/vip/levels — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/vip/levels' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.items).toEqual([])
  })

  it('GET /api/vip/levels — 仅返回 status=1 的等级(按 sortOrder 排序)', async () => {
    await createLevel({ levelName: '黄金', price: 3000, sortOrder: 2, status: 1 })
    await createLevel({ levelName: '白银', price: 1000, sortOrder: 1, status: 1 })
    await createLevel({ levelName: '下架等级', price: 500, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/vip/levels' })
    const body = res.json()
    expect(body.data.items).toHaveLength(2)
    expect(body.data.items[0].levelName).toBe('白银')
    expect(body.data.items[1].levelName).toBe('黄金')
  })

  it('GET /api/vip/levels — benefits jsonb 结构保留', async () => {
    await createLevel({
      levelName: '钻石',
      price: 9900,
      benefits: ['专属客服', { discount: 0.8 }],
    })
    const res = await server.inject({ method: 'GET', url: '/api/vip/levels' })
    const body = res.json()
    expect(body.data.items[0].benefits).toEqual(['专属客服', { discount: 0.8 }])
  })

  it('GET /api/vip/levels — price/durationDays 字段完整', async () => {
    await createLevel({ levelName: '月度', price: 1500, durationDays: 30 })
    const res = await server.inject({ method: 'GET', url: '/api/vip/levels' })
    const body = res.json()
    const item = body.data.items[0]
    expect(item.price).toBe(1500)
    expect(item.durationDays).toBe(30)
    expect(item.levelValue).toBe(1)
  })

  it('GET /api/vip/products — 返回 products 字段(同 levels 数据)', async () => {
    await createLevel({ levelName: 'VIP1', price: 1000 })
    await createLevel({ levelName: 'VIP2', price: 2000, status: 0 })
    const res = await server.inject({ method: 'GET', url: '/api/vip/products' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.products).toHaveLength(1)
    expect(body.data.products[0].levelName).toBe('VIP1')
  })

  it('GET /api/vip/products — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/vip/products' })
    const body = res.json()
    expect(body.data.products).toEqual([])
  })

  it('GET /api/vip/levels — 响应格式符合 { code, message, data } 规范', async () => {
    await createLevel({ levelName: 'X', price: 100 })
    const res = await server.inject({ method: 'GET', url: '/api/vip/levels' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(typeof body.code).toBe('number')
    expect(typeof body.message).toBe('string')
    expect(typeof body.data).toBe('object')
    expect(Array.isArray(body.data.items)).toBe(true)
  })

  it('GET /api/vip/levels 与 GET /api/vip/products 数据一致', async () => {
    await createLevel({ levelName: '一致测试', price: 888, sortOrder: 5 })
    const [levelsRes, productsRes] = await Promise.all([
      server.inject({ method: 'GET', url: '/api/vip/levels' }),
      server.inject({ method: 'GET', url: '/api/vip/products' }),
    ])
    const levels = levelsRes.json().data.items
    const products = productsRes.json().data.products
    expect(levels).toEqual(products)
  })
})
