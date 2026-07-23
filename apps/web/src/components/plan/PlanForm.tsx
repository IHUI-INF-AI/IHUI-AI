'use client'

import * as React from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { PlanStepStatus, PlanPriority } from '@ihui/shared/plan/index'
import { PLAN_STEP_STATUS_OPTIONS, PLAN_PRIORITY_OPTIONS } from '@ihui/shared/plan/index'

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export interface StepDraft {
  title: string
  description: string
  status: PlanStepStatus
  priority: PlanPriority
  estimatedMinutes?: number
}

export interface PlanFormValues {
  title: string
  goal: string
  scope: string
  constraints: string
  tags: string[]
  steps: StepDraft[]
}

interface PlanFormProps {
  initial?: Partial<PlanFormValues>
  submitLabel?: string
  onSubmit: (values: PlanFormValues) => void
  onCancel?: () => void
}

const emptyDraft: StepDraft = {
  title: '',
  description: '',
  status: 'pending',
  priority: 'medium',
}

export function PlanForm({ initial, submitLabel = '保存', onSubmit, onCancel }: PlanFormProps) {
  const [title, setTitle] = React.useState(initial?.title ?? '')
  const [goal, setGoal] = React.useState(initial?.goal ?? '')
  const [scope, setScope] = React.useState(initial?.scope ?? '')
  const [constraints, setConstraints] = React.useState(initial?.constraints ?? '')
  const [tagsInput, setTagsInput] = React.useState((initial?.tags ?? []).join(', '))
  const [steps, setSteps] = React.useState<StepDraft[]>(
    initial?.steps && initial.steps.length > 0 ? initial.steps : [{ ...emptyDraft }],
  )
  const [error, setError] = React.useState<string | null>(null)

  const addStep = () => setSteps((s) => [...s, { ...emptyDraft }])
  const removeStep = (i: number) =>
    setSteps((s) => s.filter((_, idx) => idx !== i))
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((s) => {
      const target = i + dir
      if (target < 0 || target >= s.length) return s
      const next = [...s]
      const a = next[i]
      const b = next[target]
      if (a === undefined || b === undefined) return s
      next[i] = b
      next[target] = a
      return next
    })
  }
  const updateStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError('请填写计划标题')
      return
    }
    if (!goal.trim()) {
      setError('请填写计划目标')
      return
    }
    const cleanSteps = steps
      .map((s) => ({ ...s, title: s.title.trim(), description: s.description.trim() }))
      .filter((s) => s.title.length > 0)
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSubmit({
      title: title.trim(),
      goal: goal.trim(),
      scope: scope.trim(),
      constraints: constraints.trim(),
      tags,
      steps: cleanSteps,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="plan-title">计划标题 *</Label>
        <Input
          id="plan-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如:优化登录流程"
          maxLength={128}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-goal">计划目标 *</Label>
        <textarea
          id="plan-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="本次计划要达成的可量化目标,例如:登录接口响应时间 < 200ms"
          rows={3}
          className={textareaClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-scope">修改范围</Label>
        <textarea
          id="plan-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="本次计划涉及的文件/模块/接口范围"
          rows={3}
          className={textareaClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-constraints">约束边界</Label>
        <textarea
          id="plan-constraints"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="不可破坏的兼容性/性能/安全约束,例如:不得改用户表结构"
          rows={2}
          className={textareaClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="plan-tags">标签(逗号分隔)</Label>
        <Input
          id="plan-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="例如:性能, 登录, P1"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>步骤清单</Label>
          <Button type="button" size="sm" variant="outline" onClick={addStep}>
            <Plus className="h-3.5 w-3.5" />
            添加步骤
          </Button>
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-sm bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  placeholder="步骤标题,例如:添加 Zod 校验"
                  className="h-8 flex-1"
                />
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    aria-label="上移"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    aria-label="下移"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeStep(i)}
                    aria-label="删除步骤"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <textarea
                value={step.description}
                onChange={(e) => updateStep(i, { description: e.target.value })}
                placeholder="步骤描述(可选)"
                rows={2}
                className={cn(textareaClass, 'text-xs')}
              />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground">状态</span>
                  <select
                    value={step.status}
                    onChange={(e) => updateStep(i, { status: e.target.value as PlanStepStatus })}
                    className="rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs outline-none"
                  >
                    {PLAN_STEP_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground">优先级</span>
                  <select
                    value={step.priority}
                    onChange={(e) => updateStep(i, { priority: e.target.value as PlanPriority })}
                    className="rounded-sm border border-input bg-background px-1.5 py-0.5 text-xs outline-none"
                  >
                    {PLAN_PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
              暂无步骤,点击"添加步骤"开始规划
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

export default PlanForm
