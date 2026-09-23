// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, ChevronRight, CircleDashed, Loader2, Minus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/components/ai/progress-sections/foldable-section'
import type { PlanStepStatus } from '@ihui/types/ai'
import type { ToolMetricKind, ToolSubjectKind } from '@ihui/shared/chat'

/**
 * 消息流"活动区"设计基元 —— 流式对话里所有过程信息(工具调用/计划步骤/终端/子代理/思考)
 * 共用的一套行、组、度量与状态语义。
 *
 * 为什么要有这一层:此前每个区段各自写字号(9/10/11/12/13px 五种)、各自写圆角与配色,
 * 同一个气泡里出现四种互不相干的视觉语言,读起来像四个产品的拼接。对标 Qoder / Trae /
 * Codex 的做法是**一种行模板贯穿全部过程信息**:
 *   状态图标 · 功能名 · 对象(等宽) ………… 度量 / 耗时
 * 字号唯一(12px)、图标唯一(14px)、行高唯一(24px)、状态色唯一,
 * 差异只体现在"内容"上。所有区段必须经本文件渲染,不得再自行拼 className。
 */

/** 活动行状态 —— 与工具/步骤/终端的原始状态词汇统一收敛到这五种 */
export type StreamStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

/** 行模板唯一字号:12px。禁止在消息流活动区出现 9/10/11/13px 文字 */
export const STREAM_ROW_CLASS = 'flex h-6 w-full items-center gap-1.5 text-xs leading-none'
/** 对象(路径/URL/命令)一律等宽;查询词与实体名用正文体 */
export const STREAM_SUBJECT_MONO = /path|url|command/

const ICON_CLASS = 'h-3.5 w-3.5 shrink-0'

/** 状态 → 图标 + 颜色(全消息流唯一口径) */
export function StreamStatusIcon({
  status,
  className,
}: {
  status: StreamStatus
  className?: string
}) {
  switch (status) {
    case 'running':
      return (
        <Loader2 className={cn(ICON_CLASS, 'animate-spin text-primary', className)} aria-hidden />
      )
    case 'success':
      return <Check className={cn(ICON_CLASS, 'text-muted-foreground/50', className)} aria-hidden />
    case 'error':
      return <X className={cn(ICON_CLASS, 'text-red-500', className)} aria-hidden />
    case 'skipped':
      return <Minus className={cn(ICON_CLASS, 'text-muted-foreground/40', className)} aria-hidden />
    case 'pending':
    default:
      return (
        <CircleDashed
          className={cn(ICON_CLASS, 'text-muted-foreground/35', className)}
          aria-hidden
        />
      )
  }
}

export interface StreamRowProps {
  status: StreamStatus
  /** 功能名(本地化后的动宾短语,如"读取文件内容");禁止传英文工具码名 */
  title: string
  /**
   * `action`(默认):title 是短动词短语,主体留给 subject 撑满一行。
   * `primary`:title 本身就是这一行的主体(计划步骤、清单项那种整句话),占满剩余宽度。
   */
  titleMode?: 'action' | 'primary'
  /** 行首序号/缩进前缀(如"1."),放在状态图标之后 */
  leading?: React.ReactNode
  /** 操作对象(文件路径 / 检索词 / URL / 命令),等宽显示并单行截断 */
  subject?: string
  subjectKind?: ToolSubjectKind
  /** 右侧度量徽章之前的静态补充文本(如"3 个结果") */
  meta?: React.ReactNode
  /** 结果计数(行数/命中数/文件数),空值不渲染 */
  metricKind?: ToolMetricKind
  metricValue?: number | null
  /** 写类文件的 ± 行数;-1 表示未知,不渲染 */
  added?: number
  removed?: number
  /** 尾部状态文本(如"执行中"),仅在需要文字态时传 */
  trailing?: React.ReactNode
  /** 耗时(毫秒);running 时由外部 tick 传入 */
  elapsedMs?: number | null
  /** 传入即渲染成可点击行(带 hover 背景 + 右侧展开箭头) */
  onClick?: () => void
  expanded?: boolean
  /** 行级附加标签(插件/MCP 来源等),统一中性配色 */
  tags?: string[]
  ariaLabel?: string
  /** 键盘导航锚点:agent-task-progress-pane 用 [data-section-header] 收集可聚焦区段头 */
  sectionHeader?: boolean
  className?: string
  testId?: string
}

