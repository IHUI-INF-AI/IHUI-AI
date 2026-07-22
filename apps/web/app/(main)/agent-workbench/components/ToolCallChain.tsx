'use client'

import * as React from 'react'
import { Wrench, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { cn } from '@ihui/ui'
import type { ToolCallEvent } from '@/hooks/use-agent-runtime'

interface Props {
  toolCalls: ToolCallEvent[]
  running?: boolean
}

const STATUS_CONFIG: Record<
  ToolCallEvent['status'],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  pending: { icon: Loader2, color: 'text-sky-600 dark:text-sky-400', label: '进行中' },
  success: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-500', label: '成功' },
  error: { icon: XCircle, color: 'text-destructive', label: '失败' },
}

function truncate(s: string, len = 60): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`
}

function ToolCallItem({ call, isLast }: { call: ToolCallEvent; isLast: boolean }) {
  const [expanded, setExpanded] = React.useState(false)
  const cfg = STATUS_CONFIG[call.status]
  const Icon = cfg.icon
  const argsStr = React.useMemo(() => JSON.stringify(call.args), [call.args])
  const resultStr = React.useMemo(
    () => (call.result === undefined ? '' : JSON.stringify(call.result)),
    [call.result],
  )
  return (
    <div className="relative pl-4">
      {!isLast && <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border" />}
      <span
        className={cn(
          'absolute left-0 top-3 h-1.5 w-1.5 rounded-sm',
          call.status === 'pending' && 'animate-pulse',
          cfg.color,
          'bg-current',
        )}
      />
      <div className="rounded-md border bg-background p-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <Icon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              cfg.color,
              call.status === 'pending' && 'animate-spin',
            )}
          />
          <span className="font-mono text-xs font-medium">{call.tool}</span>
          <span className={cn('text-[10px]', cfg.color)}>{cfg.label}</span>
          <ChevronRight
            className={cn(
              'ml-auto h-3 w-3 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </button>
        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {truncate(argsStr)}
        </div>
        {expanded && (
          <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground">args:</span> {argsStr}
            </div>
            {resultStr && (
              <div>
                <span className="text-muted-foreground">result:</span> {resultStr}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ToolCallChain({ toolCalls, running }: Props) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">工具调用链</span>
        <span className="text-xs text-muted-foreground">{toolCalls.length}</span>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2">
        {toolCalls.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {running ? '等待工具调用...' : '暂无工具调用'}
          </div>
        ) : (
          <div className="space-y-2">
            {toolCalls.map((c, i) => (
              <ToolCallItem key={c.id} call={c} isLast={i === toolCalls.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
