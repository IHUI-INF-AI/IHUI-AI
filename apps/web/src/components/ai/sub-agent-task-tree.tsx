'use client'

/**
 * SubAgentTaskTree - 子代理任务树形结构(2026-07-28 立,Phase 19.6)
 *
 * 对标 Trae Work 子代理展示,实现 3 层嵌套缩进:
 *  批次(深 1) → 子代理(深 2) → 子操作(深 3)
 *
 * 截图特征:
 *  - 批次: 紫色 Sparkles 图标 + 粗体 + 折叠箭头
 *  - 子代理: lucide icon + 名称 + 状态文字 + chevron-right
 *  - 子操作: 左侧 1px 缩进条 + 状态文字 + chevron-right,浅色文字
 *
 * 设计要点:
 *  - 全部 React.memo,父级状态变更不会重渲染所有子节点
 *  - 折叠状态内部维护,batch/task 各自独立控制
 *  - 沿用 design tokens(bg-card / border-border / text-muted-foreground)
 *  - 零 `any` 类型,精确 interface + Record 映射
 */

import * as React from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'

// ============================================================
// 类型定义
// ============================================================

/** 子代理类型 */
export type SubAgentType = 'coding' | 'search' | 'browser' | 'dispatch' | 'planning'

/** 任务状态 */
export type SubTaskStatus = 'running' | 'done' | 'failed' | 'pending'

/** 批次语气 */
export type SubBatchTone = 'default' | 'success' | 'warning' | 'info'

/** 子操作项 */
export interface SubOperation {
  id: string
  /** "已读取 5 个文件" */
  label: string
  /** 子操作状态 */
  status: SubTaskStatus
  /** 可选时间戳 */
  timestamp?: string
}

/** 子代理任务 */
export interface SubAgentTask {
  id: string
  /** 任务名 "miniapp-taro 常量集中化" */
  name: string
  /** 任务类型 */
  type: SubAgentType
  /** 当前状态文字 "正在搜索文件..." */
  statusText: string
  /** 状态 */
  status: SubTaskStatus
  /** 子操作列表 */
  operations: SubOperation[]
  /** 可选 batch 关联 */
  batchId?: string
}

/** 批次 */
export interface SubAgentBatch {
  id: string
  /** "批次 E: miniapp-taro API 下沉" */
  title: string
  /** 批次状态 default | success | warning | info */
  tone?: SubBatchTone
  /** 子代理任务列表 */
  tasks: SubAgentTask[]
  /** 批次 meta: e.g. "已完成" / "进行中" */
  meta?: string
}

// ============================================================
// 视觉常量映射
// ============================================================

const TASK_STATUS_ICON: Record<SubTaskStatus, LucideIcon> = {
  running: Loader2,
  done: Check,
  failed: XCircle,
  pending: AlertCircle,
}

const TASK_STATUS_COLOR: Record<SubTaskStatus, string> = {
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
  pending: 'text-muted-foreground',
}

const TASK_STATUS_ANIM: Record<SubTaskStatus, string> = {
  running: 'animate-spin',
  done: '',
  failed: '',
  pending: '',
}

const TASK_TYPE_ICON: Record<SubAgentType, LucideIcon> = {
  coding: Check,
  search: Check,
  browser: Check,
  dispatch: Check,
  planning: Check,
}

const BATCH_TONE_RING: Record<SubBatchTone, string> = {
  default: 'border-border/60',
  success: 'border-emerald-500/30',
  warning: 'border-amber-500/30',
  info: 'border-primary/20',
}

const BATCH_TONE_DOT: Record<SubBatchTone, string> = {
  default: 'bg-muted-foreground/40',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-primary/60',
}

// ============================================================
// 子组件:批次头
// ============================================================

interface SubAgentBatchHeaderProps {
  batch: SubAgentBatch
  expanded: boolean
  onToggle: () => void
}

