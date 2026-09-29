// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815953:批量回填的**时间上界谓词**唯一出口。
 *
 * 为什么必须有它:回填脚本若按"当前最新数据"重算历史,会把用户在两次迁移之间写进去的值
 * 当旧格式覆盖 —— 上游的解法是 JOIN schema_migration 取「上一次迁移的应用时刻」,
 * 只碰此后**无人动过**的行(e.time_updated <= m.time_applied)。本出口把那条语义钉成
 * 一个不写上界就过不了编译/跑不起的函数:
 *  - `baselineTime` 缺失/非法 ⇒ **throw**(fail-closed),不回落"无上界";
 *  - 返回的谓词一律含 `<= baseline` 上界,调用方不得再自拼 `and()` 绕过它。
 *
 * 与守门 134 的 batchWriteOutcome 同形:出口先给出来,下一个回填落点只能走这里。
 */
import { and, lte, type SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/** 回填的时间列(通常是被回填表的 updated_at/created_at)。 */
export type BackfillTimeColumn = AnyPgColumn

/** 校验基线时刻:必须是有限时间。给不出 ⇒ 宁可不跑,绝不无界回填。 */
export function assertBaselineTime(baselineTime: Date | string | null | undefined): Date {
  const d = baselineTime instanceof Date ? baselineTime : baselineTime != null ? new Date(baselineTime) : null
  if (!d || Number.isNaN(d.getTime())) {
    throw new Error(
      '回填基线时刻缺失或非法:拒绝执行无上界的回填(会把迁移之间用户写入的值当旧格式覆盖)。' +
        '传入「上一次迁移的应用时刻」(如 schema_migration.time_applied)。',
    )
  }
  return d
}

/**
 * 回填 where 的唯一出口:强制带上时间上界。
 * `conditions` 是业务过滤(如 isNull(某列));本函数保证最终谓词 = conditions ∧ (col <= baseline)。
 */
export function backfillWhere(options: {
  column: BackfillTimeColumn
  baselineTime: Date | string
  conditions?: SQL[]
}): SQL {
  const baseline = assertBaselineTime(options.baselineTime)
  const bounds = lte(options.column, baseline)
  const conds = options.conditions ?? []
  return (conds.length > 0 ? and(...conds, bounds) : and(bounds)) as SQL
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
