// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { fetchApi } from '@/lib/api'

/**
 * 成本看板(Cost Ledger)前端 API 客户端(2026-09-03 立)。
 *
 * 服务端契约(apps/ai-service 的 routers/cost_ledger.py,挂载到 /api/cost-ledger):
 *  - GET /api/cost-ledger/summary     → totals + by_tool/by_model + window 聚合
 *  - GET /api/cost-ledger/timeseries  → 时间序列走势(?granularity=hour|day)
 *  - GET /api/cost-ledger/top-tools   → Cost 降序 Top 工具
 *  - GET /api/cost-ledger/query       → 原始账目详情行(内存分页)
 *
 * 响应统一用 Envelope {code, message, data} 包装;成功时 data 为对应结构体;
 * 鉴权失败(status=401)由调用方提示"请先登录"(get_current_user_id 依赖登录态)。
 */

/** by_tool / by_model 里单聚合项(按 name 归并) */
export interface CostBreakdownItem {
  steps: number
  tokens_in: number
  tokens_out: number
  tokens: number
  cost: number
}

/** GET /api/cost-ledger/summary 响应 data */
export interface CostSummary {
  steps: number
  count: number
  ok_count: number
  error_count: number
  estimated_count: number
  total_tokens_in: number
  total_tokens_out: number
  total_tokens: number
  total_cost: number
  total_duration_ms: number
  by_tool: Record<string, CostBreakdownItem>
  by_model: Record<string, CostBreakdownItem>
  window: { start: string | null; end: string | null } | null
}

/** GET /api/cost-ledger/timeseries 响应 data 中的单桶 */
export interface CostTimeseriesBucket {
  bucket: string
  steps: number
  tokens_in: number
  tokens_out: number
  tokens: number
  cost: number
}

/** GET /api/cost-ledger/timeseries 响应 data */
export type CostTimeseries = CostTimeseriesBucket[]

/** 拉取成本聚合总览(含 by_tool / by_model)。失败抛错。 */
export async function fetchCostSummary(): Promise<CostSummary> {
  const r = await fetchApi<CostSummary>('/api/cost-ledger/summary')
  if (!r.success) throw new Error(r.error || '加载成本总览失败')
  return r.data
}

/** 拉取成本/ token 时间序列走势(granularity: hour | day)。失败抛错。 */
export async function fetchCostTimeseries(
  granularity: 'hour' | 'day' = 'day',
): Promise<CostTimeseries> {
  const r = await fetchApi<CostTimeseries>(
    `/api/cost-ledger/timeseries?granularity=${granularity}`,
  )
  if (!r.success) throw new Error(r.error || '加载成本走势失败')
  return r.data
}
// ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