/**
 * 一条活动行。信息优先级:状态 → 做什么(title) → 对谁(subject) → 结果多大(metric) → 多久(elapsed)。
 * 可点击时整行是按钮(展开/收起明细),不可点击时是纯展示行。
 */
export function StreamRow({
  status,
  title,
  titleMode = 'action',
  leading,
  subject,
  subjectKind = 'none',
  meta,
  metricKind = 'none',
  metricValue = null,
  added,
  removed,
  trailing,
  elapsedMs,
  onClick,
  expanded,
  tags,
  ariaLabel,
  sectionHeader,
  className,
  testId,
}: StreamRowProps) {
  const interactive = typeof onClick === 'function'
  const primary = titleMode === 'primary'
  const inner = (
    <>
      <StreamStatusIcon status={status} />
      {leading !== undefined && leading !== null && leading !== '' && (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">{leading}</span>
      )}
      <span
        className={cn(
          'truncate text-foreground/80',
          primary ? 'min-w-0 flex-1' : 'shrink-0 max-w-[45%]',
        )}
      >
        {title}
      </span>
      {subject ? (
        <span
          data-stream-subject="true"
          className={cn(
            'min-w-0 truncate text-foreground/55',
            primary ? 'shrink-0 max-w-[40%]' : 'flex-1',
            STREAM_SUBJECT_MONO.test(subjectKind) && 'font-mono',
          )}
        >
          {subject}
        </span>
      ) : !primary ? (
        <span className="min-w-0 flex-1" />
      ) : null}
      {tags?.map((tag) => (
        <StreamTag key={tag}>{tag}</StreamTag>
      ))}
      {meta !== undefined && meta !== null && meta !== '' && (
        <span className="shrink-0 text-muted-foreground/70">{meta}</span>
      )}
      <StreamMetric kind={metricKind} value={metricValue} />
      <StreamDelta added={added} removed={removed} />
      {elapsedMs !== undefined && elapsedMs !== null && (
        <span className="shrink-0 tabular-nums text-muted-foreground/60">
          {formatDuration(elapsedMs)}
        </span>
      )}
      {trailing !== undefined && trailing !== null && trailing !== '' && (
        <span className="shrink-0 text-muted-foreground/70">{trailing}</span>
      )}
      {interactive && (
        <ChevronRight
          className={cn(
            ICON_CLASS,
            'shrink-0 text-muted-foreground/40 transition-all',
            expanded ? 'rotate-90 opacity-100' : 'opacity-0 group-hover/stream-row:opacity-100',
          )}
          aria-hidden
        />
      )}
    </>
  )

  // 未开始/已跳过的行整行弱化:状态差异靠"重量"表达,不靠多种字号与彩色边框
  const dimmed = status === 'pending' || status === 'skipped'

  if (!interactive) {
    return (
      <div
        className={cn(
          'group/stream-row',
          STREAM_ROW_CLASS,
          'gap-1.5',
          dimmed && 'opacity-60',
          className,
        )}
        data-testid={testId}
        data-stream-status={status}
      >
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={ariaLabel ?? title}
      className={cn(
        'group/stream-row rounded-sm px-1 text-left transition-colors',
        'hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
        STREAM_ROW_CLASS,
        dimmed && 'opacity-60',
        className,
      )}
      data-testid={testId}
      data-stream-status={status}
      data-stream-expanded={expanded ? 'true' : 'false'}
      {...(sectionHeader ? { 'data-section-header': 'true' } : {})}
    >
      {inner}
    </button>
  )
}

/** 结果度量:单位文案走 i18n,数值缺失(unknown)时整段不渲染 */
export function StreamMetric({
  kind,
  value,
}: {
  kind: ToolMetricKind
  value: number | null | undefined
}) {
  const t = useTranslations('taskStatus')
  if (kind === 'none' || value === null || value === undefined || value < 0) return null
  const key =
    kind === 'lines'
      ? 'unitLines'
      : kind === 'files'
        ? 'unitFiles'
        : kind === 'chars'
          ? 'unitLines'
          : 'unitResults'
  return (
    <span className="shrink-0 tabular-nums text-muted-foreground/60" data-testid="stream-metric">
      {t(key, { n: value })}
    </span>
  )
}

/** 文件增删行数;-1 = 行数未知,不渲染占位 0 */
export function StreamDelta({
  added,
  removed,
  className,
}: {
  added?: number
  removed?: number
  className?: string
}) {
  const t = useTranslations('taskStatus')
  const hasAdded = typeof added === 'number' && added >= 0
  const hasRemoved = typeof removed === 'number' && removed >= 0
  if (!hasAdded && !hasRemoved) return null
  return (
    <span
      className={cn('shrink-0 flex items-center gap-1 tabular-nums', className)}
      data-testid="stream-delta"
    >
      {hasAdded && (
        <span className="text-emerald-600 dark:text-emerald-400">
          {t('addedCount', { n: added! })}
        </span>
      )}
      {hasRemoved && <span className="text-red-500/80">{t('removedCount', { n: removed! })}</span>}
    </span>
  )
}

/**
 * 实时耗时 tick:running=true 时每 250ms 自增,结束/卸载即停。
 * 传入 doneMs 时(结果已回,后端给出真实耗时)直接显示权威值,不再显示本地估算。
 */
export function useLiveElapsed(running: boolean, doneMs?: number | null): number | null {
  const startRef = React.useRef<number>(Date.now())
  const [elapsed, setElapsed] = React.useState(0)
  React.useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 250)
    return () => window.clearInterval(id)
  }, [running])
  if (!running) return doneMs !== undefined && doneMs !== null ? doneMs : null
  return elapsed
}

