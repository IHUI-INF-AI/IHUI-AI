'use client'

import * as React from 'react'
import { TerminalSquare, Loader2, Check, X, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { FoldableSection, formatDuration } from './foldable-section'
import { CopyButton } from './copy-button'
import type { TerminalTask } from '@/hooks/use-agent-progress'

interface TerminalSectionProps {
  terminals: TerminalTask[]
}

const TERMINAL_STATUS_ICON: Record<
  TerminalTask['status'],
  React.ComponentType<{ className?: string }>
> = {
  running: Loader2,
  completed: Check,
  failed: X,
}
const TERMINAL_STATUS_CLS: Record<TerminalTask['status'], string> = {
  running: 'text-primary',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
}

/** 截断超长输出(最大 500 字符)
 *  truncatedSuffix:由调用方通过 i18n 提供的截断提示文案(含 total 信息) */
function truncateOutput(s: string, truncatedSuffix: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '\n' + truncatedSuffix
}

/** v11: 单个终端任务项(可点击展开 output) */
const TerminalItem = React.memo(function TerminalItem({ term }: { term: TerminalTask }) {
  const t = useTranslations('ai.pane')
  const [expanded, setExpanded] = React.useState(false)
  const Icon = TERMINAL_STATUS_ICON[term.status]
  const hasOutput = !!term.output
  const toggleExpand = () => {
    if (hasOutput) setExpanded((v) => !v)
  }

  return (
    <div className="rounded-sm transition-colors hover:bg-accent/40">
      <div
        className={cn('flex items-center gap-1.5 px-1 py-0.5', hasOutput && 'cursor-pointer')}
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
              'h-2 w-2 shrink-0 text-muted-foreground/60 transition-transform duration-150',
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
          <Tooltip content={`exit ${term.exitCode}`}>
            <span className="shrink-0 text-[10px] text-red-500">exit:{term.exitCode}</span>
          </Tooltip>
        )}
        {term.durationMs !== undefined && term.status !== 'running' && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
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
                <span className="font-medium text-muted-foreground/60">{t('terminal.output')}</span>
                <CopyButton
                  text={term.output ?? ''}
                  aria-label={t('terminal.copyOutput')}
                  data-testid={`terminal-copy-output-${term.id}`}
                />
              </div>
              <pre
                className={cn(
                  'mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm p-1 font-mono text-[10px]',
                  term.status === 'failed'
                    ? 'bg-red-500/10 text-red-500/90'
                    : 'bg-muted/60 text-muted-foreground/90',
                )}
              >
                {truncateOutput(
                  term.output ?? '',
                  t('terminal.truncated', { total: (term.output ?? '').length }),
                )}
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
  const t = useTranslations('ai.pane')
  if (terminals.length === 0) return null

  const runningCount = terminals.filter((term) => term.status === 'running').length
  const failedCount = terminals.filter((term) => term.status === 'failed').length

  const summaryParts: string[] = []
  if (runningCount > 0) summaryParts.push(t('terminal.running', { n: runningCount }))
  if (failedCount > 0) summaryParts.push(t('terminal.failed', { n: failedCount }))
  const summary = summaryParts.join(' · ')

  const recentTerminals = terminals.slice(-10)

  return (
    <FoldableSection
      title={t('terminal.title')}
      count={terminals.length}
      icon={TerminalSquare}
      data-testid="terminal-section"
    >
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-[10px] text-muted-foreground/60">{summary}</div>}
        {recentTerminals.map((term) => (
          <TerminalItem key={term.id} term={term} />
        ))}
        {terminals.length > 10 && (
          <div className="text-[10px] text-muted-foreground/60">
            {t('terminal.moreItems', { n: terminals.length - 10 })}
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default TerminalSection
