import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { plans } from '@ihui/database'
import { findPlans, findPlanById } from '../src/db/billing-queries.js'

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

describe('billing-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM plans`)
  })

  it('findPlans — 仅返回 isActive=true,按 sortOrder 升序', async () => {
    await createPlan({ name: 'P3', price: 3000, interval: 'year', sortOrder: 3, isActive: true })
    await createPlan({ name: 'P1', price: 1000, interval: 'month', sortOrder: 1, isActive: true })
    await createPlan({ name: 'P2', price: 2000, interval: 'month', sortOrder: 2, isActive: false })
    const list = await findPlans()
    expect(list).toHaveLength(2) // 排除 isActive=false
    expect(list[0].name).toBe('P1') // 按 sortOrder 升序
    expect(list[1].name).toBe('P3')
  })

  it('findPlans — 空表返回空数组', async () => {
    const list = await findPlans()
    expect(list).toEqual([])
  })

  it('findPlanById — 存在返回方案,不存在返回 undefined', async () => {
    const p = await createPlan({ name: 'Solo', price: 500, interval: 'month' })
    const found = await findPlanById(p.id)
    expect(found?.name).toBe('Solo')
    expect(found?.price).toBe(500)
    expect(found?.features).toEqual([])
    expect(await findPlanById('00000000-0000-0000-0000-000000000000')).toBeUndefined()
  })

  it('findPlans — features jsonb 保留结构', async () => {
    await createPlan({
      name: 'Pro',
      price: 9900,
      interval: 'year',
      features: ['unlimited', 'priority-support', { seats: 10 }],
    })
    const list = await findPlans()
    expect(list[0].features).toEqual(['unlimited', 'priority-support', { seats: 10 }])
  })
})
