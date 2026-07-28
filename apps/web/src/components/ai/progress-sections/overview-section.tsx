'use client'

import * as React from 'react'
import { Activity, Loader2, CheckCircle2, XCircle, AlertCircle, Circle, Clipboard, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import { buildOverviewSummaryMarkdown } from './overview-summary'
import type { AgentOverview } from '@/hooks/use-agent-progress'

interface OverviewSectionProps {
  overview: AgentOverview
  isStreaming: boolean
  /** v9: token 统计 */
  totalTokens?: number
  tokenRate?: number
  /** v9: 预估剩余时间(ms) */
  etaMs?: number | null
  /** v9: 上下文窗口占用百分比(0-100) */
  contextUsage?: number
}

const STATUS_ICON: Record<AgentOverview['status'], React.ComponentType<{ className?: string }>> = {
  idle: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  interrupted: AlertCircle,
}
const STATUS_TKEY: Record<AgentOverview['status'], string> = {
  idle: 'overview.statusIdle',
  running: 'overview.statusRunning',
  completed: 'overview.statusCompleted',
  failed: 'overview.statusFailed',
  interrupted: 'overview.statusInterrupted',
}
const STATUS_CLS: Record<AgentOverview['status'], string> = {
  idle: 'text-muted-foreground/60',
  running: 'text-primary',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  interrupted: 'text-amber-500',
}

/**
 * OverviewSection — 任务总览统计折叠子区
 *
 * 对齐 Trae Work 底部统计栏:
 * - 标题带 Activity 图标
 * - 会话状态 SVG 图标 + 步骤/子代理/终端/变更/耗时统计
 *
 * v10 memo:React.memo 包装,overview/统计 props 引用稳定时跳过重渲染
 */
export const OverviewSection = React.memo(function OverviewSection({
  overview,
  isStreaming,
  totalTokens,
  tokenRate,
  etaMs,
  contextUsage,
}: OverviewSectionProps) {
  const t = useTranslations('ai.pane')
  const hasData =
    overview.sessionStart !== null ||
    overview.totalSteps > 0 ||
    overview.totalSubagents > 0 ||
    overview.totalChanges > 0 ||
    overview.totalTerminals > 0
  if (!hasData) return null

  // 会话耗时
  let sessionDuration = ''
  if (overview.sessionStart) {
    const startMs = Date.parse(overview.sessionStart)
    if (!Number.isNaN(startMs)) {
      sessionDuration = formatDuration(Date.now() - startMs)
    }
  }

  // 统计行
  const stats: Array<{ label: string; value: string; cls?: string }> = []
  if (overview.totalSteps > 0) {
    stats.push({
      label: t('overview.steps'),
      value: `${overview.completedSteps}/${overview.totalSteps}`,
    })
  }
  if (overview.totalSubagents > 0) {
    const parts = [`${overview.activeSubagents}${t('overview.active')}`, `${overview.totalSubagents}${t('overview.total')}`]
    if (overview.deadSubagents > 0) parts.push(`${overview.deadSubagents}${t('overview.dead')}`)
    stats.push({ label: t('overview.subagents'), value: parts.join(' · ') })
  }
  if (overview.totalTerminals > 0) {
    stats.push({
      label: t('overview.terminals'),
      value: `${overview.runningTerminals}${t('overview.running')} · ${overview.totalTerminals}${t('overview.total')}`,
    })
  }
  if (overview.totalChanges > 0) {
    stats.push({ label: t('overview.changes'), value: `${overview.totalChanges}${t('overview.files')}` })
  }
  if (sessionDuration) {
    stats.push({ label: t('overview.duration'), value: sessionDuration })
  }
  // v9: token 统计
  if (totalTokens !== undefined && totalTokens > 0) {
    stats.push({
      label: t('overview.token'),
      value: totalTokens >= 1000 ? `${Math.round(totalTokens / 1000)}k` : `${totalTokens}`,
    })
  }
  if (tokenRate !== undefined && tokenRate > 0) {
    stats.push({ label: t('overview.rate'), value: `${tokenRate}/s` })
  }
  if (etaMs !== undefined && etaMs !== null && etaMs > 0) {
    stats.push({ label: t('overview.eta'), value: formatDuration(etaMs) })
  }
  if (contextUsage !== undefined && contextUsage > 0) {
    stats.push({
      label: t('overview.context'),
      value: `${Math.round(contextUsage)}%`,
      cls: contextUsage > 80 ? 'text-amber-500' : undefined,
    })
  }

  const Icon = STATUS_ICON[overview.status]

  return (
    <FoldableSection
      title={t('overview.title')}
      icon={Activity}
      data-testid="overview-section"
      headerExtra={
        // 注:不能放 <button>(HTML 不允许 button 嵌套 button,会触发 hydration 错误)
        // 用 div + role=button 模拟,行为一致(键盘 Enter/Space 触发由 onClick 兜底)
        <div
          role="button"
          tabIndex={0}
          onClick={onCopySummary}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onCopySummary()
            }
          }}
          aria-label={copied ? t('copied') : t('overview.copySummary')}
          title={copied ? t('copied') : t('overview.copySummary')}
          className="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
          data-testid="overview-copy-summary"
          data-copied={copied ? 'true' : undefined}
        >
          {copied ? (
            <Check className="h-2.5 w-2.5 text-emerald-500" aria-hidden />
          ) : (
            <Clipboard className="h-2.5 w-2.5" aria-hidden />
          )}
        </div>
      }
    >
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {/* 会话状态 */}
        <div className="flex items-center gap-1.5">
          <Icon
            className={cn(
              'h-2.5 w-2.5 shrink-0',
              STATUS_CLS[overview.status],
              overview.status === 'running' && isStreaming && 'animate-spin',
            )}
          />
          <span className={cn('font-medium', STATUS_CLS[overview.status])}>
            {t(STATUS_TKEY[overview.status])}
          </span>
          {overview.error && (
            <span className="flex-1 break-all text-[10px] text-red-500/80" title={overview.error}>
              {overview.error}
            </span>
          )}
        </div>
        {/* 统计行 */}
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[10px] text-muted-foreground/60">{s.label}</span>
            <span className={cn('flex-1 break-all text-muted-foreground tabular-nums', s.cls)}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </FoldableSection>
  )
})

export default OverviewSection
