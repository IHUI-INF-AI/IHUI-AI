// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-151 回归锁(2026-11-13)。
 *
 * 病灶:插件安装/点击统计用 `current_date` 与裸 `to_char(created_at, ...)`,日界取会话时区
 * (默认 UTC),导致每日 0-8 点「今日」数据偏高、趋势与上海业务日看板不一致。
 *
 * 本文件锁:
 *   ① 生成的统计 SQL 不再出现裸 `current_date`;
 *   ② 日界显式换算到 `Asia/Shanghai`(`(created_at AT TIME ZONE 'Asia/Shanghai')::date`);
 *   ③ 「今日安装」「今日点击」两个指标走同一日界,趋势按天同样按本地日归组。
 *
 * 只 mock db(select 链),SQL 文本由 PgDialect 编译,不连真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const capture = vi.hoisted(() => ({
  /** 每次 db.select(projection) 的字段名 → 编译后的 SQL 文本 */
  projections: [] as Array<Record<string, string>>,
}))

vi.mock('../src/db/index.js', async () => {
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  // 投影里既有 SQL 片段(count -> SQL),也有裸列引用(pluginId -> PgColumn,经 getSQL 取片段)。
  const compile = (expr: unknown): string => {
    const wrapper = expr as { getSQL?: () => unknown }
    const fragment = typeof wrapper?.getSQL === 'function' ? wrapper.getSQL() : expr
    return dialect.sqlToQuery(fragment as never).sql
  }

  const makeSelect = (projection: Record<string, unknown>) => {
    capture.projections.push(
      Object.fromEntries(Object.entries(projection).map(([key, expr]) => [key, compile(expr)])),
    )
    const chain: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'groupBy', 'orderBy', 'limit']) {
      chain[method] = () => chain
    }
    // 聚合查询的调用方直接 await 链式结果;这里统一返回空结果集(本文件只锁 SQL 文本)。
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

const LOCAL_DAY_BOUNDARY = `("plugin_events"."created_at" AT TIME ZONE 'Asia/Shanghai')::date`

const allSqlTexts = (): string => capture.projections.flatMap((p) => Object.values(p)).join('\n')

describe('F-151 插件统计日界必须按 Asia/Shanghai 计算', () => {
  beforeEach(() => {
    capture.projections.length = 0
  })

  it('① 三个统计查询都不再出现裸 current_date', async () => {
    await getPluginStatsSummary(7)
    await getPluginStatsByPlugin(7, 20)
    await getPluginStatsTrend(7)

    expect(capture.projections).toHaveLength(3)
    expect(allSqlTexts()).not.toMatch(/\bcurrent_date\b/)
  })

  it('② 今日安装 / 今日点击走同一 Asia/Shanghai 日界', async () => {
    await getPluginStatsSummary(7)

    const summary = capture.projections[0]!
    expect(summary.todayInstalls).toContain(LOCAL_DAY_BOUNDARY)
    expect(summary.todayClicks).toContain(LOCAL_DAY_BOUNDARY)
    expect(summary.todayInstalls).toContain(`'install'`)
    expect(summary.todayClicks).toContain(`'click'`)
    // 日界两端(事件日 / 当前日)都在本地时区,不再依赖会话时区的 current_date
    expect(summary.todayInstalls).toContain(`(now() AT TIME ZONE 'Asia/Shanghai')::date`)
    expect(summary.todayClicks).toContain(`(now() AT TIME ZONE 'Asia/Shanghai')::date`)
  })

  it('③ 按天趋势同样按 Asia/Shanghai 归日', async () => {
    await getPluginStatsTrend(7)

    const trend = capture.projections[0]!
    expect(trend.date).toContain('to_char(')
    expect(trend.date).toContain(LOCAL_DAY_BOUNDARY)
    expect(trend.date).not.toMatch(/\bcurrent_date\b/)
  })
})
