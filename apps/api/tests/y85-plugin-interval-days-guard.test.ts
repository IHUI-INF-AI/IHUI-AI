// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-85 回归锁(2026-11-18)。
 *
 * 病灶:getPluginStatsSummary / getPluginStatsByPlugin / getPluginStatsTrend 三个 DB 函数
 * 被 export,却用 `interval '${sql.raw(String(days))} days'` 把天数拼进 SQL 字面量,只靠
 * 路由层 Zod 兜住。新调用点绕过路由即可构造越界 interval 或注入片段。
 *
 * 本文件锁:
 *   ① 三处窗口起点都编译成 `make_interval(days => $N)` 参数化形态,天数走 params;
 *   ② SQL 文本里不再出现 `interval '... days'` 字面量拼接;
 *   ③ days 被 clamp 到 [1,365]:越界/非有限值/小数都收口成安全整数参数。
 *
 * 只 mock db(select 链),SQL 文本与绑定参数由 PgDialect 编译,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const capture = vi.hoisted(() => ({
  /** 每次 where(cond) 的编译结果 */
  wheres: [] as Array<{ sql: string; params: unknown[] }>,
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  const compile = (expr: unknown): { sql: string; params: unknown[] } => {
    const wrapper = expr as { getSQL?: () => unknown }
    const fragment = typeof wrapper?.getSQL === 'function' ? wrapper.getSQL() : expr
    const q = dialect.sqlToQuery(fragment as never)
    return { sql: q.sql, params: q.params }
  }

  const makeSelect = () => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = (cond: unknown) => {
      capture.wheres.push(compile(cond))
      return chain
    }
    for (const method of ['groupBy', 'orderBy', 'limit']) chain[method] = () => chain
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

describe('Y-85 插件统计 days clamp + make_interval 参数化', () => {
  beforeEach(() => {
    capture.wheres.length = 0
  })

  it('① 三个统计查询的窗口都编译成 make_interval 参数化,无 interval 字面量拼接', async () => {
    await getPluginStatsSummary(7)
    await getPluginStatsByPlugin(7, 20)
    await getPluginStatsTrend(7)

    expect(capture.wheres).toHaveLength(3)
    for (const w of capture.wheres) {
      expect(w.sql).toContain('make_interval(days => $1)')
      expect(w.sql).not.toMatch(/interval\s+'/)
      expect(w.params).toEqual([7])
    }
  })

  it('② days clamp:越界上/下限与非有限值被收口到 [1,365]', async () => {
    await getPluginStatsSummary(9999) // -> 365
    await getPluginStatsByPlugin(0, 20) // -> 1
    await getPluginStatsTrend(Number.NaN) // -> 7 (默认)

    expect(capture.wheres.map((w) => w.params)).toEqual([[365], [1], [7]])
  })

  it('③ 小数 days 被截断为整数,注入型字符串(number 强转后非有限)落默认值', async () => {
    await getPluginStatsSummary(7.9) // -> 7
    // 绕过 TS 类型 simulate 恶意调用方;clamp 必须把它收成安全默认值,绝不进 SQL 字面量
    await getPluginStatsByPlugin('1); DROP TABLE--' as unknown as number, 20)

    expect(capture.wheres[0]!.params).toEqual([7])
    expect(capture.wheres[1]!.params).toEqual([7])
    for (const w of capture.wheres) {
      expect(w.sql).toContain('make_interval(days => $1)')
      expect(w.sql).not.toContain('DROP TABLE')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
