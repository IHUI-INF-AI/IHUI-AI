// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-620 回归锁(2026-11-14)。
 *
 * 病灶:Key 三窗口(5h/1d/7d)限流"先查后计" —— 从 dbRead(副本)读计数 → 放行 →
 * 成功回调再异步 +1;判定与计数分离且非原子 ⇒ 并发突发超发 N 倍,失败请求不计
 * (可故意失败刷窗口内免费额度)。
 *
 * 本文件锁:
 *   ① 占位走单条 `INSERT ... ON CONFLICT DO UPDATE ... WHERE request_count < limit
 *      RETURNING`(三窗口在同一事务内),不再先 SELECT 后 UPDATE,也不读副本;
 *   ② 任一窗口 RETURNING 空行 ⇒ 不放行且整笔回滚(三个窗口都不递增);
 *   ③ 并发两个请求争同一窗口,只放行 limit 个(不超发);
 *   ④ 计数发生在准入时刻 ⇒ 失败请求同样计数;成功回调的补计不会二次 +1;
 *   ⑤ 同一请求内重复预检(鉴权钩子 + 计费链路)只占位一次;
 *   ⑥ 三列全 NULL 的存量 Key:零查询、零写入。
 *
 * 只 mock db / dbRead,不连真实 PG、不触达副本。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

// ----------------------------------------------------------------------------
// 可变夹具(vi.hoisted:mock 工厂提升后仍可引用)
// ----------------------------------------------------------------------------
const fixture = vi.hoisted(() => ({
  /** 内存计数:windowType → request_count */
  counts: new Map<string, number>(),
  /** 内存限额:windowType → limit(模拟 SQL 里的 WHERE request_count < limit) */
  limits: new Map<string, number>(),
  /** 捕获到的 UPSERT 语句(values / onConflictDoUpdate 配置) */
  upserts: [] as Array<{ values: Record<string, unknown>; conflict: Record<string, unknown> }>,
  transactionCalls: 0,
  rollbacks: 0,
  selectCalls: 0,
  incrInsertCalls: 0,
}))

vi.mock('../src/db/index.js', () => {
  /** 进行中的事务写入(未提交):模拟"本事务可见、其他事务不可见" */
  let txWrites: Map<string, number> | null = null
  /** 事务串行化:同一行的并发 UPSERT 在 DB 里由行锁串行,后到者读到先到者已提交的计数 */
  let txQueue: Promise<unknown> = Promise.resolve()

  /** INSERT ... ON CONFLICT DO UPDATE ... WHERE request_count < limit RETURNING */
  const upsertChain = (values: Record<string, unknown>) => ({
    onConflictDoUpdate: (conflict: Record<string, unknown>) => ({
      returning: async () => {
        fixture.upserts.push({ values, conflict })
        const type = String(values.windowType)
        const used = txWrites?.get(type) ?? fixture.counts.get(type) ?? 0
        const limit = fixture.limits.get(type) ?? 0
        // 等价于 SQL 的 `WHERE request_count < limit`:未命中 ⇒ RETURNING 空行
        if (used >= limit) return []
        txWrites?.set(type, used + 1)
        return [{ requestCount: used + 1 }]
      },
    }),
  })
  const tx = { insert: vi.fn(() => ({ values: upsertChain })) }
  return {
    db: {
      transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => {
        const run = txQueue.then(async () => {
          fixture.transactionCalls += 1
          const writes = new Map<string, number>()
          txWrites = writes
          try {
            const result = await fn(tx)
            writes.forEach((v, k) => fixture.counts.set(k, v)) // COMMIT
            return result
          } catch (e) {
            fixture.rollbacks += 1 // ROLLBACK:本事务写入全部丢弃
            throw e
          } finally {
            txWrites = null
          }
        })
        txQueue = run.catch(() => undefined)
        return run
      }),
      // incrKeyRateWindows 的历史补计路径(无 WHERE)
      insert: vi.fn(() => {
        fixture.incrInsertCalls += 1
        return { values: () => ({ onConflictDoUpdate: async () => undefined }) }
      }),
    },
    dbRead: {
      select: vi.fn(() => {
        fixture.selectCalls += 1
        return {
          from: () => ({
            where: () => Object.assign(Promise.resolve([] as unknown[]), { limit: async () => [] }),
          }),
        }
      }),
    },
  }
})

