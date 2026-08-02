'use client'

import * as React from 'react'
import {
  ChevronRight,
  Loader2,
  AlertCircle,
  Bot,
  HelpCircle,
  Wrench,
  Brain,
  FileText,
  Circle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  useTimelineStore,
  type TimelineEvent,
  type TimelineEventStatus,
  type TimelineEventType,
} from '@/stores/timeline-store'

const TYPE_ICON: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  plan: FileText,
  subagent: Bot,
  question: HelpCircle,
  tool: Wrench,
  thinking: Brain,
  reference: FileText,
}

const TYPE_CLS: Record<TimelineEventType, { icon: string; bar: string }> = {
  plan: { icon: 'text-primary/70', bar: 'bg-primary/50' },
  subagent: { icon: 'text-cyan-500', bar: 'bg-cyan-500/50' },
  question: { icon: 'text-amber-500', bar: 'bg-amber-500/50' },
  tool: { icon: 'text-violet-500', bar: 'bg-violet-500/50' },
  thinking: { icon: 'text-amber-400', bar: 'bg-amber-400/50' },
  reference: { icon: 'text-blue-500', bar: 'bg-blue-500/50' },
}

const STATUS_CLS: Record<TimelineEventStatus, string> = {
  pending: 'text-muted-foreground/50',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-destructive',
}

const STATUS_ICON: Record<TimelineEventStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  running: Loader2,
  done: ChevronRight,
  failed: AlertCircle,
}

// ─── i18n 渲染(Phase 22,2026-07-29 立) ──────────────────────────

/** i18n key 命名空间前缀(strip 后传给 useTranslations('ai.pane')) */
const I18N_NS_PREFIX = 'ai.pane.'

/** next-intl 字面量联合类型绕过:动态 key 调用需要 loose 签名 */
type LooseTranslator = (key: string, params?: Record<string, string | number>) => string

/** 从 event.meta 中安全提取 i18nKey + i18nParams(类型守卫,避免 as 断言) */
function extractI18nMeta(meta: unknown): {
  i18nKey: string
  i18nParams?: Record<string, string | number>
} | null {
  if (typeof meta !== 'object' || meta === null) return null
  const m = meta as Record<string, unknown>
  const rawKey = m['i18nKey']
  if (typeof rawKey !== 'string') return null
  const rawParams = m['i18nParams']
  if (rawParams === undefined) return { i18nKey: rawKey }
  if (typeof rawParams !== 'object' || rawParams === null) return null
  return {
    i18nKey: rawKey,
    i18nParams: rawParams as Record<string, string | number>,
  }
}

/**
 * 用 next-intl t() 翻译 i18n key,失败时返回 fallback。
 *
 * - meta.i18nKey 不存在 → 返回 fallback
 * - t() 抛错 / 返回 key 本身(key 未定义)→ 返回 fallback
 * - 否则返回翻译后的文本
 */
function translateWithFallback(
  t: ReturnType<typeof useTranslations<'ai.pane'>>,
  meta: unknown,
  fallback: string | undefined,
): string | undefined {
  const i18nMeta = extractI18nMeta(meta)
  if (!i18nMeta) return fallback
  try {
    const key = i18nMeta.i18nKey.startsWith(I18N_NS_PREFIX)
      ? i18nMeta.i18nKey.slice(I18N_NS_PREFIX.length)
      : i18nMeta.i18nKey
    const looseT = t as unknown as LooseTranslator
    const translated = i18nMeta.i18nParams ? looseT(key, i18nMeta.i18nParams) : looseT(key)
    if (!translated || translated === key) return fallback
    return translated
  } catch {
    return fallback
  }
}

function formatRelativeTime(timestamp: string, now: number | null): string {
  const ms = Date.parse(timestamp)
  if (Number.isNaN(ms)) return ''
  // Phase 24(2026-07-29):SSR 安全 — 传入 now=null(SSR)时返回空字符串,
  // 避免 Date.now() 在 SSR/CSR 之间时间不同导致 React Hydration 错误。
  // 调用方在 useEffect 内 setNow(Date.now()) 后,会触发重渲染并填入相对时间。
  if (now === null) return ''
  const diff = now - ms
  if (diff < 0) return '刚刚'
  if (diff < 10_000) return '刚刚'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s 前`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m 前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h 前`
  return `${Math.floor(diff / 86_400_000)}d 前`
}

/**
 * Phase 24(2026-07-29 立,SSR 修复):在客户端 mount 后才把 Date.now() 注入 state,
 * 首次 render(now=null)渲染空字符串 → useEffect 触发 setNow → 二次 render 显示相对时间。
 * 这样 SSR/CSR 首次 render 的 HTML 完全一致,避免 hydration mismatch。
 */
