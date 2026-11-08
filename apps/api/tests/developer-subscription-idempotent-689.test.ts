// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-689 回归锁(数字对照):
 * 同一笔订单(199 元/30 天)支付回调重放两次。
 *   改前:2 条订阅、授予权益 2×30 = 60 天,等价重复计账 2×199 = 398 元；
 *   改后:1 条订阅、授予 30 天、计账 199 元；重放按幂等成功返回 null(权益行不重复)。
 * 并锁死 schema/迁移里的 order_id 唯一索引(DB 层才是并发重放的最终防线)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const ORDER_AMOUNT_CENTS = 19900 // 199 元 / 30 天套餐
const DAY_MS = 86400_000

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string
    userId: string
    pricingId: string | null
    period: string | null
    startTime: Date
    endTime: Date
    status: number
    autoRenew: number
    orderId: string | null
    createdAt: Date
    updatedAt: Date
  }>,
  seq: 0,
  conflictTargets: [] as unknown[],
  insertCalls: 0,
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const render = (cond: unknown) => {
    try {
      return dialect.sqlToQuery(cond as never)
    } catch {
      return { sql: '', params: [] as unknown[] }
    }
  }

  const select = () => {
    let cond: unknown
    const b: Record<string, unknown> = {
      from: () => b,
      where: (c: unknown) => {
        cond = c
        return b
      },
      orderBy: () => b,
      limit: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => {
          const q = render(cond)
          const wanted = q.params.map((p) => String(p))
          return state.rows.filter((r) => r.orderId !== null && wanted.includes(r.orderId))
        }).then(res, rej),
    }
    return b
  }

  const insert = () => {
    let values: Record<string, unknown> = {}
    let conflictMode = false
    const b: Record<string, unknown> = {
      values: (v: Record<string, unknown>) => {
        values = v
        return b
      },
      onConflictDoNothing: (args?: { target?: unknown }) => {
        conflictMode = true
        if (args?.target) state.conflictTargets.push(args.target)
        return b
      },
      returning: () => b,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => {
          state.insertCalls += 1
          const orderId = (values.orderId as string | null) ?? null
          if (conflictMode && orderId) {
            const existing = state.rows.find((r) => r.orderId === orderId)
            if (existing) return [] // ON CONFLICT DO NOTHING
          }
          const row = {
            id: `sub-${++state.seq}`,
            userId: values.userId as string,
            pricingId: (values.pricingId as string | null) ?? null,
            period: (values.period as string | null) ?? null,
            startTime: values.startTime as Date,
            endTime: values.endTime as Date,
            status: values.status as number,
            autoRenew: (values.autoRenew as number) ?? 0,
            orderId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          state.rows.push(row)
          return [row]
        }).then(res, rej),
    }
    return b
  }

  return { db: { select, insert, update: () => ({}) } }
})

import { activateDeveloperSubscription } from '../src/db/developer-queries.js'

const schemaPath = fileURLToPath(
  new URL('../../../packages/database/src/schema/developer.ts', import.meta.url),
)
const migrationPath = fileURLToPath(
  new URL(
    '../../../packages/database/drizzle/20261108130000_subscription_order_id_uniq.sql',
    import.meta.url,
  ),
)

function grantDays(rows: typeof state.rows): number {
  return rows.reduce((sum, r) => sum + (r.endTime.getTime() - r.startTime.getTime()) / DAY_MS, 0)
}

function call(orderId: string) {
  return activateDeveloperSubscription({
    userId: 'u-1',
    pricingId: 'p-1',
    period: 'monthly',
    orderId,
  })
}

beforeEach(() => {
  state.rows = []
  state.seq = 0
  state.conflictTargets = []
  state.insertCalls = 0
})

describe('F-689 开发者订阅按订单幂等', () => {
  it('首次激活插入 1 条订阅', async () => {
    const row = await call('order-1')
    expect(state.rows.length).toBe(1)
    expect(row?.id).toBe('sub-1')
  })

  it('同一订单顺序重放两次：1 条订阅、30 天、计账 199 元（改前 2 条/60 天/398 元）', async () => {
    const first = await call('order-1')
    const replay = await call('order-1')

    // main 的事务化实现:ON CONFLICT DO NOTHING 命中后 rows 为空,幂等成功返回 null。
    expect(first?.id).toBe('sub-1')
    expect(replay).toBeNull()
    expect(state.rows.length).toBe(1)
    expect(grantDays(state.rows)).toBe(30)
    expect(state.rows.length * ORDER_AMOUNT_CENTS).toBe(19900)
  })

  it('同一订单并发重放(真并发)：1 条订阅、30 天、计账 199 元', async () => {
    const [a, b] = await Promise.all([call('order-1'), call('order-1')])

    const created = [a, b].filter((r): r is NonNullable<typeof a> => r !== null)
    expect(created.length).toBe(1)
    expect(created[0]?.id).toBe('sub-1')
    expect(state.rows.length).toBe(1)
    expect(grantDays(state.rows)).toBe(30)
    expect(state.rows.length * ORDER_AMOUNT_CENTS).toBe(19900)
  })

  it('写入用 order_id 作为冲突目标', async () => {
    await call('order-1')
    expect(state.conflictTargets.length).toBeGreaterThanOrEqual(1)
    const first = state.conflictTargets[0] as unknown
    const cols = Array.isArray(first) ? first : [first]
    expect(cols.map((c) => (c as { name?: string }).name)).toContain('order_id')
  })

  it('schema 声明 order_id 唯一索引', () => {
    const text = readFileSync(schemaPath, 'utf8')
    expect(text).toContain('ix_developer_subscriptions_order_id_uniq')
  })

  it('迁移文件建唯一索引并含去重/回滚说明', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "ix_developer_subscriptions_order_id_uniq"/)
    expect(sql).toContain('("order_id")')
    expect(sql).toContain('回滚')
    expect(sql).toContain('DELETE FROM "developer_subscriptions"')
  })
})
