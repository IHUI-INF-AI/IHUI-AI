// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Y-85 回归锁(2026-11-18)。
 *
 * 病灶:三个插件统计 export 函数体内都用 `sql.raw(String(days))` 直拼 interval 字面量 ——
 * HTTP 入口靠路由层 Zod(`.min(1).max(365)`)兜住,但这里是可被绕过的 export 面:任何新调用点、
 * DB 函数直接复用、或将来 Zod 上限改动,都会把越界 interval 送到 `sql.raw`。
 *
 * 本文件锁:无论 days 传入什么值(0 / 负数 / 越上界 / 非整数 / NaN),三个 export 函数体
 * 最终落到 SQL 的 interval 字面量必须是受控整数,落在 [1, 365] 区间内。
 *
 * 只 mock db(select 链),SQL 文本由 PgDialect 编译,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const capture = vi.hoisted(() => ({
  /** 每次 db.select(projection) 的 where 子句编译后的 SQL 文本 */
  wheres: [] as string[],
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const compile = (expr: unknown): string => {
    const wrapper = expr as { getSQL?: () => unknown }
    const fragment = typeof wrapper?.getSQL === 'function' ? wrapper.getSQL() : expr
    return dialect.sqlToQuery(fragment as never).sql
  }

  const makeSelect = (_projection: Record<string, unknown>) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'groupBy', 'orderBy', 'limit']) {
      chain[method] = () => chain
    }
    chain.where = (expr: unknown) => {
      capture.wheres.push(compile(expr))
      return chain
    }
    chain.then = (onFulfilled: (rows: unknown[]) => unknown) =>
      Promise.resolve([]).then(onFulfilled)
    return chain
  }

  return {
    db: { select: makeSelect, insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    dbRead: { select: makeSelect },
    dbClient: {},
  }
})

import {
  getPluginStatsSummary,
  getPluginStatsByPlugin,
  getPluginStatsTrend,
} from '../src/db/plugin-events-queries.js'

/** 从编译后的 where SQL 里抽出 interval 的天数(应恒为受控整数)。 */
const intervalDaysIn = (sqlText: string): number[] =>
  [...sqlText.matchAll(/interval '\s*(\d+)\s* days'/g)].map((m) => Number(m[1]))

const lastWhere = (): string => capture.wheres[capture.wheres.length - 1]!

describe('Y-85 插件统计 export 入口必须 clamp days', () => {
  beforeEach(() => {
    capture.wheres.length = 0
  })

  const cases = [
    { name: 'days=0 → clamp 到 1', input: 0, expected: 1 },
    { name: 'days=-5 → clamp 到 1', input: -5, expected: 1 },
    { name: 'days=400 → clamp 到 365(对齐路由 Zod 上限)', input: 400, expected: 365 },
    { name: 'days=365.9 → 取整到 365', input: 365.9, expected: 365 },
    { name: 'days=1.4 → 取整到 1', input: 1.4, expected: 1 },
  ]

  for (const fn of [
    { name: 'getPluginStatsSummary', run: (d: number) => getPluginStatsSummary(d) },
    { name: 'getPluginStatsByPlugin', run: (d: number) => getPluginStatsByPlugin(d, 20) },
    { name: 'getPluginStatsTrend', run: (d: number) => getPluginStatsTrend(d) },
  ]) {
    for (const c of cases) {
      it(`${fn.name}: ${c.name}`, async () => {
        await fn.run(c.input)
        const days = intervalDaysIn(lastWhere())
        expect(days).toHaveLength(1)
        expect(days[0]).toBe(c.expected)
      })
    }
  }

  it('三个 export 的正常路径 days=7 不受 clamp 影响', async () => {
    await getPluginStatsSummary(7)
    expect(intervalDaysIn(lastWhere())).toEqual([7])
    await getPluginStatsByPlugin(7, 20)
    expect(intervalDaysIn(lastWhere())).toEqual([7])
    await getPluginStatsTrend(7)
    expect(intervalDaysIn(lastWhere())).toEqual([7])
  })

  it('days=NaN 兜底到 1(不产生 interval \'\s*days\' 这类破损字面量)', async () => {
    await getPluginStatsSummary(Number.NaN)
    expect(intervalDaysIn(lastWhere())).toEqual([1])
  })
})
