// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:批次 3 小程序端预算停止与账本/边界的纯展示格式化(原因码文案不在本端)。

/**
 * 批次 3(2026-11-06):预算停止 / 上下文账本 / 压缩边界的**纯展示格式化**。
 *
 * 职责边界:
 *  · 停止原因码文案**不在本端写第二份** —— 唯一出口是
 *    `@ihui/shared/chat/budget-stop-note` 的 `budgetStopReasonText`(六码穷举 + 通用回落);
 *  · 本文件只拼"作用域/轮次/用量/剩余"这类附注,以及七类账本的固定顺序与百分比格式;
 *  · 百分比裁剪统一走 `@ihui/shared/utils/clamp-percent`,不内联手搓 Math.max/min。
 */
import {
  CONTEXT_LEDGER_CATEGORIES,
  type BudgetStopScope,
  type CompactBoundary,
  type ContextLedger,
  type ContextLedgerCategory,
  type PreservedSegmentAnchor,
} from '@ihui/shared'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import type { BudgetStopView } from '@/lib/chat-budget-ledger-frames'

/** 作用域中文附注(仅五个作用域,与原因码封闭集无关) */
const SCOPE_TEXT: Record<BudgetStopScope, string> = {
  daily: '按日额度',
  hourly: '按小时额度',
  pillar: '按能力支柱',
  request: '按单次请求',
  provider: '按上游供应商',
}

/** 百分比展示:整数不带 .0;其余保留一位小数(不做 0~100 裁剪,用量可能 >100)。 */
export function formatPercentValue(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** 停止附注:轮次 / 作用域(含支柱) / 用量 / 剩余 token;无可交代项 ⇒ 空串。 */
export function describeBudgetStopMeta(stop: BudgetStopView): string {
  const parts: string[] = []
  if (stop.stoppedAtIteration !== null) parts.push(`第 ${stop.stoppedAtIteration} 轮`)
  if (stop.scope !== null) {
    parts.push(stop.pillar ? `${SCOPE_TEXT[stop.scope]}·${stop.pillar}` : SCOPE_TEXT[stop.scope])
  } else if (stop.pillar) {
    parts.push(stop.pillar)
  }
  if (stop.usagePercent !== null) parts.push(`用量 ${formatPercentValue(stop.usagePercent)}%`)
  if (stop.remainingTokens !== null) {
    parts.push(`剩余 ${stop.remainingTokens.toLocaleString()} token`)
  }
  return parts.join(' · ')
}

/** 七类账本行(固定顺序;未知类别由解析层拦掉,这里只保证顺序)。 */
export function buildLedgerRows(
  ledger: ContextLedger,
): Array<{ category: ContextLedgerCategory; tokens: number; percent: number }> {
  const byCategory = new Map<ContextLedgerCategory, ContextLedger['categories'][number]>(
    ledger.categories.map((item) => [item.category, item] as const),
  )
  return CONTEXT_LEDGER_CATEGORIES.flatMap((category) => {
    const item = byCategory.get(category)
    return item ? [{ category, tokens: item.tokens, percent: item.percent }] : []
  })
}

/** 账本单类百分比文案(已裁剪到 0~100;免费空间与其他类同一格式)。 */
export function formatLedgerPercent(percent: number): string {
  return `${formatPercentValue(clampPercent(percent))}%`
}

/** 计量口径文案。 */
export function tokenizerText(tokenizer: ContextLedger['tokenizer']): string {
  return tokenizer === 'provider_usage' ? '上游 usage' : '本地估算'
}

/** 保留段展示槽位(顺序固定 head → anchor → tail)。 */
export type BoundarySlot = 'head' | 'anchor' | 'tail'

export interface BoundarySegmentView {
  slot: BoundarySlot
  anchor: PreservedSegmentAnchor
}

/** 只保留存在的锚点;null 槽不占行(不造空摘录)。 */
export function boundarySegmentViews(boundary: CompactBoundary): BoundarySegmentView[] {
  const slots: BoundarySlot[] = ['head', 'anchor', 'tail']
  return slots.flatMap((slot) => {
    const anchor = boundary.preservedSegment[slot]
    return anchor ? [{ slot, anchor }] : []
  })
}

/** 折叠区间文案(`#start – #end`);无区间 ⇒ null。 */
export function formatBoundaryRange(boundary: CompactBoundary): string | null {
  const range = boundary.removedRange
  return range ? `#${range.startIndex} – #${range.endIndex}` : null
}
