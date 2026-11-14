// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-603 回归锁(2026-11-13):统计口径统一。
 *
 * 病灶:`db/statistics-queries.ts` 同类指标各写一套条件 —— 内容统计/总览的 `memberTotal`
 * 不排除系统账号,而用户中心排除;课程 `viewSum` 只按 `status=1`,未发布/下架课程浏览也计入,
 * 而 `lessonPublished` 要求 `isPublished && status=1`。后台同屏卡片因此自相矛盾。
 *
 * 钉住两件事(不连真实 DB,只观察路由/查询真发出去的 where 条件):
 *  ① 全站用户数(内容统计/总览/用户中心)一律排除 `is_system_admin = true`;
 *  ② 课程浏览量只累计已发布课程(`is_published = true` 且 `status = 1`),与已发布课程数同口径。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getTableName } from 'drizzle-orm'

const { chainLog, mockRows } = vi.hoisted(() => ({
  chainLog: [] as Array<{ table?: unknown; cond?: unknown; fields?: Record<string, unknown> }>,
  mockRows: vi.fn(),
}))

/**
 * select→from→where 记录器:from 的表对象与 where 的条件对象留给断言,
 * await 出来的是现读的聚合行。零真实连接。
 */
vi.mock('../src/db/index.js', () => {
  const make = (sink: Record<string, unknown>): Record<string, unknown> => {
    const chain = {
      from(table: unknown) {
        sink.table = table
        return chain
      },
      where(cond: unknown) {
        sink.cond = cond
        chainLog.push(sink)
        return chain
      },
      then(resolve: (value: unknown) => void) {
        return Promise.resolve(mockRows(sink)).then(resolve)
      },
    }
    return chain
  }
  return {
    db: {
      select: (fields: Record<string, unknown>) => make({ fields }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: { select: (fields: Record<string, unknown>) => make({ fields }) },
    dbClient: {},
  }
})

import {
  getLearnStatistics,
  getContentStatistics,
  getOverviewStatistics,
  getUserCenterStatistics,
  __resetStatisticsOverviewCacheForTest,
} from '../src/db/statistics-queries.js'

type CapturedQuery = { table?: unknown; cond?: unknown; fields?: Record<string, unknown> }

/**
 * drizzle 的 SQL 对象没有可裸调的 toString/toQuery(toQuery 需驱动上下文),
 * 但 queryChunks 递归里带着列元数据(name = SQL 列名)与 Param(value = 绑定值)。
 * 按此把条件还原成 {columns, params} 供断言 —— 还原的是查询真发出去的条件。
 */
function describeCondition(
  node: unknown,
  seen = new Set<unknown>(),
): { columns: string[]; params: unknown[] } {
  const acc = { columns: [] as string[], params: [] as unknown[] }
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object' || seen.has(n)) return
    seen.add(n)
    const o = n as Record<string, unknown>
    if (typeof o.name === 'string' && typeof o.getSQL === 'function') acc.columns.push(o.name)
    if (o.constructor?.name === 'Param') acc.params.push(o.value)
    if (Array.isArray(o.queryChunks)) {
      for (const q of o.queryChunks) walk(typeof q === 'function' ? (q as () => unknown)() : q)
    }
  }
  walk(node)
  return acc
}

function queriesFor(tableName: string): CapturedQuery[] {
  return chainLog.filter(
    (q) => q.table !== undefined && getTableName(q.table as Parameters<typeof getTableName>[0]) === tableName,
  )
}

beforeEach(() => {
  chainLog.length = 0
  __resetStatisticsOverviewCacheForTest()
  mockRows.mockReset()
  mockRows.mockImplementation((sink: CapturedQuery) => {
    if (sink.fields && 'sum' in sink.fields) return [{ sum: 900 }]
    return [{ count: 7 }]
  })
})

describe('F-603 用户数口径：系统/机器人账号不计入', () => {
  it('内容统计 memberTotal 排除 is_system_admin', async () => {
    const stats = await getContentStatistics()
    expect(stats.memberTotal).toBe(7)

    const userQueries = queriesFor('users')
    expect(userQueries).toHaveLength(1)
    const { columns, params } = describeCondition(userQueries[0]!.cond)
    expect(columns).toContain('is_system_admin')
    expect(params).toContain(false)
  })

  it('总览 memberTotal 与内容统计同口径(排除 is_system_admin)', async () => {
    const stats = await getOverviewStatistics()
    expect(stats.memberTotal).toBe(7)

    const userQueries = queriesFor('users')
    expect(userQueries).toHaveLength(1)
    const { columns, params } = describeCondition(userQueries[0]!.cond)
    expect(columns).toContain('is_system_admin')
    expect(params).toContain(false)
  })

  it('用户中心 5 项统计同样全部排除 is_system_admin(不被本次修改放松)', async () => {
    await getUserCenterStatistics()

    const userQueries = queriesFor('users')
    // userTotal / vipTotal / normalTotal / disabledTotal 四条都带用户口径条件
    expect(userQueries).toHaveLength(4)
    for (const q of userQueries) {
      const { columns, params } = describeCondition(q.cond)
      expect(columns).toContain('is_system_admin')
      expect(params).toContain(false)
    }
  })
})

describe('F-603 课程浏览口径：只统计已发布课程', () => {
  it('已发布课程数与浏览量使用同一过滤条件(is_published=true 且 status=1)', async () => {
    const stats = await getLearnStatistics()
    expect(stats.lessonPublished).toBe(7)
    expect(stats.viewSum).toBe(900)

    const lessonQueries = queriesFor('lessons')
    // 课程总数无 where;带条件的是已发布课程数与浏览量两条
    expect(lessonQueries).toHaveLength(2)
    const conditions = lessonQueries.map((q) => describeCondition(q.cond))
    for (const { columns, params } of conditions) {
      expect(columns).toContain('is_published')
      expect(columns).toContain('status')
      expect(params).toContain(true)
      expect(params).toContain(1)
    }
    // 两条条件逐项一致 ⇒ 同口径,不会出现“浏览量含未发布、课程数不含”的剪刀差
    expect(conditions[0]!.columns.slice().sort()).toEqual(conditions[1]!.columns.slice().sort())
    expect(new Set(conditions[0]!.params)).toEqual(new Set(conditions[1]!.params))
  })
})
