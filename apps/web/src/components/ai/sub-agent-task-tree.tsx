'use client'

import * as React from 'react'
import {
  ChevronRight,
  Circle,
  Loader2,
  Check,
  XCircle,
  Code2,
  Search,
  Globe,
  Users,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BatchHeader, type BatchTone } from './progress-sections/batch-header'

/**
 * SubAgentTaskTree — 子代理任务的树形嵌套结构(2026-07-28 立,深度对标 Trae Work)
 *
 * 设计目标:
 * - 批次 → 子代理 → 子操作 三层缩进
 * - 每层支持折叠/展开
 * - 状态显示(dot/spinner/check/x)
 * - 与 SubAgentActivityFeed 配合,作为 treeMode 渲染
 */

export type SubAgentTaskType = 'coding' | 'search' | 'browser' | 'dispatch' | 'planning'
export type SubAgentStatus = 'pending' | 'running' | 'done' | 'failed'

export interface SubOperation {
  id: string
  label: string
  status: SubAgentStatus
  timestamp?: string
}

export interface SubAgentTask {
  id: string
  name: string
  type: SubAgentTaskType
  statusText: string
  status: SubAgentStatus
  operations: SubOperation[]
  batchId?: string
}

export interface SubAgentBatch {
  id: string
  title: string
  tone?: BatchTone
  tasks: SubAgentTask[]
  meta?: string
}

const TASK_TYPE_ICON: Record<SubAgentTaskType, LucideIcon> = {
  coding: Code2,
  search: Search,
  browser: Globe,
  dispatch: Users,
  planning: ListChecks,
}

const STATUS_ICON: Record<SubAgentStatus, LucideIcon> = {
  pending: Circle,
  running: Loader2,
  done: Check,
  failed: XCircle,
}

const STATUS_CLS: Record<SubAgentStatus, string> = {
  pending: 'text-muted-foreground/60',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
}

interface SubAgentTaskTreeProps {
  batches: SubAgentBatch[]
  className?: string
}

const SubOperationRow = React.memo(function SubOperationRow({ op }: { op: SubOperation }) {
  const Icon = STATUS_ICON[op.status]
  return (
    <div className="flex items-center gap-1 pl-4 text-[10px]">
      <Icon
        className={cn(
          'h-2.5 w-2.5 shrink-0',
          STATUS_CLS[op.status],
          op.status === 'running' && 'animate-spin',
        )}
      />
      <span
        className={cn(
          'flex-1 break-words',
          op.status === 'done' && 'text-muted-foreground/80 line-through',
          op.status === 'failed' && 'text-red-500',
          op.status === 'pending' && 'text-muted-foreground/60',
          op.status === 'running' && 'text-foreground/90',
        )}
      >
        {op.label}
      </span>
    </div>
  )
})

const SubAgentTaskRow = React.memo(function SubAgentTaskRow({ task }: { task: SubAgentTask }) {
  const [expanded, setExpanded] = React.useState(true)
  const Icon = TASK_TYPE_ICON[task.type]
  const StatusIcon = STATUS_ICON[task.status]
  const hasOps = task.operations.length > 0
  return (
    <div className="space-y-0.5" data-task-id={task.id} data-testid="sub-agent-task-row">
      <button
        type="button"
        onClick={() => hasOps && setExpanded((v) => !v)}
        aria-expanded={hasOps ? expanded : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[11px] transition-colors',
          'hover:bg-accent/30',
        )}
      >
        {hasOps ? (
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0" />
        )}
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
        <StatusIcon
          className={cn(
            'h-3 w-3 shrink-0',
            STATUS_CLS[task.status],
            task.status === 'running' && 'animate-spin',
          )}
        />
        <span className="flex-1 truncate font-medium text-foreground/90">{task.name}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground/70">{task.statusText}</span>
      </button>
      {expanded && hasOps && (
        <div className="space-y-0.5 border-l border-border/40 pl-2">
          {task.operations.map((op) => (
            <SubOperationRow key={op.id} op={op} />
          ))}
        </div>
      )}
    </div>
  )
})

const SubAgentBatchItem = React.memo(function SubAgentBatchItem({ batch }: { batch: SubAgentBatch }) {
  return (
    <div className="space-y-0.5" data-batch-id={batch.id} data-testid="sub-agent-batch-row">
      <BatchHeader
        batchId={batch.id}
        title={batch.title}
        itemCount={batch.tasks.length}
        tone={batch.tone ?? 'default'}
        meta={batch.meta}
        defaultCollapsed={false}
      />
      <div className="space-y-0.5 pl-1">
        {batch.tasks.map((task) => (
          <SubAgentTaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
})

export const SubAgentTaskTree = React.memo(function SubAgentTaskTree({
  batches,
  className,
}: SubAgentTaskTreeProps) {
  if (batches.length === 0) {
    return (
      <div className="px-2 py-4 text-center text-[11px] text-muted-foreground/60">暂无任务</div>
    )
  }
  return (
    <div className={cn('space-y-1', className)} data-testid="sub-agent-task-tree">
      {batches.map((batch) => (
        <SubAgentBatchItem key={batch.id} batch={batch} />
      ))}
    </div>
  )
})
