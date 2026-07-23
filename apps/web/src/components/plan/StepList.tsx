'use client'

import * as React from 'react'
import type { PlanStep, PlanStepStatus, PlanPriority } from '@ihui/shared/plan/index'
import { StepItem } from './StepItem'

interface StepListProps {
  steps: PlanStep[]
  onStatusChange: (stepId: string, status: PlanStepStatus) => void
  onPriorityChange: (stepId: string, priority: PlanPriority) => void
  onMoveUp: (stepId: string) => void
  onMoveDown: (stepId: string) => void
  onRemove: (stepId: string) => void
  onReorder: (stepIds: string[]) => void
  /** 是否可拖拽排序(详情页 true,只读场景 false) */
  draggable?: boolean
}

export function StepList({
  steps,
  onStatusChange,
  onPriorityChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onReorder,
  draggable = true,
}: StepListProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)

  const handleDragStart = (index: number) => () => {
    setDragIndex(index)
  }
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    if (!draggable) return
    e.preventDefault()
    setOverIndex(index)
  }
  const handleDrop = (index: number) => () => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const ids = steps.map((s) => s.id)
    const moved = ids[dragIndex]
    if (moved === undefined) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const next = ids.filter((_, i) => i !== dragIndex)
    next.splice(index, 0, moved)
    onReorder(next)
    setDragIndex(null)
    setOverIndex(null)
  }
  const handleDragEnd = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  if (steps.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        暂无步骤,点击下方"添加步骤"开始规划
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <StepItem
          key={step.id}
          step={step}
          index={i}
          total={steps.length}
          onStatusChange={(s) => onStatusChange(step.id, s)}
          onPriorityChange={(p) => onPriorityChange(step.id, p)}
          onMoveUp={() => onMoveUp(step.id)}
          onMoveDown={() => onMoveDown(step.id)}
          onRemove={() => onRemove(step.id)}
          draggable={draggable}
          onDragStart={handleDragStart(i)}
          onDragOver={handleDragOver(i)}
          onDrop={handleDrop(i)}
          onDragEnd={handleDragEnd}
          isDragging={dragIndex === i}
          isDragOver={overIndex === i && dragIndex !== null && dragIndex !== i}
        />
      ))}
    </div>
  )
}

export default StepList
