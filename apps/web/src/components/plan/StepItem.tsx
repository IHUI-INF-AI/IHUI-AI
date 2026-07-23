'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import type { PlanStep, PlanStepStatus, PlanPriority } from '@ihui/shared/plan/index'
import { PLAN_STEP_STATUS_OPTIONS, PLAN_PRIORITY_OPTIONS } from '@ihui/shared/plan/index'

interface StepItemProps {
  step: PlanStep
  index: number
  total: number
  onStatusChange: (status: PlanStepStatus) => void
  onPriorityChange: (priority: PlanPriority) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
  isDragging?: boolean
  isDragOver?: boolean
}

export function StepItem({
  step,
  index,
  total,
  onStatusChange,
  onPriorityChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false,
}: StepItemProps) {
  const statusOption = PLAN_STEP_STATUS_OPTIONS.find((o) => o.value === step.status)
  const priorityOption = PLAN_PRIORITY_OPTIONS.find((o) => o.value === step.priority)

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-accent/40',
        isDragging && 'opacity-40',
        isDragOver && 'ring-2 ring-primary/30',
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <span
          className="mt-0.5 hidden cursor-grab text-muted-foreground/40 hover:text-muted-foreground sm:block"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <span className="mt-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm bg-muted px-1 text-xs font-medium text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{step.title}</p>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onMoveUp}
              disabled={index === 0}
              aria-label="上移"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onMoveDown}
              disabled={index === total - 1}
              aria-label="下移"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="删除步骤"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {step.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{step.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={step.status}
            onChange={(e) => onStatusChange(e.target.value as PlanStepStatus)}
            className={cn(
              'h-6 cursor-pointer rounded-sm border-0 px-2 text-xs font-medium outline-none',
              statusOption?.color,
            )}
            aria-label="步骤状态"
          >
            {PLAN_STEP_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={step.priority}
            onChange={(e) => onPriorityChange(e.target.value as PlanPriority)}
            className={cn(
              'h-6 cursor-pointer rounded-sm border-0 px-2 text-xs font-medium outline-none',
              priorityOption?.color,
            )}
            aria-label="步骤优先级"
          >
            {PLAN_PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {step.estimatedMinutes !== undefined && step.estimatedMinutes > 0 && (
            <span className="text-xs text-muted-foreground">约 {step.estimatedMinutes} 分钟</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default StepItem