function useNowMs(): number | null {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    setNow(Date.now())
    // 每 60s 重新计算一次,让 "Ns 前" 数字保持新鲜
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

interface TimelineEventRowProps {
  event: TimelineEvent
  depth?: number
  'data-testid'?: string
}

export const TimelineEventRow = React.memo(function TimelineEventRow({
  event,
  depth = 0,
  'data-testid': testId,
}: TimelineEventRowProps) {
  const isExpanded = useTimelineStore((s) => s.expandedEventIds.includes(event.id))
  const toggleExpanded = useTimelineStore((s) => s.toggleExpanded)
  const TypeIcon = TYPE_ICON[event.type]
  const StatusIcon = STATUS_ICON[event.status]
  const typeCls = TYPE_CLS[event.type]
  const hasChildren = !!event.children && event.children.length > 0

  // Phase 22 i18n(2026-07-29):meta.i18nKey 存在时用 t() 翻译,失败 fallback 到 description
  const t = useTranslations('ai.pane')
  const description = React.useMemo(
    () => translateWithFallback(t, event.meta, event.description),
    [t, event.meta, event.description],
  )
  // 暴露 i18n key 到 DOM(便于单测验证渲染来源)
  const renderedI18nKey = React.useMemo(() => {
    const meta = extractI18nMeta(event.meta)
    return meta?.i18nKey
  }, [event.meta])

  // Phase 24(2026-07-29):SSR 安全 — 相对时间用 useNowMs() 派生,SSR 时返回空字符串
  const nowMs = useNowMs()

  const onClick = () => {
    if (hasChildren) {
      toggleExpanded(event.id)
      return
    }
    // Trae Work 对齐(2026-07-28):timeline 事件可点击跳转到对话流对应位置
    // 优先级:messageId > planStepId > toolCallId(都通过 custom event 派发,MessageList 监听处理)
    if (event.messageId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-message', { detail: { messageId: event.messageId } }),
      )
      return
    }
    if (event.planStepId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-plan-step', { detail: { planStepId: event.planStepId } }),
      )
      return
    }
    if (event.toolCallId) {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-tool-call', { detail: { toolCallId: event.toolCallId } }),
      )
    }
  }

  // 至少有一种交互目标(children / messageId / planStepId / toolCallId)才可点
  const hasJumpTarget = !!(event.messageId || event.planStepId || event.toolCallId)
  const isClickable = hasChildren || hasJumpTarget

  return (
    <div
      className={cn('relative', depth > 0 && 'ml-3 pl-3')}
      data-testid={testId ?? 'timeline-event-row'}
      data-event-id={event.id}
      data-event-type={event.type}
      data-event-status={event.status}
      data-i18n-key={renderedI18nKey}
    >
      {depth > 0 && (
        <div className="absolute left-0 top-1 bottom-1 w-px bg-border/40" aria-hidden />
      )}
      {depth === 0 && (
        <div
          className={cn('absolute left-0 top-0 h-full w-0.5 rounded-l-sm', typeCls.bar)}
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        aria-expanded={hasChildren ? isExpanded : undefined}
        data-jump-target={hasJumpTarget ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors',
          isClickable ? 'hover:bg-accent/30 cursor-pointer' : 'cursor-default',
        )}
      >
        {hasChildren ? (
          <ChevronRight
            className={cn(
              'h-2.5 w-2.5 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
            aria-hidden
          />
        ) : (
          <span className="w-2.5" />
        )}
        <TypeIcon className={cn('h-3 w-3 shrink-0', typeCls.icon)} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/90">
          {event.title}
        </span>
        {description && !isExpanded && (
          <span className="hidden truncate text-[10px] text-muted-foreground/60 min-[1024px]:inline">
            {description.slice(0, 60)}
            {description.length > 60 ? '…' : ''}
          </span>
        )}
        <StatusIcon
          className={cn(
            'h-2.5 w-2.5 shrink-0',
            STATUS_CLS[event.status],
            event.status === 'running' && 'animate-spin',
          )}
          aria-hidden
        />
        <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground/50">
          {formatRelativeTime(event.timestamp, nowMs)}
        </span>
      </button>
      {hasChildren && isExpanded && (
        <div className="border-t border-border/30 px-2 py-1">
          {description && (
            <div className="mb-1.5 text-[10px] text-muted-foreground/70">{description}</div>
          )}
          <div className="space-y-0.5">
            {event.children!.map((child) => (
              <TimelineEventRow key={child.id} event={child} depth={(depth ?? 0) + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

export default TimelineEventRow
