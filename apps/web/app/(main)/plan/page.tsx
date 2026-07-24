'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { usePlanStore } from '@/lib/plan-store'
import { PlanCard } from '@/components/plan/PlanCard'
import { Empty } from '@/components/common'
import type { PlanDocument } from '@ihui/shared/plan/index'

type StatusFilter = 'all' | PlanDocument['status']

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]

export default function PlanListPage() {
  const [filter, setFilter] = React.useState<StatusFilter>('all')
  const [mounted, setMounted] = React.useState(false)
  const plans = usePlanStore((s) => s.plans)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const filtered = React.useMemo(
    () => (filter === 'all' ? plans : plans.filter((p) => p.status === filter)),
    [plans, filter],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Plan 模式</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            单一计划文档管理 · 目标 + 修改范围 + 步骤追踪 · 适用于中小型功能与模块级重构
          </p>
        </div>
        <Button asChild>
          <Link href="/plan/new">
            <Plus className="h-4 w-4" />
            新建 Plan
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? plans.length : plans.filter((p) => p.status === f.value).length
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                filter === f.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-70 tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      {!mounted ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <Empty
          icon={FileText}
          title={plans.length === 0 ? '还没有任何计划' : '当前筛选下无计划'}
          description={
            plans.length === 0
              ? '创建第一个 Plan,开始拆解目标与步骤'
              : '试试切换其他状态筛选'
          }
          action={
            plans.length === 0 ? (
              <Button asChild>
                <Link href="/plan/new">
                  <Plus className="h-4 w-4" />
                  新建 Plan
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
