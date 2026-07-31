'use client'

import * as React from 'react'
import { Check, Clock, ListTodo, Loader2, ChevronDown } from 'lucide-react'
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
  /** streaming 中自动展开(用户可手动折叠) */
  isStreaming?: boolean
}

const STATUS_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  in_progress: Loader2,
  completed: Check,
}

/** 状态 → 图标颜色(精美化:in_progress 主色旋转,completed 翠绿,pending 柔灰) */
const STATUS_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/40',
  in_progress: 'text-primary',
  completed: 'text-emerald-500',
}

/** 状态 → 步骤点背景(时间线圆点) */
const STATUS_DOT_CLS: Record<PlanStepStatus, string> = {
  pending: 'bg-muted-foreground/20',
  in_progress: 'bg-primary/15 ring-2 ring-primary/20',
  completed: 'bg-emerald-500/15',
}

/**
 * PlanStepsCard — 内联计划步骤卡片(对标 OpenAI Codex /plan 内联展示)
 *
 * 精美化(2026-07-31):
 * - 时间线风格:每个步骤左侧有圆点 + 连接线,形成视觉流程
 * - streaming 自动展开:isStreaming=true 时 defaultOpen=true,用户可手动折叠
 * - reasoning 可点击展开:explanation 超过 100 字符时,点击展开查看完整内容
 * - 视觉层次:圆角容器 + 柔和背景 + 状态色彩 + 进度条
 */
export function PlanStepsCard({
  steps,
  className,
  'data-testid': testId,
  isStreaming = false,
}: PlanStepsCardProps) {
  const rootTestId = testId ?? 'plan-steps-card'

  // streaming 中有 in_progress 步骤时自动展开
  const hasInProgress = steps.some((s) => s.status === 'in_progress')
  const autoOpen = isStreaming && hasInProgress

  if (steps.length === 0) return null

  const doneCount = steps.filter((s) => s.status === 'completed').length

  return (
    <FoldableSection
      title="执行计划"
      count={steps.length}
      doneCount={doneCount}
      defaultOpen={autoOpen}
      icon={ListTodo}
      aria-label="执行计划"
      data-testid={rootTestId}
    >
      <ol
        className={cn('relative space-y-0.5 pl-1', className)}
        data-testid={`${rootTestId}-list`}
      >
        {/* 时间线竖直连接线(绝对定位,贯穿所有步骤) */}
        <span
          className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50"
          aria-hidden
        />
        {steps.map((s, idx) => {
          const Icon = STATUS_ICON[s.status]
          const isLast = idx === steps.length - 1
          return (
            <PlanStepItem
              key={s.id}
              step={s}
              icon={Icon}
              isLast={isLast}
              rootTestId={rootTestId}
            />
          )
        })}
      </ol>
    </FoldableSection>
  )
}

/** 单个步骤项(可点击展开 reasoning) */
interface PlanStepItemProps {
  step: PlanStep
  icon: React.ComponentType<{ className?: string }>
  isLast: boolean
  rootTestId: string
}

function PlanStepItem({ step: s, icon: Icon, isLast, rootTestId }: PlanStepItemProps) {
  // reasoning 可点击展开(超过 100 字符才有展开价值)
  const [expanded, setExpanded] = React.useState(false)
  const hasLongExplanation = (s.explanation?.length ?? 0) > 100
  const isClickable = hasLongExplanation || s.step === '思考'

  return (
    <li
      className={cn(
        'relative flex items-start gap-2 py-1',
        // 最后一个步骤不显示下方连接线段
        !isLast && 'before:absolute before:left-[7px] before:top-3 before:bottom-0 before:w-px before:bg-border/50',
      )}
      aria-label={s.step}
      data-status={s.status}
      data-testid={`${rootTestId}-item-${s.id}`}
    >
      {/* 时间线圆点(带状态背景 + 图标) */}
      <span
        className={cn(
          'relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors',
          STATUS_DOT_CLS[s.status],
        )}
        aria-hidden
      >
        <Icon
          className={cn(
            'h-2.5 w-2.5 transition-colors',
            STATUS_CLS[s.status],
            s.status === 'in_progress' && 'animate-spin',
          )}
        />
      </span>

      {/* 步骤内容 */}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs leading-snug',
            isClickable && 'cursor-pointer select-none',
          )}
          onClick={isClickable ? () => setExpanded((v) => !v) : undefined}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpanded((v) => !v)
                  }
                }
              : undefined
          }
        >
          <span
            className={cn(
              'flex-1 break-all transition-colors',
              s.status === 'in_progress'
                ? 'font-medium text-foreground'
                : s.status === 'completed'
                  ? 'text-foreground/80'
                  : 'text-muted-foreground/60',
            )}
          >
            {s.step}
          </span>
          {s.durationMs !== undefined && s.durationMs > 0 && (
            <span className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted-foreground/50 bg-muted/40">
              {formatDuration(s.durationMs)}
            </span>
          )}
          {isClickable && (
            <ChevronDown
              className={cn(
                'h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform duration-150',
                expanded && 'rotate-180',
              )}
              aria-hidden
            />
          )}
        </div>

        {/* explanation:短的直接显示,长的可展开 */}
        {s.explanation && (
          <div
            className={cn(
              'mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground/70',
              hasLongExplanation && !expanded && 'line-clamp-2',
            )}
          >
            {s.explanation}
          </div>
        )}
      </div>
    </li>
  )
}
