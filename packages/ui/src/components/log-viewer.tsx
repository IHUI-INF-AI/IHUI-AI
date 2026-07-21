'use client'

import * as React from 'react'
import { CheckCircle2, ChevronDown, Loader2, AlertCircle, Terminal } from 'lucide-react'
import { cn } from '../lib/utils.js'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible.js'

export interface LogViewerProps {
  lines: string[]
  maxCollapsedLines?: number
  autoScroll?: boolean
  isStreaming?: boolean
  title?: React.ReactNode
  status?: 'running' | 'success' | 'error' | 'idle'
  emptyText?: string
  className?: string
}

type StatusKey = NonNullable<LogViewerProps['status']>

const STATUS_CONFIG: Record<
  StatusKey,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  running: { icon: Loader2, className: 'animate-spin text-primary' },
  success: { icon: CheckCircle2, className: 'text-emerald-500' },
  error: { icon: AlertCircle, className: 'text-red-500' },
  idle: { icon: Terminal, className: 'text-muted-foreground' },
}

export function LogViewer({
  lines,
  maxCollapsedLines = 8,
  autoScroll = true,
  isStreaming = false,
  title,
  status = 'idle',
  emptyText = '暂无输出',
  className,
}: LogViewerProps) {
  const [open, setOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // autoScroll:流式追加时滚到底部(仅展开态生效)
  React.useEffect(() => {
    if (!autoScroll || !isStreaming || !open) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines.length, autoScroll, isStreaming, open])

  const total = lines.length
  const isEmpty = total === 0
  const showToggle = total > maxCollapsedLines
  // 折叠时显示最后 N 行(日志尾部,最近活动);展开时全部
  const visibleLines = showToggle && !open ? lines.slice(-maxCollapsedLines) : lines

  const { icon: StatusIcon, className: statusClassName } = STATUS_CONFIG[status]

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-lg border bg-card', className)}
    >
      <CollapsibleTrigger className="gap-2 px-3 py-2 transition-colors hover:bg-accent/50">
        <StatusIcon className={cn('h-4 w-4 shrink-0', statusClassName)} />
        {title !== undefined && (
          <span className="flex-1 truncate text-sm font-medium">{title}</span>
        )}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {total} 行
        </span>
        {showToggle && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent forceMount>
        <div ref={scrollRef} className="max-h-80 overflow-auto px-3 py-2">
          {isEmpty ? (
            <div className="py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            <pre className="m-0 font-mono text-xs">
              {visibleLines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
              {isStreaming && (
                <span
                  className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle"
                  aria-hidden
                />
              )}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

LogViewer.displayName = 'LogViewer'