export interface StreamGroupProps {
  /** 组内是否仍在执行(决定头行图标与措辞) */
  active: boolean
  /** 步数(用于 "{n} 个步骤" / 用时措辞) */
  stepCount: number
  /** 收起态也显示在最前面的一句话:此刻在做什么 / 已完成 */
  headline?: string
  /** 组级耗时(毫秒);active 时实时 tick,结束后传权威值 */
  elapsedMs?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** 组头右侧的轻量控件(视图切换等)。放在触发器**外面**,避免按钮套按钮 */
  headerExtra?: React.ReactNode
  className?: string
  testId?: string
  ariaLabel?: string
}

/**
 * 活动组:一段过程信息的容器。
 *
 * 刻意**不带边框与底色**:过程内容不该抢正文的视觉重量(此前是一个 rounded-lg + border +
 * bg-muted 的盒子,把 AI 回复"包"成了卡片)。这里只有一条竖向导引线和一行与行同字号的头。
 */
export function StreamGroup({
  active,
  stepCount,
  headline,
  elapsedMs,
  open,
  onOpenChange,
  children,
  headerExtra,
  className,
  testId,
  ariaLabel,
}: StreamGroupProps) {
  const t = useTranslations('taskStatus')
  const live = useLiveElapsed(active, elapsedMs)
  return (
    <div
      className={cn('group/stream relative', className)}
      data-testid={testId}
      data-stream-group={active ? 'active' : 'idle'}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-[7px] w-px transition-colors',
          // 引导线只在展开且确有内容时出现,收起态保持零装饰
          open ? 'top-6 bottom-1 bg-border/70' : 'h-0 opacity-0',
        )}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={ariaLabel ?? (open ? t('collapseSteps') : t('expandSteps'))}
          className={cn(
            STREAM_ROW_CLASS,
            'min-w-0 flex-1 rounded-sm px-1 text-left text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
          )}
          data-stream-group-trigger="true"
        >
          <StreamStatusIcon status={active ? 'running' : 'success'} />
          <span className="min-w-0 flex-1 truncate">
            {headline || (active ? t('statusRunning') : t('stepCount', { n: stepCount }))}
          </span>
          {!active && stepCount > 0 && (
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {t('stepCount', { n: stepCount })}
            </span>
          )}
          {live !== null && live > 0 && (
            <span
              className="shrink-0 tabular-nums text-muted-foreground/60"
              data-testid={`${testId ?? 'stream'}-elapsed`}
            >
              {t('workedFor', { time: formatDuration(live) })}
            </span>
          )}
          <ChevronRight
            className={cn(
              ICON_CLASS,
              'shrink-0 text-muted-foreground/40 transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden
          />
        </button>
        {headerExtra}
      </div>
      {open && <div className="pt-0.5">{children}</div>}
    </div>
  )
}

/** 展开态明细容器:唯一的一档圆角与内边距(6px + p-2),不再各处自配 */
export function StreamDetail({
  children,
  className,
  testId,
}: {
  children: React.ReactNode
  className?: string
  testId?: string
}) {
  return (
    <div
      className={cn('ml-[7px] space-y-1.5 rounded-md bg-muted/30 p-2 pl-3 text-xs', className)}
      data-testid={testId}
    >
      {children}
    </div>
  )
}

/** 明细内的小标签(入参/结果/错误) */
export function StreamLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-muted-foreground/70">{children}</p>
}

/** 明细里的等宽输出块:限高 200px 后滚动;流式输出时 autoScrollToBottom 保证贴底 */
export function StreamCode({
  text,
  className,
  testId,
  autoScrollToBottom = false,
}: {
  text: string
  className?: string
  testId?: string
  autoScrollToBottom?: boolean
}) {
  const ref = React.useRef<HTMLPreElement>(null)
  React.useEffect(() => {
    if (!autoScrollToBottom) return
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text, autoScrollToBottom])
  return (
    <pre
      ref={ref}
      className={cn(
        'max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-sm bg-background/60 p-1.5 font-mono text-xs leading-relaxed text-foreground/75',
        className,
      )}
      data-testid={testId}
    >
      {text}
    </pre>
  )
}

/** 中性信息徽章(来源/轮次/重试/状态/计数),数字档按 §4 确定性居中模板 */
export function StreamTag({
  children,
  tone = 'neutral',
  strong = false,
  testId,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'running' | 'danger'
  /** 数字计数徽章(待办数/步数/±行数)用 true:加粗 + 等宽,保证位数变化不抖 */
  strong?: boolean
  testId?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm px-1 text-[11px] leading-none tabular-nums',
        strong && 'font-semibold',
        tone === 'danger' && 'bg-red-500/10 text-red-600 dark:text-red-400',
        tone === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        tone === 'running' && 'bg-primary/10 text-primary',
        tone === 'neutral' && 'bg-muted/70 text-muted-foreground',
      )}
      data-testid={testId}
    >
      {children}
    </span>
  )
}

/** StreamStatus → taskStatus 里的状态词键(全消息流唯一口径,各端不得再各写一份映射) */
const STATUS_LABEL_KEY: Record<StreamStatus, string> = {
  // 待开始态复用已有键 stepPending,不另立同义的 statusPending
  pending: 'stepPending',
  running: 'statusRunning',
  success: 'statusSuccess',
  error: 'statusFailed',
  skipped: 'statusSkipped',
}

/** 状态词本地化助手:组件里凡是要把状态写成文字(含 aria-label)都走它 */
export function useStreamStatusLabel(): (status: StreamStatus) => string {
  const t = useTranslations('taskStatus')
  return React.useCallback((status: StreamStatus) => t(STATUS_LABEL_KEY[status]), [t])
}

/** plan_updated 步骤状态 → 活动行状态;error=true 与显式 failed 归一为 error */
export function planStepStreamStatus(step: {
  status: PlanStepStatus
  error?: boolean
}): StreamStatus {
  if (step.error === true || step.status === 'failed') return 'error'
  if (step.status === 'in_progress') return 'running'
  if (step.status === 'completed') return 'success'
  if (step.status === 'skipped') return 'skipped'
  return 'pending'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
