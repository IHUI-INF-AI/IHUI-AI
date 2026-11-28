// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * task-view-model — 任务中心的统一读模型。
 *
 * 后端有 workspace agent、后台派单、看板、云端运行等多个任务源；
 * 用户侧只应该看到一种“任务”。这里做三件事：
 * - 把任一源的任务规整成同一种 TaskView；
 * - 同一个会话只保留一个当前任务（历史模式不合并，保留每次运行）；
 * - 把运行/等待状态投影到左侧会话行。
 *
 * 纯函数、无 React / i18n / fetch 依赖，便于单测和后续多端复用。
 */

import type { AgentTaskView } from './agent-task-view'
import { pendingApprovalStep } from './agent-task-view'

export type TaskSource = 'workspace' | 'background' | 'kanban' | 'cloud' | 'conversation'

export interface TaskView extends AgentTaskView {
  source: TaskSource
  /** 该任务是否需要用户注意（运行中、等待审批、失败未处理） */
  needsAttention: boolean
}

export type ConversationTaskAttentionById = Readonly<
  Record<string, { running?: boolean; waiting?: boolean; unread?: number }>
>

const STATUS_PRIORITY: Record<string, number> = {
  running: 4,
  failed: 3,
  completed: 2,
  canceled: 1,
}

function updatedAtOf(task: AgentTaskView): string {
  return task.updatedAt ?? task.startedAt ?? ''
}

/** 任一任务源 → 统一 TaskView。source 只是内部来源标记，不进入普通用户主视线。 */
export function toTaskView(task: AgentTaskView, source: TaskSource = 'workspace'): TaskView {
  return {
    ...task,
    source,
    needsAttention: task.status === 'running' || task.status === 'failed',
  }
}

/** 统一排序：最近更新的在前；同一时间按状态优先级。 */
export function sortTaskViews<T extends TaskView>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const delta = updatedAtOf(b).localeCompare(updatedAtOf(a))
    if (delta !== 0) return delta
    return (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0)
  })
}

/**
 * 当前任务视图按会话合并。
 *
 * 普通用户理解的是“这个会话正在做什么”，同一会话的多次运行不应并列成多条任务；
 * 没有 conversationId 的历史/后台任务仍各自保留。历史模式不应调用本函数。
 */
export function mergeTaskViewsByConversation<T extends TaskView>(tasks: readonly T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const task of tasks) {
    const key = task.conversationId ? `conversation:${task.conversationId}` : `task:${task.taskId}`
    const group = groups.get(key)
    if (group) group.push(task)
    else groups.set(key, [task])
  }

  const merged: T[] = []
  for (const group of groups.values()) {
    // 先按“运行中 > 失败 > 完成 > 取消”选一次，再按时间选最新
    const best = [...group].sort((a, b) => {
      const priority = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0)
      if (priority !== 0) return priority
      return updatedAtOf(b).localeCompare(updatedAtOf(a))
    })[0]
    if (best) merged.push(best)
  }
  return sortTaskViews(merged)
}

/**
 * 运行态 → 左侧会话行注意力表。
 *
 * 任务绑定 conversationId 时，会话行显示“执行中”，等待审批时再显示“等待你处理”。
 * 没有 conversationId 的任务只存在于后台抽屉，不污染会话列表。
 */
export function buildConversationTaskAttention(
  tasks: readonly TaskView[],
): ConversationTaskAttentionById {
  const attention: Record<string, { running?: boolean; waiting?: boolean; unread?: number }> = {}
  for (const task of tasks) {
    if (!task.conversationId) continue
    if (task.status !== 'running') continue
    const current = attention[task.conversationId] ?? {}
    attention[task.conversationId] = {
      ...current,
      running: true,
      ...(pendingApprovalStep(task) ? { waiting: true } : {}),
    }
  }
  return attention
}

/** 任务中心 load 的统一入口：规整 + 当前模式按会话合并。 */
export function normalizeTaskList(
  tasks: readonly AgentTaskView[],
  options: { mergeByConversation?: boolean; source?: TaskSource } = {},
): TaskView[] {
  const views = tasks.map((task) => toTaskView(task, options.source ?? 'workspace'))
  return options.mergeByConversation ? mergeTaskViewsByConversation(views) : sortTaskViews(views)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
