// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { TerminalSquare, Loader2, Check, X, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { FoldableSection, formatDuration } from './foldable-section'
import { CopyButton } from './copy-button'
import { useChatStore } from '@/stores/chat'
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
  // 2026-09-18 立(对标 Codex/Trae 实时 stdout 行流):命令执行期间后端逐块下发
  // terminal_delta,由 send-message.ts 写入 store.terminalOutputs(键 = terminalId)。
  // 这里按 id 精确订阅(返回原始字符串,引用稳定,zustand selector 安全)。
  const liveOutput = useChatStore((s) => s.terminalOutputs[term.id])
  const clearTerminalOutput = useChatStore((s) => s.clearTerminalOutput)
  // 权威输出:live 缓冲通常比 terminal_end.output(后端截 8000 字符)更长 → 取更长者,
  // 保证构建日志尾部不被截掉;两者皆空时无输出可展开。
  const effectiveOutput =
    liveOutput && liveOutput.length > (term.output?.length ?? 0) ? liveOutput : term.output
  const hasOutput = !!effectiveOutput
  const isRunning = term.status === 'running'
  const preRef = React.useRef<HTMLPreElement | null>(null)

  // 运行中默认展开(实时可见是本次改造的目的),结束后回到手动展开
  React.useEffect(() => {
    if (isRunning && liveOutput) setExpanded(true)
  }, [isRunning, liveOutput])

  // 新内容到达时贴底滚动(命令输出的关注点永远在最后几行)
  React.useEffect(() => {
    if (!expanded || !isRunning) return
    const el = preRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [liveOutput, expanded, isRunning])

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
                {isRunning && liveOutput && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />
                    <span>{t('terminal.live')}</span>
                  </span>
                )}
                <CopyButton
                  text={effectiveOutput ?? ''}
                  aria-label={t('terminal.copyOutput')}
                  data-testid={`terminal-copy-output-${term.id}`}
                />
                {liveOutput && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearTerminalOutput(term.id)
                    }}
                    className="rounded-sm px-1 text-[10px] text-muted-foreground/60 transition-colors hover:bg-accent/60 hover:text-foreground"
                    aria-label={t('terminal.clearLive')}
                    data-testid={`terminal-clear-live-${term.id}`}
                  >
                    {t('terminal.clearLive')}
                  </button>
                )}
              </div>
              <pre
                ref={preRef}
                className={cn(
                  'mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-sm p-1 font-mono text-[10px]',
                  term.status === 'failed'
                    ? 'bg-red-500/10 text-red-500/90'
                    : 'bg-muted/60 text-muted-foreground/90',
                )}
              >
                {isRunning
                  ? // 运行中:显示实时增量(可能超 500 字符,截尾部保留最新输出)
                    (liveOutput ?? '').slice(-2000)
                  : truncateOutput(
                      effectiveOutput ?? '',
                      t('terminal.truncated', { total: (effectiveOutput ?? '').length }),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
