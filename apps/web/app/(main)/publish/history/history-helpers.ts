// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 发布历史的 URL 状态筛选归一化。
 *
 * 为什么单独抽出来：`/start` 的今日队列要直达“待确认草稿/失败待处理”，
 * 历史页就必须认 `?status=draft`，而且不能让任意字符串把筛选器打成空值。
 * 允许集合与 FilterBar、TaskCard 的状态口径保持一致。
 */
export const HISTORY_STATUS_FILTERS = [
  'all',
  'draft',
  'scheduled',
  'running',
  'success',
  'partial',
  'failed',
  'skipped',
  'cancelled',
] as const

export type HistoryStatusFilter = (typeof HISTORY_STATUS_FILTERS)[number]

export function normalizeHistoryStatusFilter(value: string | null | undefined): HistoryStatusFilter {
  const normalized = (value ?? '').trim().toLowerCase()
  return (HISTORY_STATUS_FILTERS as readonly string[]).includes(normalized)
    ? (normalized as HistoryStatusFilter)
    : 'all'
}