// 用真实 drizzle 列对象,才能从 SQL 片段里还原出列名与参数
vi.mock('@ihui/database', async () => {
  const { pgTable, uuid, varchar, timestamp, bigint } = await import('drizzle-orm/pg-core')
  return {
    keyRateWindowCounts: pgTable('key_rate_window_counts', {
      id: uuid('id').primaryKey(),
      keyId: uuid('key_id').notNull(),
      windowType: varchar('window_type', { length: 8 }).notNull(),
      windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
      requestCount: bigint('request_count', { mode: 'number' }).notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    }),
    developerApiKeys: pgTable('developer_api_keys', {
      id: uuid('id').primaryKey(),
      rateLimit5h: bigint('rate_limit_5h', { mode: 'number' }),
      rateLimit1d: bigint('rate_limit_1d', { mode: 'number' }),
      rateLimit7d: bigint('rate_limit_7d', { mode: 'number' }),
    }),
  }
})

import { checkKeyRateWindows, incrKeyRateWindows } from '../src/services/key-rate-window-service.js'
import { runWithRequestScope } from '../src/plugins/principal.js'

const LIMITS = { '5h': 2, '1d': 10, '7d': 100 }

/** 从 drizzle SQL 片段里提取列名/字面量与绑定参数(用于断言 WHERE 守卫真的进了 SQL)。 */
function sqlParts(node: unknown): { text: string; params: unknown[] } {
  const text: string[] = []
  const params: unknown[] = []
  const walk = (chunk: unknown): void => {
    if (chunk === null || chunk === undefined) return
    if (typeof chunk === 'number' || typeof chunk === 'string') {
      params.push(chunk)
      return
    }
    if (Array.isArray(chunk)) {
      chunk.forEach(walk)
      return
    }
    const c = chunk as { name?: unknown; value?: unknown; queryChunks?: unknown[] }
    if (typeof c.name === 'string') text.push(c.name)
    if (typeof c.value === 'string') text.push(c.value)
    else if (Array.isArray(c.value)) text.push(c.value.map(String).join(''))
    if (Array.isArray(c.queryChunks)) c.queryChunks.forEach(walk)
  }
  walk(node)
  return { text: text.join(' '), params }
}

function makeRequest(): FastifyRequest {
  return { headers: {} } as unknown as FastifyRequest
}

beforeEach(() => {
  fixture.counts.clear()
  fixture.limits.clear()
  for (const [w, limit] of Object.entries(LIMITS)) fixture.limits.set(w, limit)
  fixture.upserts.length = 0
  fixture.transactionCalls = 0
  fixture.rollbacks = 0
  fixture.selectCalls = 0
  fixture.incrInsertCalls = 0
})

