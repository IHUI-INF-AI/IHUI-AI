'use client'

import { ClipboardList, Check, Pencil, X } from 'lucide-react'

import { Button } from '@ihui/ui-react'

interface PlanStep {
  id: string
  description: string
  tools?: string[]
}

interface Plan {
  steps: PlanStep[]
  summary?: string
}

interface PlanReviewPanelProps {
  plan: Plan
  onApprove?: () => void
  onModify?: () => void
  onReject?: () => void
}

export function PlanReviewPanel({ plan, onApprove, onModify, onReject }: PlanReviewPanelProps) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">执行计划</h3>
      </div>
      <div className="space-y-3 p-4">
        {plan.summary && (
          <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {plan.summary}
          </p>
        )}
        <ol className="space-y-2">
          {plan.steps.map((step, idx) => (
            <li key={step.id} className="rounded-lg border bg-background/50 p-3">
              <div className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-medium text-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{step.description}</p>
                  {step.tools && step.tools.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {step.tools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex gap-2 border-t px-4 py-3">
        <Button variant="default" size="sm" onClick={onApprove} className="flex-1">
          <Check className="h-4 w-4" />
          批准
        </Button>
        <Button variant="outline" size="sm" onClick={onModify} className="flex-1">
          <Pencil className="h-4 w-4" />
          修改
        </Button>
        <Button variant="outline" size="sm" onClick={onReject} className="flex-1 text-destructive">
          <X className="h-4 w-4" />
          拒绝
        </Button>
      </div>
    </div>
  )
}

export default PlanReviewPanel
