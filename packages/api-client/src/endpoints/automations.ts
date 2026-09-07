// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 用户侧 Agent 定时自动化端点(2026-09-07 立,对应 apps/api /api/automations/*)。
 * 创建定时任务 → 服务端调度器到点自动执行 agent → 查看结果/暂停/恢复/立即运行/删除。
 */

import { fetchApi } from '../client'

/** 自动化计划类型:once=一次性定时;recurring=按 rrule 重复 */
export type AutomationScheduleType = 'once' | 'recurring'

/** 自动化状态:active=启用中;paused=已暂停 */
export type AutomationStatus = 'active' | 'paused'

/** 上次执行结果摘要(服务端 jsonb) */
export interface AutomationLastResult {
  finishedAt: string
  summary: string
}

/** 用户自动化(对应后端 user_automations 行) */
export interface UserAutomation {
  id: string
  userId: string
  name: string
  prompt: string
  scheduleType: AutomationScheduleType
  rrule: string | null
  scheduledAt: string | null
  timezone: string
  status: AutomationStatus
  lastRunAt: string | null
  nextRunAt: string | null
  lastResult: AutomationLastResult | null
  createdAt: string
  updatedAt: string
}

export interface CreateAutomationInput {
  name: string
  prompt: string
  scheduleType: AutomationScheduleType
  /** recurring 必填,如 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0' */
  rrule?: string
  /** once 必填,ISO 8601(含时区偏移) */
  scheduledAt?: string
  timezone?: string
}

export interface UpdateAutomationInput {
  name?: string
  prompt?: string
  rrule?: string
  scheduledAt?: string | null
  timezone?: string
  status?: AutomationStatus
}

export interface ListAutomationsResult {
  items: UserAutomation[]
  total: number
}

export interface RunAutomationResult {
  id: string
  summary: string
}

function assertOk<T>(res: { success: boolean; data?: T; error?: string }): T {
  if (!res.success) throw new Error(res.error ?? '请求失败')
  return res.data as T
}

/** 获取自动化列表(当前用户) */
export async function listAutomations(params?: {
  limit?: number
  offset?: number
}): Promise<ListAutomationsResult> {
  const qs = new URLSearchParams()
  if (params?.limit !== undefined) qs.set('limit', String(params.limit))
  if (params?.offset !== undefined) qs.set('offset', String(params.offset))
  const query = qs.toString()
  const res = await fetchApi<ListAutomationsResult>(`/automations${query ? `?${query}` : ''}`)
  return assertOk(res)
}

/** 获取自动化详情 */
export async function getAutomation(id: string): Promise<UserAutomation> {
  const res = await fetchApi<UserAutomation>(`/automations/${encodeURIComponent(id)}`)
  return assertOk(res)
}

/** 创建自动化 */
export async function createAutomation(input: CreateAutomationInput): Promise<UserAutomation> {
  const res = await fetchApi<UserAutomation>('/automations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return assertOk(res)
}

/** 更新自动化(部分字段) */
export async function updateAutomation(
  id: string,
  input: UpdateAutomationInput,
): Promise<UserAutomation> {
  const res = await fetchApi<UserAutomation>(`/automations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return assertOk(res)
}

/** 删除自动化 */
export async function deleteAutomation(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetchApi<{ id: string; deleted: boolean }>(
    `/automations/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  return assertOk(res)
}

/** 立即执行一次(阻塞直到 agent 执行完成,返回摘要) */
export async function runAutomation(id: string): Promise<RunAutomationResult> {
  const res = await fetchApi<RunAutomationResult>(`/automations/${encodeURIComponent(id)}/run-now`, {
    method: 'POST',
    timeoutMs: 300_000,
  })
  return assertOk(res)
}
// ⁠[IHUI-AI-PROVENANCE] automations endpoint · IHUI AI (智汇AI) · 李春川 · aizhs.top
