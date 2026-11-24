// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-376 回归锁(2026-11-14)。
 *
 * 病灶:6 小时冷却"先 SELECT notifications 判冷却 → 再交给 notificationQueue 异步落库",
 * 判据与写回分离且非原子 ⇒ 同一次并发扫描里两个 budget 循环都读到"无冷却记录",
 * 各发一条告警(告警风暴 + 下游通知渠道被刷)。
 *
 * 本文件锁:
 *   ① 冷却占位换成**一次原子 SET NX EX**(复用 `utils/window-counter` 的 `acquireOnce`),
 *      键 = `budget:alert:cooldown:<userId>:<severity>`,TTL = 6h;判据与写回同一步;
 *   ② 并发两次扫描:只告警一次(add 1 次,两轮计数合计 1);
 *   ③ 冷却窗口过后(>6h)可再次告警(正向对照,不得被"永久压制"修坏);
 *   ④ 派发失败释放占位 ⇒ 下一轮仍会告警(告警宁可重发一封,不可静默 6 小时);
 *   ⑤ DB 里已有冷却行(例如 Redis 丢过)⇒ 不再占位、不发。
 *
 * Mock 策略:只 mock db / 通知队列 / 冷却原语,不连真实 PG、不触达真实 Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

const fx = vi.hoisted(() => ({
  /** 冷却窗口的假时钟(ms) */
  now: Date.parse('2026-11-14T02:00:00Z'),
  /** 已占位的键 → 到期时刻(模拟 SET NX EX 的键与 TTL) */
  claimed: new Map<string, number>(),
  /** 每次 acquireOnce 的入参(键 + TTL 本身就是判据) */
  claims: [] as Array<{ key: string; ttlMs: number }>,
  /** 每次 releaseOnce 的键 */
  releases: [] as string[],
  /** 下一次 queue.add 是否抛错 */
  failNextDispatch: false,
  /** notifications 里已有的冷却行数(0 = 无冷却) */
  cooldownRows: 0,
  budgets: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      scope: 'user',
      scopeKey: 'user-1',
      model: null,
      dailyTokenLimit: 1000,
      monthlyCostLimit: '2000',
      dailyCostLimit: '100',
    },
  ] as Array<Record<string, unknown>>,
  aggregates: [{ userId: 'user-1', dailyTokens: 900, monthlyCost: '0' }] as Array<
    Record<string, unknown>
  >,
  userRows: [{ email: 'u@example.com', nickname: 'U' }] as Array<Record<string, unknown>>,
}))

/** 原子占位:检查与写入之间不插 await —— 与 Redis `SET key 1 PX ttl NX` 同语义。 */
vi.mock('../src/utils/window-counter.js', () => ({
  acquireOnce: async (key: string, _value: string, ttlMs: number) => {
    fx.claims.push({ key, ttlMs })
    const expiresAt = fx.claimed.get(key)
    if (expiresAt !== undefined && expiresAt > fx.now) {
      return { acquired: false, existing: 'taken' }
    }
    fx.claimed.set(key, fx.now + Math.max(1000, ttlMs))
    return { acquired: true, existing: null }
  },
  releaseOnce: async (key: string) => {
    fx.releases.push(key)
    fx.claimed.delete(key)
  },
}))

vi.mock('../src/services/email-service.js', () => ({ sendEmail: vi.fn() }))
vi.mock('../src/services/email-templates.js', () => ({
  renderSystemAlertEmail: vi.fn(() => ({ subject: 's', html: 'h', text: 't' })),
}))

vi.mock('../src/db/index.js', () => {
  /** 按 select 投影区分四类查询(与 budget-alert-service 的四处读取一一对应)。 */
  const rowsFor = (cols?: Record<string, unknown>): unknown[] => {
    if (!cols) return fx.budgets
    if ('dailyTokens' in cols) return fx.aggregates
    if ('email' in cols) return fx.userRows
    if ('count' in cols) return [{ count: fx.cooldownRows }]
    return []
  }
  /** 兼容 `await where()`、`.limit(n)`、`.groupBy()` 三种收口。 */
  const chain = (cols?: Record<string, unknown>) => {
    const p = Promise.resolve(rowsFor(cols)) as Promise<unknown[]> & {
      limit: (n: number) => Promise<unknown[]>
      groupBy: () => Promise<unknown[]>
    }
    p.limit = async (n: number) => (await Promise.resolve(rowsFor(cols))).slice(0, n)
    p.groupBy = async () => rowsFor(cols)
    return p
  }
  return {
    db: {
      select: (cols?: Record<string, unknown>) => ({
        from: () => ({ where: () => chain(cols) }),
      }),
      insert: () => ({ values: async () => undefined }),
    },
    dbRead: {},
    dbClient: {},
  }
})

