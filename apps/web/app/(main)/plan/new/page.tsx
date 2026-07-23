'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@ihui/ui'
import { PlanForm, type PlanFormValues } from '@/components/plan/PlanForm'
import { usePlanStore } from '@/lib/plan-store'

export default function NewPlanPage() {
  const router = useRouter()
  const create = usePlanStore((s) => s.create)

  const handleSubmit = (values: PlanFormValues) => {
    const id = create({
      title: values.title,
      goal: values.goal,
      scope: values.scope,
      constraints: values.constraints,
      tags: values.tags,
      steps: values.steps.map((s) => ({
        title: s.title,
        description: s.description,
        status: s.status,
        priority: s.priority,
        estimatedMinutes: s.estimatedMinutes,
      })),
    })
    router.push(`/plan/${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/plan" aria-label="返回计划列表">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">新建 Plan</h1>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <PlanForm
          submitLabel="创建 Plan"
          onSubmit={handleSubmit}
          onCancel={() => router.push('/plan')}
        />
      </div>
    </div>
  )
}