const SubAgentBatchHeader = React.memo(function SubAgentBatchHeader({
  batch,
  expanded,
  onToggle,
}: SubAgentBatchHeaderProps) {
  const tone: SubBatchTone = batch.tone ?? 'default'
  const ChevronIcon = expanded ? ChevronDown : ChevronRight
  const runningCount = batch.tasks.filter((t) => t.status === 'running').length
  const doneCount = batch.tasks.filter((t) => t.status === 'done').length
  const failedCount = batch.tasks.filter((t) => t.status === 'failed').length

  return (
    <div
      className={cn(
        'rounded-md border bg-card/40 px-2.5 py-1.5 transition-colors',
        BATCH_TONE_RING[tone],
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left"
        data-testid={`batch-header-${batch.id}`}
      >
        <ChevronIcon
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-0',
          )}
        />
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
        <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', BATCH_TONE_DOT[tone])} />
        <span className="flex-1 truncate text-sm font-semibold text-foreground">
          {batch.title}
        </span>
        {batch.meta && (
          <span className="shrink-0 text-[11px] text-muted-foreground/70">
            {batch.meta}
          </span>
        )}
        {batch.tasks.length > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {runningCount > 0 && <span className="text-primary">{runningCount} </span>}
            {doneCount > 0 && <span className="text-emerald-500">{doneCount} </span>}
            {failedCount > 0 && <span className="text-red-500">{failedCount} </span>}
            <span>/ {batch.tasks.length}</span>
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-2 mt-1.5 space-y-1 border-l pl-3">
          {batch.tasks.map((task) => (
            <SubAgentTaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================================
// 子组件:子代理任务
// ============================================================

interface SubAgentTaskItemProps {
  task: SubAgentTask
}

const SubAgentTaskItem = React.memo(function SubAgentTaskItem({ task }: SubAgentTaskItemProps) {
  const [expanded, setExpanded] = React.useState(task.status === 'running' || task.operations.length > 0)
  const StatusIcon = TASK_STATUS_ICON[task.status]
  const TypeIcon = TASK_TYPE_ICON[task.type]
  const hasOperations = task.operations.length > 0

  return (
    <div
      className="rounded-sm transition-colors hover:bg-accent/30"
      data-testid={`subagent-task-${task.id}`}
    >
      <button
        type="button"
        onClick={() => hasOperations && setExpanded((v) => !v)}
        aria-expanded={hasOperations ? expanded : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 px-1 py-0.5 text-left',
          hasOperations && 'cursor-pointer',
        )}
        data-testid={`subagent-task-toggle-${task.id}`}
      >
        {hasOperations ? (
          <ChevronRight
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <TypeIcon className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
        <StatusIcon
          className={cn(
            'h-3 w-3 shrink-0',
            TASK_STATUS_COLOR[task.status],
            TASK_STATUS_ANIM[task.status],
          )}
          aria-hidden
        />
        <span className="shrink-0 text-xs font-medium text-foreground/90">{task.name}</span>
        <span className="flex-1 truncate text-[11px] text-muted-foreground/70">
          {task.statusText}
        </span>
        {hasOperations && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
            {task.operations.length}
          </span>
        )}
      </button>

      {expanded && hasOperations && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-3">
          {task.operations.map((op) => (
            <SubAgentOperationItem key={op.id} op={op} />
          ))}
        </div>
      )}
    </div>
  )
})

// ============================================================
// 子组件:子操作项
// ============================================================

interface SubAgentOperationItemProps {
  op: SubOperation
}

const SubAgentOperationItem = React.memo(function SubAgentOperationItem({
  op,
}: SubAgentOperationItemProps) {
  const StatusIcon = TASK_STATUS_ICON[op.status]
  return (
    <div
      className="flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-accent/40"
      data-testid={`subagent-op-${op.id}`}
    >
      <StatusIcon
        className={cn(
          'h-2.5 w-2.5 shrink-0',
          TASK_STATUS_COLOR[op.status],
          TASK_STATUS_ANIM[op.status],
        )}
        aria-hidden
      />
      <span className="flex-1 truncate text-[11px] text-muted-foreground/80">{op.label}</span>
      {op.timestamp && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
          {op.timestamp}
        </span>
      )}
      <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" aria-hidden />
    </div>
  )
})

// ============================================================
// 主组件
// ============================================================

export interface SubAgentTaskTreeProps {
  batches: SubAgentBatch[]
  /** 默认折叠(用于上方总折叠);默认 false(展开) */
  defaultCollapsed?: boolean
}

/**
 * SubAgentTaskTree - 3 层树形嵌套结构
 *
 * 用法:父组件传入 batches 数组,组件内部维护各 batch 的折叠状态。
 */
export function SubAgentTaskTree({ batches, defaultCollapsed = false }: SubAgentTaskTreeProps) {
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>({})

  const handleToggle = React.useCallback((batchId: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [batchId]: !prev[batchId],
    }))
  }, [])

  if (batches.length === 0) {
    return (
      <div className="px-2 py-1 text-[11px] text-muted-foreground/60" data-testid="sub-agent-task-tree-empty">
        暂无任务
      </div>
    )
  }

  return (
    <div className="space-y-1.5" data-testid="sub-agent-task-tree">
      {batches.map((batch) => {
        const collapsed = collapsedMap[batch.id] ?? defaultCollapsed
        return (
          <SubAgentBatchHeader
            key={batch.id}
            batch={batch}
            expanded={!collapsed}
            onToggle={() => handleToggle(batch.id)}
          />
        )
      })}
    </div>
  )
}

export default SubAgentTaskTree
