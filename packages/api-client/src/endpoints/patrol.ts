// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻 Agent 端点(2026-09-17 立,对应 apps/api /api/patrol/*)。
 * 创建巡检任务(CI/依赖/日志/死链/自定义)→ 服务端调度器到点自动巡检,
 * 发现问题主动建会话注入诊断 → 查看/暂停/恢复/立即巡检/删除/巡检历史。
 */

import { fetchApi } from '../client.js'

/** 巡检类型:ci=持续集成;dependency=依赖漏洞;log=错误日志;deadlink=死链;workspace=工作区健康;custom=自定义 */
export type PatrolType = 'ci' | 'dependency' | 'log' | 'deadlink' | 'workspace' | 'custom'

/** 巡检任务状态:active=启用中;paused=已暂停 */
export type PatrolStatus = 'active' | 'paused'

/** 单次巡检结论状态:ok=正常;issue=发现问题;error=执行失败 */
export type PatrolRunStatus = 'ok' | 'issue' | 'error'

/** 上次巡检结果(服务端 jsonb) */
export interface PatrolLastResult {
  finishedAt: string
  status: PatrolRunStatus
  summary: string
  /** 告警会话 id(仅 issue 时写入,用于深链打开对话) */
  conversationId?: string
}

/** 巡检任务(对应后端 patrol_tasks 行) */
export interface PatrolTask {
  id: string
  userId: string
  name: string
  patrolType: PatrolType
  target: string | null
  prompt: string | null
  rrule: string
  timezone: string
  status: PatrolStatus
  notifyConversationId: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  lastResult: PatrolLastResult | null
  createdAt: string
  updatedAt: string
}

/** 巡检执行历史(对应后端 patrol_runs 行) */
export interface PatrolRun {
  id: string
  taskId: string
  status: PatrolRunStatus
  summary: string
  conversationId: string | null
  createdAt: string
}

export interface CreatePatrolInput {
  name: string
  patrolType?: PatrolType
  target?: string
  prompt?: string
  /** 如 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0' */
  rrule: string
  timezone?: string
}

export interface UpdatePatrolInput {
  name?: string
  patrolType?: PatrolType
  target?: string | null
  prompt?: string | null
  rrule?: string
  timezone?: string
  status?: PatrolStatus
}

export interface ListPatrolResult {
  items: PatrolTask[]
  total: number
}

export interface PatrolRunNowResult {
  id: string
  status: PatrolRunStatus
  summary: string
  conversationId: string | null
}

function assertOk<T>(res: { success: boolean; data?: T; error?: string }): T {
  if (!res.success) throw new Error(res.error ?? '请求失败')
  return res.data as T
}

/** 获取巡检任务列表(当前用户) */
export async function listPatrolTasks(params?: {
  limit?: number
  offset?: number
}): Promise<ListPatrolResult> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString()
  const res = await fetchApi<ListPatrolResult>(`/patrol${query ? `?${query}` : ''}`)
  return assertOk(res)
}

/** 创建巡检任务 */
export async function createPatrolTask(input: CreatePatrolInput): Promise<PatrolTask> {
  const res = await fetchApi<PatrolTask>('/patrol', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return assertOk(res)
}

/** 部分更新巡检任务 */
export async function updatePatrolTask(id: string, input: UpdatePatrolInput): Promise<PatrolTask> {
  const res = await fetchApi<PatrolTask>(`/patrol/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return assertOk(res)
}

/** 删除巡检任务(cascade 删除巡检历史) */
export async function deletePatrolTask(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetchApi<{ id: string; deleted: boolean }>(
    `/patrol/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  return assertOk(res)
}

/** 立即巡检一次(阻塞直到 agent 巡检完成,返回判定结果) */
export async function runPatrolTaskNow(id: string): Promise<PatrolRunNowResult> {
  const res = await fetchApi<PatrolRunNowResult>(`/patrol/${encodeURIComponent(id)}/run-now`, {
    method: 'POST',
    timeoutMs: 300_000,
  })
  return assertOk(res)
}

/** 获取巡检执行历史(倒序) */
export async function listPatrolRuns(
  id: string,
  params?: { limit?: number },
): Promise<{ items: PatrolRun[] }> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  const query = qs.toString()
  const res = await fetchApi<{ items: PatrolRun[] }>(
    `/patrol/${encodeURIComponent(id)}/runs${query ? `?${query}` : ''}`,
  )
  return assertOk(res)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
