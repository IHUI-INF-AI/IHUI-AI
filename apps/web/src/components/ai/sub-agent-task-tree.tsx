'use client'

/**
 * SubAgentTaskTree — Trae Work 风格子代理任务树形容器(Phase 19.6,2026-07-28 立)
 *
 * 树形结构:批次(BatchHeader)→ 子代理(SubAgentTaskItem)→ 子操作(SubAgentOperationItem)
 * 3 层嵌套缩进。
 */

import * as React from 'react'
import { ChevronRight, Check, Circle, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BatchHeader, type BatchTone } from './progress-sections/batch-header'

export type SubAgentTaskType =
  | 'coding'
  | 'search'
  | 'browser'
  | 'dispatch'
  | 'planning'

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

const STATUS_ICON: Record<SubAgentStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  running: Loader2,
  done: Check,
  failed: XCircle,
}

const STATUS_CLS: Record<SubAgentStatus, string> = {
  pending: 'text-muted-foreground/50',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
}

interface SubOperationItemProps {
  op: SubOperation
}

const SubOperationItem = React.memo(function SubOperationItem({ op }: SubOperationItemProps) {
  const Icon = STATUS_ICON[op.status]
  return (
    <div className="flex items-start gap-1.5 border-l border-border/40 py-0.5 pl-3 text-[11px]">
      <Icon
        className={cn(
          'mt-0.5 h-3 w-3 shrink-0',
          STATUS_CLS[op.status],
          op.status === 'running' && 'animate-spin',
        )}
      />
      <span className="flex-1 break-words text-muted-foreground/90">{op.label}</span>
      {op.timestamp && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
          {op.timestamp}
        </span>
      )}
    </div>
  )
})

interface SubAgentTaskItemProps {
  task: SubAgentTask
}

const SubAgentTaskItem = React.memo(function SubAgentTaskItem({ task }: SubAgentTaskItemProps) {
  const [open, setOpen] = React.useState(true)
  const Icon = STATUS_ICON[task.status]
  return (
    <div className="ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 py-0.5 text-left hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/60 transition-transform duration-150',
            open && 'rotate-90',
          )}
        />
        <Icon
          className={cn(
            'h-3 w-3 shrink-0',
            STATUS_CLS[task.status],
            task.status === 'running' && 'animate-spin',
          )}
        />
        <span className="text-[11px] font-medium text-foreground/90">{task.name}</span>
        <span className="text-[11px] text-muted-foreground/80">· {task.statusText}</span>
      </button>
      {open && task.operations.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0">
          {task.operations.map((op) => (
            <SubOperationItem key={op.id} op={op} />
          ))}
        </div>
      )}
    </div>
  )
})

interface SubAgentBatchItemProps {
  batch: SubAgentBatch
}

const SubAgentBatchItem = React.memo(function SubAgentBatchItem({ batch }: SubAgentBatchItemProps) {
  const [open, setOpen] = React.useState(true)
  return (
    <div className="my-1" data-batch-id={batch.id}>
      <BatchHeader
        batchId={batch.id}
        title={batch.title}
        itemCount={batch.tasks.length}
        tone={batch.tone}
        meta={batch.meta}
        collapsed={!open}
        onCollapsedChange={(v) => setOpen(!v)}
      />
      {open && (
        <div className="ml-2 mt-1 space-y-0.5 border-l border-border/40 pl-1">
          {batch.tasks.map((task) => (
            <SubAgentTaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
})

interface SubAgentTaskTreeProps {
  batches: SubAgentBatch[]
  defaultCollapsed?: boolean
  className?: string
}

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

export default SubAgentTaskTree
