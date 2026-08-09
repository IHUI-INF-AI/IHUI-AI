'use client'

import * as React from 'react'
import { AlertCircle, Check, Clock, Copy, ListTodo, Loader2, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from '@/components/ai/progress-sections/foldable-section'
import { MarkdownViewer } from '@/components/media/MarkdownViewer'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
import { toast } from '@/components/common'
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
  // 修复 #8:加 ring 让 pending 圆点在 bg-muted/40 容器上可见
  pending: 'bg-muted-foreground/25 ring-2 ring-muted-foreground/30',
  in_progress: 'bg-primary/15 ring-2 ring-primary/20',
  completed: 'bg-emerald-500/15',
}

/** 状态 → 分段进度条颜色(对标 Trae Thinking Process 状态色) */
const STATUS_BAR_CLS: Record<PlanStepStatus, string> = {
  // 修复 #8:容器是 bg-muted/40,pending 段原来用 bg-muted-foreground/20 对比度不足,
  // 浅色模式下几乎不可见。改用 bg-muted-foreground/25 + dashed border 提高对比度,
  // 同时 dashed 暗示"待执行"状态(完整描边,非单边分割线,符合 AGENTS.md §4)
  pending: 'bg-muted-foreground/25 border border-dashed border-muted-foreground/40',
  in_progress: 'bg-primary/70',
  completed: 'bg-emerald-500/70',
}

/** 长 reasoning 阈值:超过此长度用 MarkdownViewer 渲染(支持代码块/列表) */
const LONG_REASONING_THRESHOLD = 120

/**
 * PlanStepsCard — 内联计划步骤卡片(深度对标 OpenAI Codex /plan + Trae Thinking Process)
 *
 * 2026-07-31 深度优化:
 * - 时间线风格:每个步骤左侧圆点 + 连接线,形成视觉流程
 * - 错误状态:error=true 时用 AlertCircle 图标 + 红色样式(独立视觉分支)
 * - 分段进度条:每个步骤对应一段,直观显示每步状态
 * - 步骤分组:同 sourceMessageId 同组,组间视觉分隔
 * - 点击跳转:有 sourceMessageId 时点击跳转消息(ProgressJumpStore)
 * - hover 联动:hover 步骤时同步高亮对应消息(ProgressJumpStore)
 * - 复制 reasoning:思考步骤展开后显示复制按钮
 * - streaming 自动展开:isStreaming=true 且有 in_progress 时 defaultOpen=true
 * - 可访问性:role=list + aria-live=polite + aria-label
 * - i18n 集成:所有文案走 chat.plan.* 命名空间
 */
export function PlanStepsCard({
  steps,
  className,
  'data-testid': testId,
  isStreaming = false,
}: PlanStepsCardProps) {
  const t = useTranslations('chat')
  const rootTestId = testId ?? 'plan-steps-card'

  // streaming 中有 in_progress 步骤时自动展开(用户可手动折叠)
  const hasInProgress = steps.some((s) => s.status === 'in_progress')
  const autoOpen = isStreaming && hasInProgress

  // ProgressJumpStore:点击跳转 + hover 联动
  const requestJumpToMessage = useProgressJumpStore((s) => s.requestJumpToMessage)
  const setHoveredPlanStep = useProgressJumpStore((s) => s.setHoveredPlanStep)
  const hoveredMessageId = useProgressJumpStore((s) => s.hoveredMessageId)

  if (steps.length === 0) return null

  const doneCount = steps.filter((s) => s.status === 'completed').length
  const errorCount = steps.filter((s) => s.error).length
  const totalDurationMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)
  const progressPct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0

  // 折叠态摘要(借鉴 Trae Thinking Process):优先 in_progress → error → 全完成
  // 让用户不展开即可知道当前状态
  let summary: string | undefined
  if (errorCount > 0) {
    summary = `${t('plan.summaryErrorCount', { count: errorCount })} · ${doneCount}/${steps.length}`
  } else {
    const currentStep = steps.find((s) => s.status === 'in_progress')
    if (currentStep) {
      summary = `${t('plan.statusInProgress')}:${currentStep.step}`
    } else if (doneCount === steps.length) {
      summary = t('plan.summaryAllDone')
    } else {
      const lastStep = steps[steps.length - 1]
      summary = lastStep
        ? `${t('plan.statusPending')}:${lastStep.step}`
        : undefined
    }
  }

  // 总耗时徽章(深度对标 Codex /plan header 统计)
  const totalDurationBadge = totalDurationMs > 0 && (
    <span
      className="shrink-0 rounded px-1 text-[10px] tabular-nums text-muted-foreground/60 bg-muted/40"
      data-testid={`${rootTestId}-total-duration`}
    >
      {t('plan.totalDuration', { duration: formatDuration(totalDurationMs) })}
    </span>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <FoldableSection
        title={t('plan.title')}
        count={steps.length}
        doneCount={doneCount}
        defaultOpen={autoOpen}
        icon={ListTodo}
        aria-label={t('plan.title')}
        data-testid={rootTestId}
        summary={summary}
        headerExtra={totalDurationBadge}
      >
      {/* 分段进度条(每个步骤一段 + 百分比) */}
      <SegmentedProgressBar
        steps={steps}
        rootTestId={rootTestId}
        progressPct={progressPct}
        className="mb-1.5"
      />

      <ol
        className={cn('relative space-y-0.5 pl-1', className)}
        aria-live="polite"
        aria-label={t('plan.ariaLabel')}
        data-testid={`${rootTestId}-list`}
      >
        {steps.map((s, idx) => {
          const isLast = idx === steps.length - 1
          // 组间分隔:不同 groupIndex 之间加 pt-1.5(空隙分隔,非分割线)
          const prevStep = idx > 0 ? steps[idx - 1] : undefined
          const isGroupBoundary =
            prevStep &&
            s.groupIndex !== undefined &&
            prevStep.groupIndex !== undefined &&
            s.groupIndex !== prevStep.groupIndex
          return (
            <PlanStepItem
              key={s.id}
              step={s}
              isLast={isLast}
              rootTestId={rootTestId}
              index={idx + 1}
              isGroupBoundary={!!isGroupBoundary}
              requestJumpToMessage={requestJumpToMessage}
              setHoveredPlanStep={setHoveredPlanStep}
              isHighlightedByHover={
                !!s.sourceMessageId && s.sourceMessageId === hoveredMessageId
              }
            />
          )
        })}
      </ol>
      </FoldableSection>
    </TooltipProvider>
  )
}

