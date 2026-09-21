// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { fetchApi } from '@/lib/api'

/**
 * Agent Plan 任务进度(Plan Mode)前端 API 客户端(2026-09-03 立,对标 Claude Code Plan Mode)。
 *
 * 服务端契约(apps/ai-service 的 routers/agent_plan.py,挂载到 /api/agent-plan/*):
 *  - GET /api/agent-plan/{plan_id}                     → 计划状态/内容/结果
 *  - GET /api/agent-plan/{plan_id}/versions            → 版本历史(含当前版本)
 *  - GET /api/agent-plan/{plan_id}/versions/diff       → 两版本轻量 diff
 *  - GET /api/agent-plan/{plan_id}/tasks               → task 列表 + done/total 进度摘要
 *  - POST /api/agent-plan/{plan_id}/tasks/sync         → 重新展开 task
 *  - POST /api/agent-plan/{plan_id}/tasks/{task_id}/status → 更新单任务勾选态
 *
 * 响应统一用 ApiResult 包装,成功时 data 为对应结构体。
 */

/** 单个 task(勾选态 pending/done/blocked) */
export interface PlanTask {
  task_id: string
  order: number
  title: string
  status: 'pending' | 'done' | 'blocked'
}

/** GET /api/agent-plan/{plan_id}/tasks 响应 */
export interface PlanTasksResult {
  plan_id: string
  tasks: PlanTask[]
  summary: { total: number; done: number; blocked: number }
  task_statuses: string[]
}

/** GET /api/agent-plan/{plan_id}/versions 响应 */
export interface PlanVersionsResult {
  plan_id: string
  current_version: number
  versions: Array<{ version: number; reason: string; channel: string; created_at: string }>
}

/** GET /api/agent-plan/{plan_id} 响应(计划详情) */
export interface PlanDetail {
  plan_id: string
  goal: string
  status: string
  plan_md: string
  readonly_tools: string[]
  session_id: string | null
  created_at: string
  updated_at: string | null
  result: Record<string, unknown> | null
  version: number
  tasks: PlanTask[]
}

/** 查询某计划的 task 列表与进度摘要 */
export async function fetchPlanTasks(planId: string): Promise<PlanTasksResult> {
  const r = await fetchApi<PlanTasksResult>(`/api/agent-plan/${encodeURIComponent(planId)}/tasks`)
  if (!r.success) throw new Error(r.error || '加载任务进度失败')
  return r.data
}

/** 查询某计划的版本历史(含当前版本) */
export async function fetchPlanVersions(planId: string): Promise<PlanVersionsResult> {
  const r = await fetchApi<PlanVersionsResult>(
    `/api/agent-plan/${encodeURIComponent(planId)}/versions`,
  )
  if (!r.success) throw new Error(r.error || '加载版本历史失败')
  return r.data
}

/** 查询计划详情(状态/内容/结果) */
export async function fetchPlanDetail(planId: string): Promise<PlanDetail> {
  const r = await fetchApi<PlanDetail>(`/api/agent-plan/${encodeURIComponent(planId)}`)
  if (!r.success) throw new Error(r.error || '加载计划失败')
  return r.data
}

/** 对比两个版本的 markdown 差异,返回 diff 文本 */
export async function fetchPlanVersionDiff(
  planId: string,
  fromVersion: number,
  toVersion: number,
): Promise<{ plan_id: string; from_version: number; to_version: number; diff: string }> {
  const qs = new URLSearchParams()
  qs.set('from_version', String(fromVersion))
  qs.set('to_version', String(toVersion))
  const r = await fetchApi<{
    plan_id: string
    from_version: number
    to_version: number
    diff: string
  }>(`/api/agent-plan/${encodeURIComponent(planId)}/versions/diff?${qs.toString()}`)
  if (!r.success) throw new Error(r.error || '加载版本差异失败')
  return r.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
