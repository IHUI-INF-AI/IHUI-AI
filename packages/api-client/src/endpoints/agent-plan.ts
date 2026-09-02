// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent Plan Mode(计划模式)端点(2026-09-02 立)。
 *
 * 对标 Claude Code Plan Mode:先让 LLM 生成一份可编辑的执行计划(只读阶段),
 * 用户确认/编辑后再同步执行。后端路由见 apps/ai-service/app/routers/agent_plan.py,
 * 经 web 8802 代理以 `/api/agent-plan*` 暴露:
 *  - POST   /api/agent-plan                  → 创建计划草稿
 *  - GET    /api/agent-plan/{plan_id}         → 查询计划状态与内容
 *  - POST   /api/agent-plan/{plan_id}/decision → 批准(同步执行)/拒绝
 *
 * 后端均返回标准 `{ code: 0, data: {...} }` 包装,故统一走 `fetchApi`。
 * 注意:decision 批准是同步阻塞执行,耗时可达分钟级,需设置足够超时(>=120s)。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// ===================== 类型定义 =====================

/** 计划状态机:draft → approved/executing → done/failed,或 → rejected */
export type AgentPlanStatus = 'draft' | 'approved' | 'rejected' | 'executing' | 'done' | 'failed'

/** 创建计划草稿的响应数据 */
export interface AgentPlanCreateResult {
  /** 计划 ID */
  plan_id: string
  /** 生成的计划 markdown(可编辑) */
  plan_md: string
  /** 只读工具白名单(执行阶段工具集的上限) */
  readonly_tools: string[]
}

/** 计划执行结果(批准执行后回填) */
export interface AgentPlanResult {
  /** 是否执行成功 */
  success: boolean
  /** 最终回复文本 */
  final_response: string
  /** 停止原因 */
  stop_reason: string
  /** 错误信息(失败/异常时存在) */
  error: string | null
  /** 实际迭代轮数 */
  iterations: number
}

/** 查询计划详情的响应数据 */
export interface AgentPlanDetail {
  plan_id: string
  goal: string
  status: AgentPlanStatus
  plan_md: string
  readonly_tools: string[]
  session_id: string | null
  created_at: string
  updated_at: string
  result: AgentPlanResult | null
}

/** 决策(批准/拒绝)的响应数据 */
export interface AgentPlanDecisionResult {
  plan_id: string
  status: AgentPlanStatus
  result: AgentPlanResult | null
}

/** 创建计划草稿入参 */
export interface CreateAgentPlanInput {
  /** 计划目标 / 任务描述 */
  goal: string
  /** 关联会话 ID(可选) */
  session_id?: string
  /** 指定模型(可选) */
  model?: string
}

/** 决策入参 */
export interface DecideAgentPlanInput {
  /** true=批准执行,false=拒绝 */
  approve: boolean
  /** 用户编辑后的计划 markdown(批准时以此为准) */
  edited_plan_md?: string
  /** 限定执行工具名(必须是只读子集;省略=全部只读工具) */
  tools?: string[]
  /**
   * 自定义超时(毫秒)。批准执行是同步阻塞,默认 130_000(>=120s),
   * 调用方可按需覆盖。<=0 时回退到 fetchApi 默认 30s。
   */
  timeoutMs?: number
}

// ===================== 接口函数 =====================

/** 创建计划草稿(只读阶段,LLM 生成可编辑计划)。 */
export async function createAgentPlan(
  input: CreateAgentPlanInput,
): Promise<ApiResult<AgentPlanCreateResult>> {
  const body: Record<string, unknown> = { goal: input.goal }
  if (input.session_id !== undefined) body.session_id = input.session_id
  if (input.model !== undefined) body.model = input.model
  return fetchApi<AgentPlanCreateResult>('/api/agent-plan', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 查询计划状态与内容。 */
export async function getAgentPlan(planId: string): Promise<ApiResult<AgentPlanDetail>> {
  return fetchApi<AgentPlanDetail>(`/api/agent-plan/${encodeURIComponent(planId)}`)
}

/**
 * 批准(同步执行)/拒绝计划。
 *
 * 批准路径后端同步阻塞执行,可能耗时分钟级,默认超时 130s,
 * 调用方务必展示执行中状态并禁用按钮防重复提交。
 */
export async function decideAgentPlan(
  planId: string,
  input: DecideAgentPlanInput,
): Promise<ApiResult<AgentPlanDecisionResult>> {
  const body: Record<string, unknown> = { approve: input.approve }
  if (input.approve) {
    if (input.edited_plan_md !== undefined) body.edited_plan_md = input.edited_plan_md
    if (input.tools !== undefined) body.tools = input.tools
  }
  return fetchApi<AgentPlanDecisionResult>(
    `/api/agent-plan/${encodeURIComponent(planId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : 130_000,
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
