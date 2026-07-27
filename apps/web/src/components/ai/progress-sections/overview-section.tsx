'use client'

import * as React from 'react'
import { Activity, Loader2, CheckCircle2, XCircle, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
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
const STATUS_LABEL: Record<AgentOverview['status'], string> = {
  idle: '空闲',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  interrupted: '已中断',
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
 */
export function OverviewSection({
  overview,
  isStreaming,
  totalTokens,
  tokenRate,
  etaMs,
  contextUsage,
}: OverviewSectionProps) {
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
      label: '步骤',
      value: `${overview.completedSteps}/${overview.totalSteps}`,
    })
  }
  if (overview.totalSubagents > 0) {
    const parts = [`${overview.activeSubagents}活跃`, `${overview.totalSubagents}总`]
    if (overview.deadSubagents > 0) parts.push(`${overview.deadSubagents}死亡`)
    stats.push({ label: '子代理', value: parts.join(' · ') })
  }
  if (overview.totalTerminals > 0) {
    stats.push({
      label: '终端',
      value: `${overview.runningTerminals}运行 · ${overview.totalTerminals}总`,
    })
  }
  if (overview.totalChanges > 0) {
    stats.push({ label: '变更', value: `${overview.totalChanges}文件` })
  }
  if (sessionDuration) {
    stats.push({ label: '耗时', value: sessionDuration })
  }
  // v9: token 统计
  if (totalTokens !== undefined && totalTokens > 0) {
    stats.push({
      label: 'Token',
      value: totalTokens >= 1000 ? `${Math.round(totalTokens / 1000)}k` : `${totalTokens}`,
    })
  }
  if (tokenRate !== undefined && tokenRate > 0) {
    stats.push({ label: '速率', value: `${tokenRate}/s` })
  }
  if (etaMs !== undefined && etaMs !== null && etaMs > 0) {
    stats.push({ label: '预计', value: formatDuration(etaMs) })
  }
  if (contextUsage !== undefined && contextUsage > 0) {
    stats.push({
      label: '上下文',
      value: `${Math.round(contextUsage)}%`,
      cls: contextUsage > 80 ? 'text-amber-500' : undefined,
    })
  }

  const Icon = STATUS_ICON[overview.status]

  return (
    <FoldableSection title="任务总览" icon={Activity} data-testid="overview-section">
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
            {STATUS_LABEL[overview.status]}
          </span>
          {overview.error && (
            <span className="flex-1 break-all text-[10px] text-red-500/70" title={overview.error}>
              {overview.error}
            </span>
          )}
        </div>
        {/* 统计行 */}
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-8 shrink-0 text-[10px] text-muted-foreground/40">{s.label}</span>
            <span className={cn('flex-1 break-all text-muted-foreground tabular-nums', s.cls)}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </FoldableSection>
  )
}

export default OverviewSection