/** 分段进度条(每个步骤对应一段,直观显示每步状态) */
interface SegmentedProgressBarProps {
  steps: PlanStep[]
  rootTestId: string
  progressPct: number
  className?: string
}

function SegmentedProgressBar({
  steps,
  rootTestId,
  progressPct,
  className,
}: SegmentedProgressBarProps) {
  const t = useTranslations('chat')
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      data-testid={`${rootTestId}-segmented-progress`}
    >
      <div
        className="flex h-1 flex-1 gap-0.5 overflow-hidden rounded-sm bg-muted/40"
        role="img"
        aria-hidden
      >
        {steps.map((s) => {
          const statusLabel = s.error
            ? t('plan.stepError')
            : s.status === 'in_progress'
              ? t('plan.statusInProgress')
              : s.status === 'completed'
                ? t('plan.statusCompleted')
                : t('plan.statusPending')
          const durationText =
            s.durationMs !== undefined && s.durationMs > 0
              ? ` · ${formatDuration(s.durationMs)}`
              : ''
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'h-full flex-1 rounded-sm transition-all duration-300 cursor-help',
                    s.error ? 'bg-red-500/70' : STATUS_BAR_CLS[s.status],
                    s.status === 'in_progress' && !s.error && 'animate-pulse',
                  )}
                  data-testid={`${rootTestId}-segment-${s.id}`}
                />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                sideOffset={6}
                className="text-[11px] leading-relaxed"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      s.error ? 'bg-red-500' : STATUS_BAR_CLS[s.status],
                    )}
                    aria-hidden
                  />
                  <span className="font-medium">{s.step}</span>
                </div>
                <div className="text-muted-foreground/80">
                  {statusLabel}
                  {durationText}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <span
        className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground/70"
        data-testid={`${rootTestId}-progress-percent`}
      >
        {progressPct}%
      </span>
    </div>
  )
}

/** 单个步骤项(可点击展开 reasoning + 跳转消息 + hover 联动) */
interface PlanStepItemProps {
  step: PlanStep
  isLast: boolean
  rootTestId: string
  /** 步骤编号(1-based) */
  index: number
  /** 是否为组边界(不同 groupIndex 之间) */
  isGroupBoundary: boolean
  /** 跳转消息回调(ProgressJumpStore.requestJumpToMessage) */
  requestJumpToMessage: (messageId: string) => void
  /** hover 联动回调(ProgressJumpStore.setHoveredPlanStep) */
  setHoveredPlanStep: (id: string | null) => void
  /** 是否被 hover 联动高亮(对应消息被 hover 时) */
  isHighlightedByHover: boolean
}

