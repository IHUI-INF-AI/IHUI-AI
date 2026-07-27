'use client'

import * as React from 'react'
import { Users, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { Subagent, SubagentStatus } from '@/hooks/use-agent-progress'
import { SUBAGENT_COLOR_CLASS } from '@/hooks/use-agent-progress'

interface SubagentSectionProps {
  subagents: Subagent[]
}

const SUBAGENT_STATUS_ICON: Record<SubagentStatus, React.ComponentType<{ className?: string }>> = {
  spawned: Loader2,
  running: Loader2,
  done: Check,
  failed: X,
  dead: AlertTriangle,
}
const SUBAGENT_STATUS_CLS: Record<SubagentStatus, string> = {
  spawned: 'text-primary',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
  dead: 'text-amber-500',
}

/**
 * SubagentSection — Subagent 派单折叠子区
 *
 * 对齐 Trae Work Subagent 展示:
 * - 标题带 Users 图标
 * - @handle 彩色标签 + 状态 SVG 图标 + 当前任务 + 耗时 + token 消耗
 */
export function SubagentSection({ subagents }: SubagentSectionProps) {
  if (subagents.length === 0) return null

  return (
    <FoldableSection title="Subagent 派单" count={subagents.length} icon={Users} data-testid="subagent-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {subagents.map((sa) => {
          const Icon = SUBAGENT_STATUS_ICON[sa.status]
          return (
            <div key={sa.id} className="flex items-center gap-1.5">
              <Icon
                className={cn(
                  'h-2.5 w-2.5 shrink-0',
                  SUBAGENT_STATUS_CLS[sa.status],
                  (sa.status === 'spawned' || sa.status === 'running') && 'animate-spin',
                )}
              />
              <span className={cn('shrink-0 font-medium font-mono text-[10px]', SUBAGENT_COLOR_CLASS[sa.color])}>
                {sa.handle}
              </span>
              {sa.failureReason && (sa.status === 'failed' || sa.status === 'dead') ? (
                <span
                  className="flex-1 break-all text-[10px] text-red-500/70"
                  title={sa.failureReason}
                >
                  {sa.failureReason}
                </span>
              ) : sa.currentTask ? (
                <span className="flex-1 break-all text-muted-foreground/70">{sa.currentTask}</span>
              ) : null}
              {sa.durationMs !== undefined && sa.status !== 'running' && sa.status !== 'spawned' && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                  {formatDuration(sa.durationMs)}
                </span>
              )}
              {sa.toolCalls !== undefined && sa.toolCalls > 0 && (
                <span
                  className="shrink-0 text-[10px] tabular-nums text-muted-foreground/40"
                  title={`${sa.toolCalls} 次工具调用`}
                >
                  {sa.toolCalls}次
                </span>
              )}
              {sa.tokenUsage !== undefined && sa.tokenUsage > 0 && (
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                  {Math.round(sa.tokenUsage / 1000)}k
                </span>
              )}
            </div>
          )
        })}
      </div>
    </FoldableSection>
  )
}

export default SubagentSection
