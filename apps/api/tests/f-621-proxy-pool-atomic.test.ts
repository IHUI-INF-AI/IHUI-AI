// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-621 回归锁(2026-11-13)。
 *
 * 病灶:reportProxyFailure 先 dbRead 取 failCount 再写回 +1(跨主/副本丢更新);
 * reportProxySuccess 无条件把 exhausted 拉回 active;转冷后又不会再被选中 ⇒ 成功上报
 * 永不发生,坏代理永远不到阈值,真被淘汰的位永久缩小。
 *
 * 本文件锁:
 *   ① 并发 5 次失败 → 每次 UPDATE 的 fail_count 都是 SQL 表达式(fail_count + 1),不是字面量;
 *   ② 达阈值 → 同一条 UPDATE 里用 CASE 切 exhausted,不再需要读改写;
 *   ③ 成功 → 只把 failCount 清零,不写 status;
 *   ④ recoverExhaustedProxies(now) → 把冷却期已过的 exhausted 重置为 active。
 *
 * 只 mock db,不触达 PG / Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const { updateSets, updateWheres, mockUpdateRows, dbReadSelect, dbSelect, resetState } = vi.hoisted(
  () => {
    const updateSets: unknown[] = []
    const updateWheres: unknown[] = []
    const mockUpdateRows = vi.fn((): unknown[] => [])
    const dbReadSelect = vi.fn()
    const dbSelect = vi.fn()
    return {
      updateSets,
      updateWheres,
      mockUpdateRows,
      dbReadSelect,
      dbSelect,
      resetState: () => {
        updateSets.length = 0
        updateWheres.length = 0
        mockUpdateRows.mockReset()
        mockUpdateRows.mockResolvedValue([])
        dbReadSelect.mockClear()
        dbSelect.mockClear()
      },
    }
  },
)

vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const step: Record<string, unknown> = {}
    for (const method of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'orderBy',
      'limit',
      'offset',
    ]) {
      step[method] = vi.fn((arg?: unknown) => {
        if (method === 'set') updateSets.push(arg)
        if (method === 'where') updateWheres.push(arg)
        return step
      })
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(mockUpdateRows()).then(resolve, reject)
    return step
  }
  return {
    db: {
      select: dbSelect.mockImplementation(() => makeChain()),
      update: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
      delete: vi.fn(() => makeChain()),
      execute: vi.fn(async () => []),
    },
    dbRead: { select: dbReadSelect.mockImplementation(() => makeChain()) },
    dbClient: {},
  }
})

import {
  reportProxyFailure,
  reportProxySuccess,
  recoverExhaustedProxies,
} from '../src/services/relay-proxy-pool.js'

const dialect = new PgDialect()

/** 把 drizzle SQL 片段编译成可在测试里断言的 SQL 文本 + 绑定参数。 */
function compile(expr: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(expr as Parameters<PgDialect['sqlToQuery']>[0])
}

describe('F-621 代理池计数原子化与 exhausted 自愈', () => {
  beforeEach(() => {
    resetState()
  })

  it('并发 5 次失败：每次 UPDATE 都用 fail_count + 1 原子表达式，且不先读副本', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => reportProxyFailure('http://10.0.0.2:8080')),
    )

    expect(updateSets).toHaveLength(5)
    for (const set of updateSets) {
      const patch = set as Record<string, unknown>
      expect(typeof patch.failCount).not.toBe('number')
      const compiled = compile(patch.failCount)
      expect(compiled.sql).toMatch(/fail_count"\s*\+\s*1/)
      expect(compiled.params).toEqual([])
      expect(typeof patch.status).not.toBe('string')
    }
    // 原子写不需要先读:任何 dbRead / db.select 参与都意味着还有读改写窗口
    expect(dbReadSelect).not.toHaveBeenCalled()
    expect(dbSelect).not.toHaveBeenCalled()
  })

  it('达阈值：同一条 UPDATE 用 CASE 切 exhausted，不依赖读到的旧状态', async () => {
    await reportProxyFailure('http://10.0.0.2:8080')

    const patch = updateSets[0] as Record<string, unknown>
    const compiled = compile(patch.status)
    expect(compiled.sql).toContain('CASE WHEN')
    expect(compiled.sql).toContain("'exhausted'")
    expect(compiled.sql).toMatch(/fail_count"\s*\+\s*1\s*>=\s*\$1/)
    expect(compiled.params).toEqual([5])
    expect(compiled.sql).toContain('"status"')
  })

  it('成功上报只清 failCount，不写 status（exhausted 不无条件复活）', async () => {
    await reportProxySuccess('http://10.0.0.2:8080')

    expect(updateSets).toHaveLength(1)
    const patch = updateSets[0] as Record<string, unknown>
    expect(patch.failCount).toBe(0)
    expect('status' in patch).toBe(false)
    expect(patch.updatedAt).toBeInstanceOf(Date)
    expect(dbReadSelect).not.toHaveBeenCalled()
  })

  it('recoverExhaustedProxies(now) 把冷却期已过的 exhausted 重置为 active', async () => {
    const now = new Date('2026-11-13T12:00:00Z')
    mockUpdateRows.mockResolvedValueOnce([{ id: 'p1' }])

    await expect(recoverExhaustedProxies(now)).resolves.toBe(1)

    const patch = updateSets[0] as Record<string, unknown>
    expect(patch).toMatchObject({ status: 'active', failCount: 0, updatedAt: now })
    const where = compile(updateWheres[0])
    expect(where.sql).toContain('"status" = $1')
    expect(where.params[0]).toBe('exhausted')
    expect(where.sql).toContain('last_checked_at')
    // 冷却期 10 分钟:12:00 的 now → 只恢复 11:50 之前(drizzle 的 lt 用严格小于)
    expect(where.params).toContain('2026-11-13T11:50:00.000Z')
  })

  it('自愈 UPDATE 异常被吞 → 0，永不抛', async () => {
    mockUpdateRows.mockRejectedValueOnce(new Error('db down'))
    await expect(recoverExhaustedProxies()).resolves.toBe(0)
  })
})
