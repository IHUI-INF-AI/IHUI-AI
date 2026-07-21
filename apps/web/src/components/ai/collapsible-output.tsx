'use client'

import * as React from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import {
  CodeBlock,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  LogViewer,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

export interface CollapsibleOutputProps {
  title: React.ReactNode
  status?: 'running' | 'success' | 'error' | 'idle'
  lines?: string[]
  content?: string
  language?: string
  maxCollapsedLines?: number
  defaultOpen?: boolean
  duration?: number
  error?: string
  className?: string
}

type StatusKey = NonNullable<CollapsibleOutputProps['status']>

const STATUS_CONFIG: Record<
  StatusKey,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  running: { icon: Loader2, className: 'animate-spin text-primary' },
  success: { icon: CheckCircle2, className: 'text-emerald-500' },
  error: { icon: AlertCircle, className: 'text-red-500' },
  idle: { icon: ChevronRight, className: 'text-muted-foreground' },
}

/**
 * CollapsibleOutput - 泛化折叠输出组件
 * 用于进程/命令输出场景:标题栏(状态图标 + 标题 + 耗时 + 折叠箭头)+ 展开体
 * (lines 用 LogViewer、content 用 CodeBlock、error 用红色 pre)。
 * 复用 packages/ui 的 Collapsible / LogViewer / CodeBlock。
 */
export function CollapsibleOutput({
  title,
  status = 'idle',
  lines,
  content,
  language,
  maxCollapsedLines = 8,
  defaultOpen = false,
  duration,
  error,
  className,
}: CollapsibleOutputProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const { icon: StatusIcon, className: statusClassName } = STATUS_CONFIG[status]
  const isRunning = status === 'running'
  const hasLines = !!lines && lines.length > 0
  const hasContent = content !== undefined
  const hasBody = hasLines || hasContent || !!error

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('rounded-lg border bg-card', className)}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50">
        <StatusIcon className={cn('h-4 w-4 shrink-0', statusClassName)} />
        <span className="flex-1 truncate text-sm font-medium">{title}</span>
        {duration !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {duration}ms
          </span>
        )}
        {hasBody && (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 px-3 pb-3">
          {error && (
            <pre className="overflow-x-auto rounded-md bg-red-500/10 p-2 font-mono text-xs text-red-500">
              {error}
            </pre>
          )}
          {hasLines && (
            <LogViewer
              lines={lines}
              maxCollapsedLines={maxCollapsedLines}
              isStreaming={isRunning && open}
            />
          )}
          {hasContent && (
            <CodeBlock code={content ?? ''} language={language} isStreaming={isRunning} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default CollapsibleOutput
