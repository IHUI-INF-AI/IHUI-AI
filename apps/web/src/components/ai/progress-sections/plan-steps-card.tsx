// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy, ListTodo } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { humanizeToolText } from '@ihui/shared/chat'
import { Tooltip, TooltipProvider } from '@/components/feedback'
import { cn } from '@/lib/utils'
import {
  StreamDetail,
  StreamRow,
  StreamStatusIcon,
  StreamTag,
  planStepStreamStatus,
  useLiveElapsed,
  useStreamStatusLabel,
} from '@/components/chat/stream/stream-ui'
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

/**
 * 计划步骤五态 → 消息流统一状态词汇与状态词一律由基元决定:
 * `planStepStreamStatus(step)` 做状态收敛(error=true 与显式 failed 归一为 error),
 * `useStreamStatusLabel()` 出中文状态词 —— 本文件不再自配映射表与状态词函数。
 */

/** 状态 → 分段进度条颜色(对标 折叠态摘要设计 状态色) */
const STATUS_BAR_CLS: Record<PlanStepStatus, string> = {
  // 修复 #8:容器是 bg-muted/40,pending 段原来用 bg-muted-foreground/20 对比度不足,
  // 浅色模式下几乎不可见。改用 bg-muted-foreground/25 + dashed border 提高对比度,
  // 同时 dashed 暗示"待执行"状态(完整描边,非单边分割线,符合 AGENTS.md §4)
  pending: 'bg-muted-foreground/25 border border-dashed border-muted-foreground/40',
  in_progress: 'bg-primary/70',
  completed: 'bg-emerald-500/70',
  failed: 'bg-red-500/70',
  skipped: 'bg-muted-foreground/40',
}

/** 长 reasoning 阈值:超过此长度用 MarkdownViewer 渲染(支持代码块/列表) */
const LONG_REASONING_THRESHOLD = 120

/**
 * 后端旧协议下发的思考步骤字面量(用于识别"这一步是思考",非界面文案)。
 * 新协议请用 i18n 键 plan.stepThinking 的本地化值比对。
 */
const LEGACY_THINKING_TEXT = '思考'

/**
 * PlanStepsCard — 内联计划步骤卡片
 *
 * 2026-09-22 接入消息流统一设计基元(`stream-ui`):此前每个步骤自带一套时间线圆点 +
 * 连接线 + 9/10/11px 字号,与同气泡里的工具卡互不相干。现在每个步骤就是一条
 * `StreamRow`(状态图标 · 序号 · 步骤全文 · 状态词 · 耗时),字号 / 图标 / 状态色全部由基元决定。
 *
 * 保留的能力:分段进度条、展开明细(reasoning / 思考过程)、复制 reasoning、
 * 点击跳转消息 + hover 联动(ProgressJumpStore)、组间分隔、streaming 自动展开、
 * 折叠态摘要、aria-live / aria-label、全套 data-testid。
 *
 * 行的槽位约定:步骤全文是这一行的主体(`titleMode="primary"`),序号走 `leading` 槽,
 * 状态词走 `trailing`(与工具行的"度量在尾"同一优先级),耗时由基元排在其后。
 */