function PlanStepItem({
  step: s,
  isLast,
  rootTestId,
  index,
  isGroupBoundary,
  requestJumpToMessage,
  setHoveredPlanStep,
  isHighlightedByHover,
}: PlanStepItemProps) {
  const t = useTranslations('chat')
  // reasoning 可点击展开(超过阈值才有展开价值)
  const [expanded, setExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)

  const hasLongExplanation = (s.explanation?.length ?? 0) > LONG_REASONING_THRESHOLD
  const isThinking = s.step === t('plan.stepThinking') || s.step === '思考'
  const isClickable = hasLongExplanation || isThinking
  // 有 sourceMessageId 时整个 li 可点击跳转
  const isJumpable = !!s.sourceMessageId

  // 错误状态优先用 AlertCircle 图标(替代原状态图标)
  const Icon = s.error ? AlertCircle : STATUS_ICON[s.status]

  // 点击步骤:跳转消息(若有 sourceMessageId)
  const handleClickStep = React.useCallback(() => {
    if (s.sourceMessageId) {
      requestJumpToMessage(s.sourceMessageId)
    }
  }, [s.sourceMessageId, requestJumpToMessage])

  // hover 步骤:联动高亮对应消息
  const handleStepHover = React.useCallback(
    (entering: boolean) => {
      setHoveredPlanStep(entering ? s.id : null)
    },
    [s.id, setHoveredPlanStep],
  )

  // 复制 reasoning(仅思考步骤)
  const handleCopyReasoning = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (!s.explanation) return
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(s.explanation)
        } else {
          const ta = document.createElement('textarea')
          ta.value = s.explanation
          ta.setAttribute('readonly', '')
          ta.style.position = 'absolute'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setCopied(true)
        toast.success(t('plan.reasoningCopied'))
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
      } catch (err) {
        toast.error(t('plan.reasoningCopyFailed'), {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [s.explanation, t],
  )

  // 卸载清理 timer
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- li 作为可点击项是常见 UI 模式(列表项跳转),键盘交互由内部步骤标题 div 提供
    <li
      className={cn(
        'group relative flex items-start gap-2 rounded-sm py-1 px-1 -mx-1 transition-colors',
        // 组间分隔(空隙,非分割线)
        isGroupBoundary && 'mt-1.5 pt-1.5',
        // 可跳转步骤 hover 高亮
        isJumpable && 'cursor-pointer hover:bg-accent/20',
        // 被对应消息 hover 时反向高亮
        isHighlightedByHover && 'bg-accent/20 ring-1 ring-accent/40',
        // 时间线连接线(最后一个不显示)
        !isLast &&
          'before:absolute before:left-[7px] before:top-3 before:bottom-0 before:w-px before:bg-border/50',
      )}
      aria-label={s.step}
      data-status={s.status}
      data-error={s.error ? 'true' : undefined}
      data-testid={`${rootTestId}-item-${s.id}`}
      onClick={isJumpable ? handleClickStep : undefined}
      onMouseEnter={isJumpable ? () => handleStepHover(true) : undefined}
      onMouseLeave={isJumpable ? () => handleStepHover(false) : undefined}
    >
      {/* 时间线圆点(带状态背景 + 图标) */}
      <span
        className={cn(
          'relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-all',
          s.error
            ? 'bg-red-500/15 ring-2 ring-red-500/30'
            : STATUS_DOT_CLS[s.status],
          isJumpable && 'group-hover:scale-110',
        )}
        aria-hidden
      >
        <Icon
          className={cn(
            'h-2.5 w-2.5 transition-colors',
            s.error ? 'text-red-500' : STATUS_CLS[s.status],
            s.status === 'in_progress' && !s.error && 'animate-spin',
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
          onClick={
            isClickable
              ? (e) => {
                  // 若 li 已绑定跳转,内部点击不重复触发跳转(只切换 expanded)
                  e.stopPropagation()
                  setExpanded((v) => !v)
                }
              : undefined
          }
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
          {/* 步骤编号(借鉴 Codex plan 编号显示,提升可读性) */}
          <span
            className="shrink-0 tabular-nums text-[10px] font-medium text-muted-foreground/40"
            aria-hidden
          >
            {index}.
          </span>
          <span
            className={cn(
              'flex-1 break-all transition-colors',
              s.error
                ? 'font-medium text-red-600 dark:text-red-400'
                : s.status === 'in_progress'
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

        {/* explanation:短文本直接显示,长文本用 MarkdownViewer 渲染(支持代码块/列表等)
         *  思考步骤始终用 MarkdownViewer(对标 Trae Thinking Process 代码块渲染) */}
        {s.explanation && (
          <div
            className={cn(
              'mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground/70',
              hasLongExplanation && !expanded && 'line-clamp-2',
            )}
          >
            {hasLongExplanation || isThinking ? (
              <MarkdownViewer
                content={s.explanation}
                className="!text-[11px] prose-p:my-0.5 prose-pre:my-1 prose-code:!text-[10px] prose-code:!px-1 prose-code:!py-0"
              />
            ) : (
              s.explanation
            )}
          </div>
        )}

        {/* 复制 reasoning 按钮:思考步骤展开后显示(对标 Trae Thinking Process) */}
        {isThinking && expanded && s.explanation && (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={handleCopyReasoning}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={t('plan.copyReasoning')}
              title={t('plan.copyReasoning')}
              data-testid={`${rootTestId}-copy-reasoning-${s.id}`}
              className={cn(
                'inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[10px]',
                'text-muted-foreground/70 transition-colors',
                'hover:bg-accent/60 hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
            >
              {copied ? (
                <Check className="h-2.5 w-2.5 text-emerald-500" aria-hidden />
              ) : (
                <Copy className="h-2.5 w-2.5" aria-hidden />
              )}
              <span>{copied ? t('copied') : t('plan.copyReasoning')}</span>
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
