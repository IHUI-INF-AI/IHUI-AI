import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { aiPricing } from '@ihui/database'
import { pricingRoutes } from '../src/routes/pricing.js'

async function createPricing(data: {
  modelId: string
  inputTokenPrice: number
  outputTokenPrice: number
  regionPricing?: Record<string, number>
  discount?: unknown
  currency?: string
  effectiveAt?: Date
  expiresAt?: Date | null
}) {
  const [row] = await db
    .insert(aiPricing)
    .values({
      modelId: data.modelId,
      inputTokenPrice: data.inputTokenPrice,
      outputTokenPrice: data.outputTokenPrice,
      regionPricing: data.regionPricing ?? { cn: 1.0 },
      discount: data.discount,
      currency: data.currency,
      effectiveAt: data.effectiveAt ?? new Date(),
      expiresAt: data.expiresAt,
    })
    .returning()
  return row
}

describe('pricing-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(pricingRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM ai_pricing`)
  })

  it('GET /api/pricing/models — 空表返回空数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/pricing/models' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data.models).toEqual([])
  })

  it('GET /api/pricing/models — 按 effectiveAt 倒序返回', async () => {
    await createPricing({
      modelId: 'model-old',
      inputTokenPrice: 10,
      outputTokenPrice: 20,
      effectiveAt: new Date('2025-01-01'),
    })
    await createPricing({
      modelId: 'model-latest',
      inputTokenPrice: 5,
      outputTokenPrice: 15,
      effectiveAt: new Date('2026-01-01'),
    })
    const res = await server.inject({ method: 'GET', url: '/api/pricing/models' })
    const body = res.json()
    expect(body.data.models).toHaveLength(2)
    expect(body.data.models[0].modelId).toBe('model-latest')
    expect(body.data.models[1].modelId).toBe('model-old')
  })

  it('GET /api/pricing/models — regionPricing jsonb 结构保留', async () => {
    await createPricing({
      modelId: 'model-x',
      inputTokenPrice: 10,
      outputTokenPrice: 20,
      regionPricing: { cn: 1.0, us: 1.2, eu: 1.15 },
    })
    const res = await server.inject({ method: 'GET', url: '/api/pricing/models' })
    const body = res.json()
    expect(body.data.models[0].regionPricing).toEqual({ cn: 1.0, us: 1.2, eu: 1.15 })
  })

  it('GET /api/pricing/calculate — 无定价配置返回 0 成本', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/pricing/calculate?modelId=unknown&inputTokens=1000&outputTokens=500',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.totalCost).toBe(0)
    expect(body.data.inputCost).toBe(0)
    expect(body.data.outputCost).toBe(0)
    expect(body.data.currency).toBe('CNY')
  })

  it('GET /api/pricing/calculate — 正确计算成本(无区域/折扣)', async () => {
    await createPricing({
      modelId: 'gpt-4',
      inputTokenPrice: 30,
      outputTokenPrice: 60,
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/pricing/calculate?modelId=gpt-4&inputTokens=1000&outputTokens=500',
    })
    const body = res.json()
    expect(body.data.inputCost).toBe(30)
    expect(body.data.outputCost).toBe(30)
    expect(body.data.regionMultiplier).toBe(1.0)
    expect(body.data.discountMultiplier).toBe(1.0)
    expect(body.data.totalCost).toBe(60)
  })

  it('GET /api/pricing/calculate — 区域系数影响总价', async () => {
    await createPricing({
      modelId: 'gpt-4',
      inputTokenPrice: 30,
      outputTokenPrice: 60,
      regionPricing: { cn: 1.0, us: 1.5 },
    })
    const cnRes = await server.inject({
      method: 'GET',
      url: '/api/pricing/calculate?modelId=gpt-4&inputTokens=1000&outputTokens=1000&region=cn',
    })
    const usRes = await server.inject({
      method: 'GET',
      url: '/api/pricing/calculate?modelId=gpt-4&inputTokens=1000&outputTokens=1000&region=us',
    })
    const cnCost = cnRes.json().data.totalCost
    const usCost = usRes.json().data.totalCost
    expect(cnCost).toBe(90)
    expect(usCost).toBe(Math.round(90 * 1.5))
    expect(usRes.json().data.regionMultiplier).toBe(1.5)
  })

  it('GET /api/pricing/calculate — 缺少 modelId 返回 400', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/pricing/calculate?inputTokens=1000',
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
    expect(body.message).toContain('modelId')
  })

  it('GET /api/pricing/regions — 空表仍返回默认 cn', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/pricing/regions' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.regions).toContain('cn')
  })

  it('GET /api/pricing/regions — 聚合所有定价配置的区域', async () => {
    await createPricing({
      modelId: 'm1',
      inputTokenPrice: 10,
      outputTokenPrice: 20,
      regionPricing: { cn: 1.0, us: 1.2 },
    })
    await createPricing({
      modelId: 'm2',
      inputTokenPrice: 5,
      outputTokenPrice: 10,
      regionPricing: { cn: 1.0, eu: 1.15, jp: 1.1 },
    })
    const res = await server.inject({ method: 'GET', url: '/api/pricing/regions' })
    const body = res.json()
    expect(body.data.regions).toEqual(['cn', 'eu', 'jp', 'us'])
  })

  it('GET /api/pricing/models — 响应格式符合 { code, message, data } 规范', async () => {
    await createPricing({
      modelId: 'test',
      inputTokenPrice: 1,
      outputTokenPrice: 2,
    })
    const res = await server.inject({ method: 'GET', url: '/api/pricing/models' })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(typeof body.code).toBe('number')
    expect(typeof body.message).toBe('string')
    expect(typeof body.data).toBe('object')
    expect(Array.isArray(body.data.models)).toBe(true)
  })
})
