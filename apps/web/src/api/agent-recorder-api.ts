// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { fetchApi } from '@/lib/api'

/**
 * Agent Step 录制回放(Record & Replay)前端 API 客户端(2026-09-03 立,对标 WorkBuddy/Codex 审计)。
 *
 * 服务端契约(apps/ai-service 的 routers/step_recorder.py,挂载到 /api/agent-recorder):
 *  - GET /api/agent-recorder/runs/{run_id}/steps?page=&page_size=  → 该运行 step 序列(时间序分页)
 *  - GET /api/agent-recorder/runs/{run_id}/replay?step_index=N     → 全量回放或单步回看
 *  - GET /api/agent-recorder/runs/{run_id}/metrics                 → 步数/成败/token/耗时/成本聚合
 *
 * 响应统一用 ApiResult 包装,成功时 data 为对应结构体;鉴权失败(status=401)由
 * 调用方提示"请先登录"(get_current_user_id 依赖登录态)。
 */

/** 单条 step(字段与后端 agent_step_recorder 归一化结构对其) */
export interface RunStep {
  step_index: number
  type: 'tool' | 'message' | 'plan'
  tool_name: string
  input_summary: string
  result_summary: string
  status: 'ok' | 'error'
  tokens: number
  tokens_in: number
  tokens_out: number
  duration_ms: number
  cost: number
  http_summary: string
  at: string
}

/** GET /api/agent-recorder/runs/{run_id}/steps 响应 */
export interface RunStepsResult {
  list: RunStep[]
  total: number
  page: number
  pageSize: number
}

/** GET /api/agent-recorder/runs/{run_id}/replay 响应(全量回放) */
export interface RunReplayResult {
  run_id: string
  steps: RunStep[]
  total: number
}

/** GET /api/agent-recorder/runs/{run_id}/metrics 响应 */
export interface RunMetricsResult {
  run_id: string
  step_count: number
  ok_count: number
  error_count: number
  total_tokens: number
  total_tokens_in: number
  total_tokens_out: number
  total_duration_ms: number
  total_cost: number
}

/** 按时间序分页列出某运行的 step 序列 */
export async function fetchRunSteps(
  runId: string,
  page = 1,
  pageSize = 50,
): Promise<RunStepsResult> {
  const r = await fetchApi<RunStepsResult>(
    `/api/agent-recorder/runs/${encodeURIComponent(runId)}/steps?page=${page}&page_size=${pageSize}`,
  )
  if (!r.success) throw new Error(r.error || '加载 step 序列失败')
  return r.data
}

/** 全量回放指定的运行步骤序列 */
export async function fetchRunReplay(runId: string): Promise<RunReplayResult> {
  const r = await fetchApi<RunReplayResult>(
    `/api/agent-recorder/runs/${encodeURIComponent(runId)}/replay`,
  )
  if (!r.success) throw new Error(r.error || '回放失败')
  return r.data
}

/** 获取单运行聚合指标:步数/成败/总 token/总耗时/总成本 */
export async function fetchRunMetrics(runId: string): Promise<RunMetricsResult> {
  const r = await fetchApi<RunMetricsResult>(
    `/api/agent-recorder/runs/${encodeURIComponent(runId)}/metrics`,
  )
  if (!r.success) throw new Error(r.error || '加载指标失败')
  return r.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
