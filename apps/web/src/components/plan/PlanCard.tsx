'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date-utils'
import type { PlanDocument } from '@ihui/shared/plan/index'
import { usePlanStore } from '@/lib/plan-store'
import { ProgressStats } from './ProgressStats'

const PLAN_STATUS_LABEL: Record<PlanDocument['status'], string> = {
  draft: '草稿',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const PLAN_STATUS_COLOR: Record<PlanDocument['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-amber-100 text-amber-700',
}

interface PlanCardProps {
  plan: PlanDocument
}

export function PlanCard({ plan }: PlanCardProps) {
  const getStats = usePlanStore((s) => s.getStats)
  const stats = React.useMemo(() => getStats(plan.id), [plan, getStats])

  return (
    <Card className="flex h-full flex-col transition-colors hover:bg-accent/40 hover:shadow-md">
      <CardHeader className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{plan.title}</CardTitle>
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-xs font-medium',
              PLAN_STATUS_COLOR[plan.status],
            )}
          >
            {PLAN_STATUS_LABEL[plan.status]}
          </span>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {plan.goal || '暂无目标描述'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-4 pt-0">
        <ProgressStats stats={stats} />
        {plan.tags && plan.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <span className="text-xs text-muted-foreground">{formatDate(plan.createdAt)}</span>
        <Button asChild size="sm" variant="ghost">
          <Link href={`/plan/${plan.id}`}>
            查看详情
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default PlanCard
