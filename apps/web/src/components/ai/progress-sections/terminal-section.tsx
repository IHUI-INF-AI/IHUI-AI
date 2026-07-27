'use client'

import * as React from 'react'
import { TerminalSquare, Loader2, Check, X, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection, formatDuration } from './foldable-section'
import { CopyButton } from './copy-button'
import type { TerminalTask } from '@/hooks/use-agent-progress'

interface TerminalSectionProps {
  terminals: TerminalTask[]
}

const TERMINAL_STATUS_ICON: Record<TerminalTask['status'], React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  completed: Check,
  failed: X,
}
const TERMINAL_STATUS_CLS: Record<TerminalTask['status'], string> = {
  running: 'text-primary',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
}

/** 截断超长输出(最大 500 字符) */
function truncateOutput(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…(已截断,共 ${s.length} 字符)`
}

/** v11: 单个终端任务项(可点击展开 output) */
const TerminalItem = React.memo(function TerminalItem({ term }: { term: TerminalTask }) {
  const [expanded, setExpanded] = React.useState(false)
  const Icon = TERMINAL_STATUS_ICON[term.status]
  const hasOutput = !!term.output
  const toggleExpand = () => {
    if (hasOutput) setExpanded((v) => !v)
  }

  return (
    <div className="rounded-sm transition-colors hover:bg-accent/20">
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 py-0.5',
          hasOutput && 'cursor-pointer',
        )}
        onClick={toggleExpand}
        role={hasOutput ? 'button' : undefined}
        aria-expanded={hasOutput ? expanded : undefined}
        tabIndex={hasOutput ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasOutput && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggleExpand()
          }
        }}
        data-testid={`terminal-item-${term.id}`}
      >
        {hasOutput && (
          <ChevronRight
            className={cn(
              'h-2 w-2 shrink-0 text-muted-foreground/40 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasOutput && <span className="w-2 shrink-0" />}
        <Icon
          className={cn(
            'h-2.5 w-2.5 shrink-0',
            TERMINAL_STATUS_CLS[term.status],
            term.status === 'running' && 'animate-spin',
          )}
        />
        <code className="flex-1 break-all font-mono text-[10px] text-muted-foreground">
          {term.command}
        </code>
        {term.status === 'completed' && term.exitCode !== undefined && term.exitCode !== 0 && (
          <span className="shrink-0 text-[10px] text-red-500" title={`exit ${term.exitCode}`}>
            exit:{term.exitCode}
          </span>
        )}
        {term.durationMs !== undefined && term.status !== 'running' && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
            {formatDuration(term.durationMs)}
          </span>
        )}
      </div>
      {hasOutput && (
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-3 pb-1 pt-0.5 text-[10px] leading-relaxed">
              <div className="flex items-center gap-1">
                <span className="font-medium text-muted-foreground/60">输出</span>
                <CopyButton
                  text={term.output ?? ''}
                  aria-label="复制终端输出"
                  data-testid={`terminal-copy-output-${term.id}`}
                />
              </div>
              <pre
                className={cn(
                  'mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm p-1 font-mono text-[10px]',
                  term.status === 'failed'
                    ? 'bg-red-500/5 text-red-500/80'
                    : 'bg-muted/40 text-muted-foreground/80',
                )}
              >
                {truncateOutput(term.output ?? '')}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * TerminalSection — 终端任务折叠子区
 *
 * v11: 点击终端行展开 output(CSS grid 动画 + 复制按钮)
 * v10 memo:React.memo 包装,terminals 引用稳定时跳过重渲染
 */
export const TerminalSection = React.memo(function TerminalSection({
  terminals,
}: TerminalSectionProps) {
  if (terminals.length === 0) return null

  const runningCount = terminals.filter((t) => t.status === 'running').length
  const failedCount = terminals.filter((t) => t.status === 'failed').length

  const summaryParts: string[] = []
  if (runningCount > 0) summaryParts.push(`${runningCount} 运行中`)
  if (failedCount > 0) summaryParts.push(`${failedCount} 失败`)
  const summary = summaryParts.join(' · ')

  const recentTerminals = terminals.slice(-10)

  return (
    <FoldableSection title="终端任务" count={terminals.length} icon={TerminalSquare} data-testid="terminal-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && (
          <div className="text-[10px] text-muted-foreground/60">{summary}</div>
        )}
        {recentTerminals.map((term) => (
          <TerminalItem key={term.id} term={term} />
        ))}
        {terminals.length > 10 && (
          <div className="text-[10px] text-muted-foreground/40">
            …还有 {terminals.length - 10} 项
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default TerminalSection