describe('F-620 Key 三窗口:原子占位(不再先查后写)', () => {
  it('① 三窗口各一条 ON CONFLICT ... WHERE request_count < limit RETURNING,同一事务且不读副本', async () => {
    const result = await checkKeyRateWindows('key-1', LIMITS)

    expect(result.allowed).toBe(true)
    expect(fixture.transactionCalls).toBe(1)
    // 先查后写已消除:占位路径不读副本
    expect(fixture.selectCalls).toBe(0)
    expect(fixture.upserts).toHaveLength(3)

    for (const { values, conflict } of fixture.upserts) {
      const windowType = String(values.windowType)
      expect(values.requestCount).toBe(1)
      expect(conflict.target).toHaveLength(3)

      const where = sqlParts(conflict.where)
      expect(where.text).toContain('request_count')
      expect(where.text).toContain('<')
      expect(where.params).toContain(LIMITS[windowType as keyof typeof LIMITS])

      const setCount = sqlParts((conflict.set as { requestCount: unknown }).requestCount)
      expect(setCount.text).toContain('request_count')
      expect(setCount.text).toContain('+ 1')
    }
    expect(fixture.counts).toEqual(
      new Map<string, number>(Object.keys(LIMITS).map((w) => [w, 1] as [string, number])),
    )
  })

  it('② 超限:RETURNING 空行 ⇒ 不放行,且整笔回滚(三窗口都不递增)', async () => {
    fixture.counts.set('5h', 1) // 占位后 2 / limit 2
    fixture.counts.set('1d', 5)
    fixture.counts.set('7d', LIMITS['7d']) // 打满 ⇒ WHERE 不命中

    const result = await checkKeyRateWindows('key-1', LIMITS)

    expect(result.allowed).toBe(false)
    expect(result.blocked).toMatchObject({ windowType: '7d', limit: LIMITS['7d'] })
    expect(fixture.rollbacks).toBe(1)
    // 前两个窗口已 +1,但事务回滚 ⇒ 计数保持原值(不递增)
    expect(fixture.counts.get('5h')).toBe(1)
    expect(fixture.counts.get('1d')).toBe(5)
    expect(fixture.counts.get('7d')).toBe(LIMITS['7d'])
  })

  it('③ 并发两个请求争同一窗口(limit=1):只放行 1 个,不超发', async () => {
    for (const w of ['5h', '1d', '7d'] as const) fixture.limits.set(w, 1)
    const limits = { '5h': 1, '1d': 1, '7d': 1 }

    const [a, b] = await Promise.all([
      checkKeyRateWindows('key-1', limits),
      checkKeyRateWindows('key-1', limits),
    ])

    expect([a.allowed, b.allowed].filter(Boolean)).toHaveLength(1)
    const blocked = a.allowed ? b : a
    expect(blocked.blocked).toBeTruthy()
    for (const w of ['5h', '1d', '7d'] as const) expect(fixture.counts.get(w)).toBe(1)
  })

  it('④ 失败请求也计数:准入即占位;成功回调补计不二次 +1;同请求重复预检只占位一次', async () => {
    const request = makeRequest()

    // 准入(鉴权钩子 / 计费链路入口)先占位:此时请求是否成功还未知
    const first = await runWithRequestScope(request, () =>
      checkKeyRateWindows('key-1', LIMITS),
    )
    expect(first.allowed).toBe(true)
    expect(fixture.counts.get('5h')).toBe(1)

    // 同一请求内第二次预检(requireApiKeyAuth + checkQuota 各一次):复用结果,不再占位
    const second = await runWithRequestScope(request, () =>
      checkKeyRateWindows('key-1', LIMITS),
    )
    expect(second.allowed).toBe(true)
    expect(fixture.transactionCalls).toBe(1)
    expect(fixture.counts.get('5h')).toBe(1)

    // 失败请求:没有任何成功回调,占位计数依然生效(不会回退)
    expect(fixture.counts.get('5h')).toBe(1)

    // 成功回调(recordCall / reply finish)的历史补计:已占位请求直接跳过
    await runWithRequestScope(request, () => incrKeyRateWindows('key-1'))
    expect(fixture.incrInsertCalls).toBe(0)
    expect(fixture.counts.get('5h')).toBe(1)
  })

  it('⑤ 三列全 NULL(存量 Key):零查询、零写入', async () => {
    const result = await checkKeyRateWindows('key-1', { '5h': null, '1d': null, '7d': null })

    expect(result).toEqual({ allowed: true })
    expect(fixture.transactionCalls).toBe(0)
    expect(fixture.upserts).toHaveLength(0)
    expect(fixture.selectCalls).toBe(0)
  })
})
