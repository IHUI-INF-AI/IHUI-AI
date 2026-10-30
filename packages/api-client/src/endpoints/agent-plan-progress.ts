// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/**
 * Agent Plan 任务进度 / 版本历史端点(计划模式的可追踪面,对标 Claude Code Plan Mode)。
 *
 * 与 web 同一契约(apps/web/src/api/agent-plan-api.ts:10-19 逐字对齐),后端实现现读
 * apps/ai-service/app/routers/agent_plan.py:
 *  - GET /api/agent-plan/{plan_id}/versions   → :290  版本历史(含当前版本,version 升序)
 *  - GET /api/agent-plan/{plan_id}/versions/diff?from_version=&to_version= → :308 两版本轻量 diff
 *  - GET /api/agent-plan/{plan_id}/tasks      → :353  task 列表 + done/total/blocked 摘要
 * 三端点均为 {code:0,message:'ok',data:{...}} 信封(见 :259-280 同族处理器),故统一走 fetchApi 拆壳。
 *
 * 计划详情 / 创建 / 决策不在本文件:见既有 endpoints/agent-plan.ts(getAgentPlan / createAgentPlan /
 * decideAgentPlan),本文件只补「进度可视化」缺的三只读查询,不复刻既有封装。
 *
 * 如实登记:apps/api 全仓无 /api/agent-plan 前缀注册;web 侧由 next rewrites 直转 8803
 * (apps/web/next.config.ts:320),RN 通道依赖同一网关转发。
 */

/** 单个 task(勾选态 pending/done/blocked)—— 对齐 ai-service _tasks_response */
export interface PlanTaskView {
  task_id: string
  order: number
  title: string
  status: 'pending' | 'done' | 'blocked'
}

/** GET /api/agent-plan/{plan_id}/tasks 响应数据 */
export interface PlanTasksResult {
  plan_id: string
  tasks: PlanTaskView[]
  summary: { total: number; done: number; blocked: number }
  task_statuses: string[]
}

/** GET /api/agent-plan/{plan_id}/versions 响应数据 */
export interface PlanVersionsResult {
  plan_id: string
  current_version: number
  versions: Array<{ version: number; reason: string; channel: string; created_at: string }>
}

/** GET /api/agent-plan/{plan_id}/versions/diff 响应数据 */
export interface PlanVersionDiffResult {
  plan_id: string
  from_version: number
  to_version: number
  diff: string
}

/** 查询某计划的 task 列表与进度摘要(done/total/blocked)。 */
export async function fetchAgentPlanTasks(planId: string): Promise<ApiResult<PlanTasksResult>> {
  return fetchApi<PlanTasksResult>(`/api/agent-plan/${encodeURIComponent(planId)}/tasks`)
}

/** 查询某计划的版本历史(含当前版本)。 */
export async function fetchAgentPlanVersions(
  planId: string,
): Promise<ApiResult<PlanVersionsResult>> {
  return fetchApi<PlanVersionsResult>(`/api/agent-plan/${encodeURIComponent(planId)}/versions`)
}

/** 对比两个版本的 markdown 差异,返回 diff 文本。 */
export async function fetchAgentPlanVersionDiff(
  planId: string,
  fromVersion: number,
  toVersion: number,
): Promise<ApiResult<PlanVersionDiffResult>> {
  const qs = new URLSearchParams()
  qs.set('from_version', String(fromVersion))
  qs.set('to_version', String(toVersion))
  return fetchApi<PlanVersionDiffResult>(
    `/api/agent-plan/${encodeURIComponent(planId)}/versions/diff?${qs.toString()}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
