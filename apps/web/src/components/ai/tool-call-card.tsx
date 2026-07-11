'use client'

import * as React from 'react'
import { ChevronRight, Loader2, Check, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ToolCallCardProps {
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error'
  duration?: number
  error?: string
}

const STATUS_CONFIG = {
  running: { icon: Loader2, className: 'animate-spin text-primary', label: '执行中' },
  success: { icon: Check, className: 'text-green-500', label: '成功' },
  error: { icon: AlertCircle, className: 'text-red-500', label: '失败' },
} as const

export function ToolCallCard({
  toolName,
  args,
  result,
  status,
  duration,
  error,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const config = STATUS_CONFIG[status]
  const StatusIcon = config.icon

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
          <StatusIcon className={cn('h-4 w-4 shrink-0', config.className)} />
          <CardTitle className="flex-1 break-words text-sm font-medium">{toolName}</CardTitle>
          {duration !== undefined && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {duration}ms
            </span>
          )}
          <span className={cn('shrink-0 text-xs', config.className)}>{config.label}</span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 p-3 pt-0 text-xs">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">参数</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          {error && (
            <div>
              <p className="mb-1 font-medium text-red-500">错误</p>
              <pre className="overflow-x-auto rounded-md bg-red-500/10 p-2 font-mono text-red-500">
                {error}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">结果</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default ToolCallCard
