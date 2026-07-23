'use client'

import * as React from 'react'
import { ListOrdered, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import type { SubagentQueueEntry, DispatchPriority } from '@ihui/shared/subagents/index'

const PRIORITY_BADGE: Record<DispatchPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}

const PRIORITY_LABEL: Record<DispatchPriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
}

interface QueueListProps {
  queue: SubagentQueueEntry[] | undefined
  isLoading: boolean
  onItemClick?: (id: string) => void
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function QueueList({ queue, isLoading, onItemClick }: QueueListProps) {
  const sorted = React.useMemo(
    () => [...(queue ?? [])].sort((a, b) => a.position - b.position),
    [queue],
  )

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListOrdered className="h-4 w-4 text-muted-foreground" />
          优先级调度队列
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">队列空闲</p>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                role={onItemClick ? 'button' : undefined}
                onClick={onItemClick ? () => onItemClick(entry.id) : undefined}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                  {entry.position}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[entry.priority]}`}
                >
                  {PRIORITY_LABEL[entry.priority]}
                </span>
                <span className="flex-1 truncate text-sm">{entry.goal}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dateFmt.format(new Date(entry.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export { PRIORITY_BADGE, PRIORITY_LABEL }
