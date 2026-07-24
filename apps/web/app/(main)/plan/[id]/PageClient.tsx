'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Pencil, Plus } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import { usePlanStore, generateId } from '@/lib/plan-store'
import { ProgressStats } from '@/components/plan/ProgressStats'
import { StepList } from '@/components/plan/StepList'
import { PlanForm, type PlanFormValues } from '@/components/plan/PlanForm'
import { Empty } from '@/components/common'
import type { PlanDocument, PlanStepStatus, PlanPriority } from '@ihui/shared/plan/index'

const PLAN_STATUS_COLOR: Record<PlanDocument['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

const PLAN_STATUS_OPTIONS: Array<{ value: PlanDocument['status']; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const planId = params.id

  const [mounted, setMounted] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const plan = usePlanStore((s) => s.plans.find((p) => p.id === planId) ?? null)
  const update = usePlanStore((s) => s.update)
  const remove = usePlanStore((s) => s.remove)
  const getStats = usePlanStore((s) => s.getStats)
  const addStep = usePlanStore((s) => s.addStep)
  const updateStep = usePlanStore((s) => s.updateStep)
  const removeStep = usePlanStore((s) => s.removeStep)
  const reorderSteps = usePlanStore((s) => s.reorderSteps)

  const stats = React.useMemo(() => (plan ? getStats(plan.id) : null), [plan, getStats])

  const handleStatusChange = (stepId: string, status: PlanStepStatus) => {
    updateStep(planId, stepId, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    })
  }
  const handlePriorityChange = (stepId: string, priority: PlanPriority) => {
    updateStep(planId, stepId, { priority })
  }
  const swap = (stepId: string, dir: -1 | 1) => {
    if (!plan) return
    const ids = plan.steps.map((s) => s.id)
    const idx = ids.indexOf(stepId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= ids.length) return
    const next = [...ids]
    const a = next[target]
    const b = next[idx]
    if (a === undefined || b === undefined) return
    next[target] = b
    next[idx] = a
    reorderSteps(planId, next)
  }
  const handleAddStep = () => {
    addStep(planId, { title: '新步骤', description: '', status: 'pending', priority: 'medium' })
  }
  const handleDelete = () => {
    if (!plan) return
    if (!window.confirm(`确认删除计划「${plan.title}」?此操作不可撤销。`)) return
    remove(planId)
    router.push('/plan')
  }
  const handlePlanStatusChange = (status: PlanDocument['status']) => {
    update(planId, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    })
  }
  const handleEditSubmit = (values: PlanFormValues) => {
    update(planId, {
      title: values.title,
      goal: values.goal,
      scope: values.scope,
      constraints: values.constraints,
      tags: values.tags,
      steps: values.steps.map((s, i) => ({
        id: generateId(),
        title: s.title,
        description: s.description,
        status: s.status,
        priority: s.priority,
        order: i,
        estimatedMinutes: s.estimatedMinutes,
      })),
    })
    setEditing(false)
  }

  if (!mounted) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <Empty
          title="计划不存在"
          description="该计划可能已被删除,或链接有误"
          action={
            <Button asChild>
              <Link href="/plan">返回计划列表</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">编辑 Plan</h1>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <PlanForm
            initial={{
              title: plan.title,
              goal: plan.goal,
              scope: plan.scope,
              constraints: plan.constraints,
              tags: plan.tags ?? [],
              steps: plan.steps.map((s) => ({
                title: s.title,
                description: s.description,
                status: s.status,
                priority: s.priority,
                estimatedMinutes: s.estimatedMinutes,
              })),
            }}
            submitLabel="保存修改"
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon">
            <Link href="/plan" aria-label="返回计划列表">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-bold tracking-tight">{plan.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={plan.status}
            onChange={(e) => handlePlanStatusChange(e.target.value as PlanDocument['status'])}
            className={cn(
              'h-7 cursor-pointer rounded-md border-0 px-2.5 text-xs font-medium outline-none',
              PLAN_STATUS_COLOR[plan.status],
            )}
            aria-label="计划状态"
          >
            {PLAN_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            创建于 {formatDate(plan.createdAt)} · 更新于 {formatDate(plan.updatedAt)}
          </span>
        </div>

        <div className="space-y-3">
          <Field label="目标" content={plan.goal} />
          {plan.scope && <Field label="修改范围" content={plan.scope} />}
          {plan.constraints && <Field label="约束边界" content={plan.constraints} />}
          {plan.tags && plan.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">标签</span>
              {plan.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {stats && <ProgressStats stats={stats} />}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">步骤清单 ({plan.steps.length})</h2>
          <Button size="sm" variant="outline" onClick={handleAddStep}>
            <Plus className="h-3.5 w-3.5" />
            添加步骤
          </Button>
        </div>
        <StepList
          steps={plan.steps}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onMoveUp={(id) => swap(id, -1)}
          onMoveDown={(id) => swap(id, 1)}
          onRemove={(id) => removeStep(planId, id)}
          onReorder={(ids) => reorderSteps(planId, ids)}
          draggable
        />
      </div>
    </div>
  )
}

function Field({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="whitespace-pre-wrap text-sm">{content}</p>
    </div>
  )
}
