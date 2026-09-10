// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:Plan 步骤列表从 agent-pane.tsx 抽出
// (不复用 agent-task-progress-pane 的 PlanStepItem,它耦合 ProgressJumpStore)
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ListTodo, Circle, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanStep, PlanStepStatus } from '@/hooks/use-agent-progress'
import { formatDuration } from '@/components/ai/progress-sections/foldable-section'

// ---- Plan 步骤状态图标(模块级 const,避免每次 render 重建) ----
const PLAN_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Loader2,
  completed: Check,
}
const PLAN_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/60',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

export function PlanStepsList({ steps }: { steps: PlanStep[] }) {
  const t = useTranslations('ide')
  return (
    <div
      className="mx-1.5 mt-1.5 rounded-md border border-border/60 bg-muted/30 p-1"
      data-testid="agent-pane-plan-list"
    >
      <div className="mb-0.5 flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
        <ListTodo className="h-3 w-3" aria-hidden />
        <span>{t('agentPane.plan')}</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
          {steps.filter((s) => s.status === 'completed').length}/{steps.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {steps.map((step, idx) => {
          const Icon = PLAN_ICON[step.status]
          return (
            <div
              key={step.id}
              className="flex items-start gap-1.5 px-1 py-0.5 text-[11px] leading-relaxed"
              data-testid={`agent-pane-plan-step-${step.id}`}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-3 w-3 shrink-0',
                  PLAN_CLS[step.status],
                  step.status === 'in_progress' && 'animate-spin',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'flex-1 break-all',
                  step.status === 'pending' && 'text-muted-foreground/60',
                )}
              >
                {idx + 1}. {step.step}
              </span>
              {step.durationMs !== undefined && step.status !== 'pending' && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                  {formatDuration(step.durationMs)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