vi.mock('@ihui/database', async () => {
  const { pgTable, uuid, varchar, integer, numeric, jsonb, timestamp } =
    await import('drizzle-orm/pg-core')
  return {
    aiBudgets: pgTable('ai_budgets', {
      id: uuid('id').primaryKey(),
      scope: varchar('scope', { length: 32 }).notNull(),
      scopeKey: varchar('scope_key', { length: 128 }).notNull(),
      model: varchar('model', { length: 128 }),
      dailyTokenLimit: integer('daily_token_limit').notNull(),
      monthlyCostLimit: numeric('monthly_cost_limit').notNull(),
      dailyCostLimit: numeric('daily_cost_limit').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    }),
    aiCostRecords: pgTable('ai_cost_records', {
      id: uuid('id').primaryKey(),
      userId: uuid('user_id'),
      totalTokens: integer('total_tokens').notNull(),
      cost: numeric('cost').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    }),
    users: pgTable('users', {
      id: uuid('id').primaryKey(),
      email: varchar('email', { length: 255 }),
      nickname: varchar('nickname', { length: 64 }),
    }),
    notifications: pgTable('notifications', {
      id: uuid('id').primaryKey(),
      userId: uuid('user_id').notNull(),
      type: varchar('type', { length: 64 }).notNull(),
      title: varchar('title', { length: 255 }).notNull(),
      content: varchar('content', { length: 4000 }),
      data: jsonb('data'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    }),
  }
})

import { checkBudgetAlerts } from '../src/services/budget-alert-service.js'

const USER_ID = 'user-1'
const COOLDOWN_KEY = `budget:alert:cooldown:${USER_ID}:warning`
const SIX_HOURS_MS = 6 * 60 * 60 * 1000

function makeServer() {
  const add = vi.fn(async () => {
    if (fx.failNextDispatch) {
      fx.failNextDispatch = false
      throw new Error('queue down')
    }
    return { id: 'job-1' }
  })
  const server = {
    notificationQueue: { add },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
  return { server: server as unknown as FastifyInstance, add }
}

beforeEach(() => {
  fx.claimed.clear()
  fx.claims.length = 0
  fx.releases.length = 0
  fx.failNextDispatch = false
  fx.cooldownRows = 0
})

describe('F-376 预算告警冷却:判据与写回同一步(原子占位)', () => {
  it('① 冷却占位 = 一次 SET NX EX(6h),键为 user+severity', async () => {
    const { server, add } = makeServer()

    const result = await checkBudgetAlerts(server)

    expect(result.warningCount).toBe(1)
    expect(fx.claims).toEqual([{ key: COOLDOWN_KEY, ttlMs: SIX_HOURS_MS }])
    expect(add).toHaveBeenCalledTimes(1)
  })

  it('② 并发两次扫描:只告警一次(不再"两次都读到无冷却")', async () => {
    const first = makeServer()
    const second = makeServer()

    const [a, b] = await Promise.all([
      checkBudgetAlerts(first.server),
      checkBudgetAlerts(second.server),
    ])

    expect(a.warningCount + b.warningCount).toBe(1)
    expect(first.add.mock.calls.length + second.add.mock.calls.length).toBe(1)
    expect(fx.claims).toHaveLength(2)
  })

  it('③ 冷却窗口过后(>6h)可再次告警', async () => {
    const { server, add } = makeServer()

    await checkBudgetAlerts(server)
    fx.now += SIX_HOURS_MS + 1
    const again = await checkBudgetAlerts(server)

    expect(again.warningCount).toBe(1)
    expect(add).toHaveBeenCalledTimes(2)
  })

  it('④ 派发失败释放占位:下一轮仍会告警(不静默 6 小时)', async () => {
    const { server, add } = makeServer()
    fx.failNextDispatch = true

    const failed = await checkBudgetAlerts(server)
    expect(failed.errors).toHaveLength(1)
    expect(fx.releases).toEqual([COOLDOWN_KEY])
    expect(fx.claimed.has(COOLDOWN_KEY)).toBe(false)

    const retried = await checkBudgetAlerts(server)
    expect(retried.warningCount).toBe(1)
    expect(add).toHaveBeenCalledTimes(2)
  })

  it('⑤ DB 已有冷却行(Redis 丢过):不占位、不告警', async () => {
    const { server, add } = makeServer()
    fx.cooldownRows = 1

    const result = await checkBudgetAlerts(server)

    expect(result.warningCount).toBe(0)
    expect(fx.claims).toHaveLength(0)
    expect(add).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
