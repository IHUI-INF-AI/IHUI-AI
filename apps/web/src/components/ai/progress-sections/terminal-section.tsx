'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import type { TerminalTask } from '@/hooks/use-agent-progress'

interface TerminalSectionProps {
  terminals: TerminalTask[]
}

const TERMINAL_STATUS_CHAR: Record<TerminalTask['status'], string> = {
  running: '⠋',
  completed: '✓',
  failed: '✗',
}

const TERMINAL_STATUS_CLS: Record<TerminalTask['status'], string> = {
  running: 'text-primary',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
}

/**
 * TerminalSection — 终端任务折叠子区
 *
 * 对齐 Trae Work 终端执行展示:
 * - 折叠时:标题 "终端任务" + 计数
 * - 展开时:状态字符 + 命令 + 退出码 + 耗时
 */
export function TerminalSection({ terminals }: TerminalSectionProps) {
  if (terminals.length === 0) return null

  const runningCount = terminals.filter((t) => t.status === 'running').length
  const failedCount = terminals.filter((t) => t.status === 'failed').length

  const summaryParts: string[] = []
  if (runningCount > 0) summaryParts.push(`${runningCount} 运行中`)
  if (failedCount > 0) summaryParts.push(`${failedCount} 失败`)
  const summary = summaryParts.join(', ')

  const recentTerminals = terminals.slice(-10)

  return (
    <FoldableSection title="终端任务" count={terminals.length} data-testid="terminal-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-muted-foreground/80">{summary}</div>}
        {recentTerminals.map((term) => (
          <div key={term.id} className="flex items-center gap-1.5">
            <span className={cn('w-3 shrink-0', TERMINAL_STATUS_CLS[term.status])}>
              {TERMINAL_STATUS_CHAR[term.status]}
            </span>
            <code className="flex-1 break-all font-mono text-[10px] text-muted-foreground">
              {term.command}
            </code>
            {term.status === 'completed' && term.exitCode !== undefined && term.exitCode !== 0 && (
              <span className="shrink-0 text-[10px] text-red-500" title={`exit ${term.exitCode}`}>
                exit:{term.exitCode}
              </span>
            )}
            {term.durationMs !== undefined && term.status !== 'running' && (
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {formatDuration(term.durationMs)}
              </span>
            )}
          </div>
        ))}
        {terminals.length > 10 && (
          <div className="text-[10px] text-muted-foreground/60">
            …还有 {terminals.length - 10} 项
          </div>
        )}
      </div>
    </FoldableSection>
  )
}

export default TerminalSection