export function PlanStepsCard({
  steps,
  className,
  'data-testid': testId,
  isStreaming = false,
}: PlanStepsCardProps) {
  const t = useTranslations('chat')
  // 步骤标题可能含英文工具码名前缀(如 "read_file: path"),渲染为本地化功能名
  const tStatus = useTranslations('taskStatus')
  const statusLabel = useStreamStatusLabel()
  const rootTestId = testId ?? 'plan-steps-card'

  // streaming 中有 in_progress 步骤时自动展开(用户可手动折叠)
  const hasInProgress = steps.some((s) => s.status === 'in_progress')
  const autoOpen = isStreaming && hasInProgress

  const doneCount = steps.filter((s) => s.status === 'completed').length
  // 2026-09-19 v2:error 标记与显式 failed 状态均计入失败数(兼容归一化)
  const errorCount = steps.filter((s) => s.error || s.status === 'failed').length
  const totalDurationMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0)
  const progressPct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0
  // 组级耗时:流式中实时 tick,终态由累计 durationMs 接管(与 StreamGroup 头同一措辞)
  const liveElapsed = useLiveElapsed(isStreaming, totalDurationMs > 0 ? totalDurationMs : null)

  // ProgressJumpStore:点击跳转 + hover 联动
  const requestJumpToMessage = useProgressJumpStore((s) => s.requestJumpToMessage)
  const setHoveredPlanStep = useProgressJumpStore((s) => s.setHoveredPlanStep)
  const hoveredMessageId = useProgressJumpStore((s) => s.hoveredMessageId)

  if (steps.length === 0) return null

  // 折叠态摘要:步数 + 当前态(+ 正在做的这一步),让用户不展开也能读懂进度
  const currentStep = steps.find((s) => s.status === 'in_progress')
  const summary = [
    tStatus('stepCount', { n: steps.length }),
    errorCount > 0
      ? t('plan.summaryErrorCount', { count: errorCount })
      : currentStep
        ? statusLabel('running')
        : doneCount === steps.length
          ? t('plan.summaryAllDone')
          : statusLabel('pending'),
    currentStep ? humanizeToolText(currentStep.step, tStatus) : undefined,
  ]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' · ')

  return (
    <TooltipProvider>
      <FoldableSection
        title={t('plan.title')}
        count={steps.length}
        doneCount={doneCount}
        defaultOpen={autoOpen}
        icon={ListTodo}
        aria-label={t('plan.title')}
        data-testid={rootTestId}
        summary={summary}
        headerExtra={
          liveElapsed !== null && liveElapsed > 0 ? (
            <StreamTag testId={`${rootTestId}-total-duration`}>
              {tStatus('workedFor', { time: formatDuration(liveElapsed) })}
            </StreamTag>
          ) : null
        }
      >
        {/* 分段进度条(每个步骤一段 + 百分比) */}
        <SegmentedProgressBar
          steps={steps}
          rootTestId={rootTestId}
          progressPct={progressPct}
          className="mb-1.5"
          translate={tStatus}
        />

        <ol
          className={cn('relative space-y-0.5', className)}
          aria-live="polite"
          aria-label={t('plan.ariaLabel')}
          data-testid={`${rootTestId}-list`}
        >
          {steps.map((s, idx) => {
            // 组间分隔:不同 groupIndex 之间加 mt-1.5(空隙分隔,非分割线)
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
                rootTestId={rootTestId}
                index={idx + 1}
                isGroupBoundary={!!isGroupBoundary}
                requestJumpToMessage={requestJumpToMessage}
                setHoveredPlanStep={setHoveredPlanStep}
                isHighlightedByHover={!!s.sourceMessageId && s.sourceMessageId === hoveredMessageId}
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
  translate: (key: string) => string
}

function SegmentedProgressBar({
  steps,
  rootTestId,
  progressPct,
  className,
  translate,
}: SegmentedProgressBarProps) {
  const t = useTranslations('chat')
  const statusLabel = useStreamStatusLabel()
  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      data-testid={`${rootTestId}-segmented-progress`}
    >
      <div
        className="flex h-1 flex-1 gap-0.5 overflow-hidden rounded-sm bg-muted/40"
        role="img"
        aria-hidden
      >
        {steps.map((s) => {
          // 五态与状态词全部走基元(与 StreamRow 同一口径)
          const rowStatus = planStepStreamStatus(s)
          const label = statusLabel(rowStatus)
          const durationText =
            s.durationMs !== undefined && s.durationMs > 0
              ? ` · ${formatDuration(s.durationMs)}`
              : ''
          return (
            <Tooltip
              key={s.id}
              side="bottom"
              content={
                <div className="max-w-[280px] space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <StreamStatusIcon status={rowStatus} />
                    <span className="font-medium">{humanizeToolText(s.step, translate)}</span>
                  </div>
                  <div className="text-muted-foreground/80">
                    {label}
                    {durationText}
                  </div>
                </div>
              }
            >
              <div
                className={cn(
                  'h-full flex-1 rounded-sm transition-all duration-300 cursor-help',
                  s.error ? 'bg-red-500/70' : STATUS_BAR_CLS[s.status],
                  s.status === 'in_progress' && !s.error && 'animate-pulse',
                )}
                data-testid={`${rootTestId}-segment-${s.id}`}
              />
            </Tooltip>
          )
        })}
      </div>
      {/* 数字计数徽章:基元 StreamTag(strong)已内置 §4 确定性居中模板 */}
      <StreamTag strong testId={`${rootTestId}-progress-percent`}>
        {t('plan.progressPercent', { percent: progressPct })}
      </StreamTag>
    </div>
  )
}

/** 单个步骤项:一条 StreamRow(可展开 reasoning 明细 + 跳转消息 + hover 联动) */
interface PlanStepItemProps {
  step: PlanStep
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
  rootTestId,
  index,
  isGroupBoundary,
  requestJumpToMessage,
  setHoveredPlanStep,
  isHighlightedByHover,
}: PlanStepItemProps) {
  const t = useTranslations('chat')
  const tStatus = useTranslations('taskStatus')
  const statusLabel = useStreamStatusLabel()
  // reasoning 可点击展开(超过阈值才有展开价值)
  const [expanded, setExpanded] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)

  const explanation = s.explanation
  const hasLongExplanation = (explanation?.length ?? 0) > LONG_REASONING_THRESHOLD
  const isThinking = s.step === t('plan.stepThinking') || s.step === LEGACY_THINKING_TEXT
  const isClickable = hasLongExplanation || isThinking
  // 有 sourceMessageId 时整行可点击跳转(可展开的行优先展开,跳转让位,与改造前一致)
  const isJumpable = !!s.sourceMessageId

  const rowStatus = planStepStreamStatus(s)
  const label = statusLabel(rowStatus)
  // 禁止把 read_file 这类英文码名直接渲染给用户
  const stepText = humanizeToolText(s.step, tStatus)
  // 执行中的步骤本地 tick;已结束的步骤用后端权威 durationMs
  const liveElapsed = useLiveElapsed(rowStatus === 'running', s.durationMs ?? null)
  const elapsedText =
    liveElapsed !== null && liveElapsed > 0 ? formatDuration(liveElapsed) : undefined
  const rowAriaLabel = [`${index}. ${stepText}`, label, elapsedText]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' · ')

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
      if (!explanation) return
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(explanation)
        } else {
          const ta = document.createElement('textarea')
          ta.value = explanation
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
    [explanation, t],
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

  // 长 reasoning 用 MarkdownViewer(支持代码块/列表),思考步骤始终用 MarkdownViewer;
  // 字号交给容器(stream-ui 的 StreamDetail / text-xs),此处不再自配 10/11px
  const markdownCls = '!text-xs prose-p:my-0.5 prose-pre:my-1 prose-code:!px-1 prose-code:!py-0'
  const explanationNode =
    hasLongExplanation || isThinking ? (
      <MarkdownViewer content={explanation ?? ''} className={markdownCls} />
    ) : (
      explanation
    )
  const copyReasoningButton =
    isThinking && expanded && explanation ? (
      <div className="flex justify-end">
        <Tooltip side="bottom" content={t('plan.copyReasoning')}>
          <button
            type="button"
            onClick={handleCopyReasoning}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t('plan.copyReasoning')}
            data-testid={`${rootTestId}-copy-reasoning-${s.id}`}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs',
              'text-muted-foreground/70 transition-colors',
              'hover:bg-accent/60 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{copied ? t('copied') : t('plan.copyReasoning')}</span>
          </button>
        </Tooltip>
      </div>
    ) : null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- li 作为可点击项是常见 UI 模式(列表项跳转),键盘交互由行内 StreamRow 按钮提供
    <li
      className={cn(
        'group -mx-1 rounded-sm px-1 transition-colors',
        // 组间分隔(空隙,非分割线)
        isGroupBoundary && 'mt-1.5',
        // 被对应消息 hover 时反向高亮
        isHighlightedByHover && 'bg-accent/20 ring-1 ring-accent/40',
      )}
      aria-label={rowAriaLabel}
      data-status={s.status}
      data-error={s.error ? 'true' : undefined}
      data-stream-status={rowStatus}
      data-testid={`${rootTestId}-item-${s.id}`}
      onClick={isJumpable && !isClickable ? handleClickStep : undefined}
      onMouseEnter={isJumpable ? () => handleStepHover(true) : undefined}
      onMouseLeave={isJumpable ? () => handleStepHover(false) : undefined}
    >
      <StreamRow
        status={rowStatus}
        title={stepText}
        titleMode="primary"
        leading={`${index}.`}
        trailing={label}
        elapsedMs={liveElapsed !== null && liveElapsed > 0 ? liveElapsed : null}
        onClick={isClickable ? () => setExpanded((v) => !v) : undefined}
        expanded={expanded}
        ariaLabel={rowAriaLabel}
        testId={`${rootTestId}-row-${s.id}`}
      />
      {/* 短说明常驻显示;长说明收进 StreamDetail,点行展开(替代原 line-clamp-2 截断) */}
      {explanation && !hasLongExplanation && (
        <div className="ml-5 mt-0.5 break-words text-xs leading-relaxed text-muted-foreground/70">
          {explanationNode}
          {copyReasoningButton}
        </div>
      )}
      {explanation && hasLongExplanation && expanded && (
        <StreamDetail testId={`${rootTestId}-detail-${s.id}`}>
          {explanationNode}
          {copyReasoningButton}
        </StreamDetail>
      )}
    </li>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
