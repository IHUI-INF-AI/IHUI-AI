'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import { SUBAGENT_COLOR_CLASS, type Subagent } from '@/hooks/use-agent-progress'

interface SubagentSectionProps {
  subagents: Subagent[]
}

const SUBAGENT_STATUS_CHAR: Record<Subagent['status'], string> = {
  spawned: '○',
  running: '⠋',
  done: '✓',
  failed: '✗',
  dead: '✗',
}

const SUBAGENT_STATUS_CLS: Record<Subagent['status'], string> = {
  spawned: 'text-muted-foreground',
  running: 'text-primary',
  done: 'text-emerald-500',
  failed: 'text-red-500',
  dead: 'text-red-500',
}

/**
 * SubagentSection — Subagent 派单折叠子区
 *
 * 对齐 Trae Work 链式 Subagent 展示:
 * - 折叠时:标题 "Subagent 派单" + 计数
 * - 展开时:@handle 彩色标签 + 状态字符 + 当前任务 + token 消耗 + 耗时
 */
export function SubagentSection({ subagents }: SubagentSectionProps) {
  if (subagents.length === 0) return null

  return (
    <FoldableSection title="Subagent 派单" count={subagents.length} data-testid="subagent-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {subagents.map((sa) => (
          <div key={sa.id} className="flex items-center gap-1.5">
            <span className={cn('w-3 shrink-0', SUBAGENT_STATUS_CLS[sa.status])}>
              {SUBAGENT_STATUS_CHAR[sa.status]}
            </span>
            <span className={cn('shrink-0 font-medium', SUBAGENT_COLOR_CLASS[sa.color])}>
              {sa.handle}
            </span>
            {sa.currentTask && (
              <span className="flex-1 break-all text-muted-foreground/80">{sa.currentTask}</span>
            )}
            {sa.durationMs !== undefined && sa.status !== 'running' && (
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {formatDuration(sa.durationMs)}
              </span>
            )}
            {sa.tokenUsage !== undefined && sa.tokenUsage > 0 && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                {Math.round(sa.tokenUsage / 1000)}k
              </span>
            )}
          </div>
        ))}
      </div>
    </FoldableSection>
  )
}

export default SubagentSection
