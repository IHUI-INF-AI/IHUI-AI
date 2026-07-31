'use client'

import * as React from 'react'
import { Check, Clock, ListTodo, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FoldableSection,
  formatDuration,
} from '@/components/ai/progress-sections/foldable-section'
import type { PlanStep, PlanStepStatus } from '@/hooks/use-agent-progress'

interface PlanStepsCardProps {
  steps: PlanStep[]
  className?: string
  'data-testid'?: string
}

const STATUS_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  in_progress: Loader2,
  completed: Check,
}

const STATUS_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/50',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

/**
 * PlanStepsCard — 内联计划步骤卡片(对标 OpenAI Codex /plan 内联展示)
 *
 * 用 FoldableSection 包装:折叠态显示 "doneCount/count" 完成度 + 进度条,
 * 展开态显示每步标题 + 状态图标 + 耗时 + explanation。
 * 与 ToolCallCard 视觉区分:用 bg-muted/40 容器 + ListTodo 图标 + 步骤列表。
 */
export function PlanStepsCard({
  steps,
  className,
  'data-testid': testId,
}: PlanStepsCardProps) {
  if (steps.length === 0) return null

  const doneCount = steps.filter((s) => s.status === 'completed').length
  const rootTestId = testId ?? 'plan-steps-card'

  return (
    <FoldableSection
      title="执行计划"
      count={steps.length}
      doneCount={doneCount}
      defaultOpen={false}
      icon={ListTodo}
      aria-label="执行计划"
      data-testid={rootTestId}
    >
      <ul
        className={cn('space-y-0.5', className)}
        data-testid={`${rootTestId}-list`}
      >
        {steps.map((s) => {
          const Icon = STATUS_ICON[s.status]
          return (
            <li
              key={s.id}
              className="flex items-start gap-1.5 py-0.5"
              aria-label={s.step}
              data-status={s.status}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-3 w-3 shrink-0 transition-colors',
                  STATUS_CLS[s.status],
                  s.status === 'in_progress' && 'animate-spin',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs leading-snug">
                  <span
                    className={cn(
                      'flex-1 break-all',
                      s.status === 'in_progress'
                        ? 'text-foreground/90'
                        : 'text-muted-foreground/70',
                    )}
                  >
                    {s.step}
                  </span>
                  {s.durationMs !== undefined && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                      {formatDuration(s.durationMs)}
                    </span>
                  )}
                </div>
                {s.explanation && (
                  <div className="mt-0.5 break-all text-[10px] text-muted-foreground/70">
                    {s.explanation}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </FoldableSection>
  )
}
