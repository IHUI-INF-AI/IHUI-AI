// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池任务中心 web 客户端层(号池对标批 O68;结清枚
 * 20276cb1d9f91acd5d53d35c2f6e03c6d92edd9c —— 台账上此刻同号者与此无关)。
 *
 * 职责:WorkBuddy 任务自动化(growth/travel/activity/blackcat)在 admin 任务中心页的
 * 取数与触发口 —— 只包两个后端转发路由(GET/POST /api/admin/relay/accounts/:id/*)
 * 与号池账号下拉源。机主定案「观测面+手动触发」在这里的落点 = 手动触发 + 展示,
 * 不新造调度器(与服务端 relay-task-center.ts 同一边界承诺)。
 *
 * 三态契约(与路由侧逐键对齐):`unjudged:true` 是"未判定",绝不渲染成
 * "无任务/0 积分";`creditDelta/energyDelta` 为 null = 没量到,不是 0。
 */
import { apiOrThrow } from '@/lib/api'

/** 任务触发 kind(与 ai-service task-run 白名单逐字一致) */
export type WorkbuddyTaskKind = 'growth' | 'travel' | 'activity' | 'blackcat'

export const WORKBUDDY_TASK_KINDS: readonly WorkbuddyTaskKind[] = [
  'growth',
  'travel',
  'activity',
  'blackcat',
]

/** 单条任务(progress/target/奖励族:null = 引擎没给,不是 0) */
export interface WorkbuddyTaskItem {
  taskCode: string
  title: string
  progress: number | null
  target: number | null
  status: string | null
  acceptStatus: string | null
  rewardCredit: number | null
  rewardEnergy: number | null
  validTo: string | null
}

export interface WorkbuddyTasksView {
  ok: boolean
  tasks: WorkbuddyTaskItem[]
  reason: string | null
  unjudged: boolean
}

export interface WorkbuddyTaskRunView {
  ok: boolean
  kind: WorkbuddyTaskKind
  accepted: string[]
  claimed: string[]
  creditDelta: number | null
  energyDelta: number | null
  reason: string | null
  unjudged: boolean
}

export interface WorkbuddyAccountOption {
  id: string
  name: string
}

/** WorkBuddy 号池账号下拉源(分页一次拉满 100,任务自动化面向的是小池子) */
export async function fetchWorkbuddyAccounts(): Promise<WorkbuddyAccountOption[]> {
  const data = await apiOrThrow<{ list: { id: string; name: string | null }[] }>(
    '/api/admin/relay/accounts?provider=workbuddy&page=1&pageSize=100',
  )
  return (data.list ?? []).map((r) => ({ id: r.id, name: r.name || r.id }))
}

export async function fetchWorkbuddyTasks(accountId: string): Promise<WorkbuddyTasksView> {
  return apiOrThrow<WorkbuddyTasksView>(
    `/api/admin/relay/accounts/${encodeURIComponent(accountId)}/tasks`,
  )
}

export async function runWorkbuddyTask(
  accountId: string,
  kind: WorkbuddyTaskKind,
  dryRun: boolean,
): Promise<WorkbuddyTaskRunView> {
  return apiOrThrow<WorkbuddyTaskRunView>(
    `/api/admin/relay/accounts/${encodeURIComponent(accountId)}/task-run`,
    { method: 'POST', body: JSON.stringify({ kind, dryRun }) },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
