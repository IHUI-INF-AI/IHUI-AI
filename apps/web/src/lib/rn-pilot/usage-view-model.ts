// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 用量页 → 共享 UsageScreen 视图模型的适配层。
 *
 * 取数契约保持改造前 web 现读:`GET /api/v1/ai/usage/stats?days=30` 与
 * `GET /api/v1/ai/usage/quota`。共享屏只接收 `stats / quota / loading / error`,
 * 取数基址与鉴权门留在 web wrapper;文案按共享屏的 `usage.*` 键映射到 web 既有中文口径。
 */

import type { TFunction } from '@ihui/types'
import type { UsageBreakdownRow, UsageQuota, UsageStats } from '@ihui/rn-app/pilot'

/** web 侧请求载荷(与后端 usage.py 同源;共享屏类型补齐 user_id/days 两个元字段)。 */
export interface WebUsageBreakdownRow {
  total_tokens: number
  cost: number
  calls?: number
  input_tokens?: number
  output_tokens?: number
}

export interface WebUsageStats {
  total_tokens: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  total_calls: number
  daily_breakdown: Record<string, WebUsageBreakdownRow>
  model_breakdown: Record<string, WebUsageBreakdownRow>
  provider_breakdown: Record<string, WebUsageBreakdownRow>
}

/** web 侧配额载荷。 */
export interface WebUsageQuota {
  used_tokens: number
  quota_limit: number
  remaining: number
  usage_percent: number
}

/**
 * 共享 TFunction 的文案注入。
 *
 * 改造前 web 用量页文案为页面内中文常量,web 词表没有 `usage.*` 键;这里逐键给出
 * 同一中文口径,保持展示文案不变(不新增 i18n 键,不改共享词包)。
 */
const USAGE_COPY: Record<string, string> = {
  'common.back': '返回',
  'usage.title': '用量统计',
  'usage.quotaTitle': '本月用量',
  'usage.periodMonth': '本月',
  'usage.used': '已用',
  'usage.limit': '额度',
  'usage.remaining': '剩余',
  'usage.usagePercent': '配额使用率',
  'usage.statsTitle': '用量汇总',
  'usage.totalTokens': '总 Token',
  'usage.totalCost': '总花费',
  'usage.totalCalls': '总调用',
  'usage.inputTokens': '输入',
  'usage.outputTokens': '输出',
  'usage.dailyTitle': '日用量趋势(近 14 天)',
  'usage.modelTitle': '模型用量分布',
  'usage.noData': '暂无数据',
  'usage.retry': '重试',
}

export function createUsageT(): TFunction {
  return (key) => USAGE_COPY[key] ?? key
}

/** 请求体 → 共享屏 UsageStats(补齐共享类型要求的 user_id/days 与行内 input/output 元字段)。 */
export function toUsageStats(raw: WebUsageStats | null | undefined): UsageStats | null {
  if (!raw) return null
  return {
    user_id: '',
    days: 30,
    total_tokens: raw.total_tokens,
    total_input_tokens: raw.total_input_tokens,
    total_output_tokens: raw.total_output_tokens,
    total_cost: raw.total_cost,
    total_calls: raw.total_calls,
    daily_breakdown: toBreakdown(raw.daily_breakdown),
    model_breakdown: toBreakdown(raw.model_breakdown),
    provider_breakdown: toBreakdown(raw.provider_breakdown),
  }
}

function toBreakdown(
  rows: Record<string, WebUsageBreakdownRow>,
): Record<string, UsageBreakdownRow> {
  return Object.fromEntries(
    Object.entries(rows).map(([key, row]) => [
      key,
      {
        input_tokens: row.input_tokens ?? 0,
        output_tokens: row.output_tokens ?? 0,
        total_tokens: row.total_tokens,
        cost: row.cost,
        calls: row.calls,
      },
    ]),
  )
}

/** 请求体 → 共享屏 UsageQuota(补齐 user_id 元字段)。 */
export function toUsageQuota(raw: WebUsageQuota | null | undefined): UsageQuota | null {
  if (!raw) return null
  return {
    user_id: '',
    used_tokens: raw.used_tokens,
    quota_limit: raw.quota_limit,
    remaining: raw.remaining,
    usage_percent: raw.usage_percent,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
