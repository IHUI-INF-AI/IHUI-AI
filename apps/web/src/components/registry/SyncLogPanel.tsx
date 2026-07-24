'use client'

import * as React from 'react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { RegistrySyncLog, RegistrySyncStatus } from '@ihui/types'

const STATUS_STYLE: Record<RegistrySyncStatus, { label: string; cls: string }> = {
  success: { label: '成功', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  fail: { label: '失败', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  skipped: { label: '跳过', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400' },
  running: { label: '运行中', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
}

const TYPE_LABEL: Record<string, string> = { mcp: 'MCP', skill: 'Skill', plugin: 'Plugin' }

const timeFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export interface SyncLogPanelProps {
  logs: RegistrySyncLog[]
  loading?: boolean
}

export function SyncLogPanel({ logs, loading }: SyncLogPanelProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-auto rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
        {open ? '收起日志' : '查看同步日志'}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="rounded-lg border bg-card">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">加载中…</div>
          ) : logs.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">暂无同步记录</div>
          ) : (
            <ul className="space-y-1 p-3">
              {logs.map((log) => {
                const st = STATUS_STYLE[log.status]
                return (
                  <li key={log.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-accent/30">
                    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 font-medium', st.cls)}>
                      {st.label}
                    </span>
                    <span className="w-12 shrink-0 text-muted-foreground">{TYPE_LABEL[log.sourceType] ?? log.sourceType}</span>
                    <span className="min-w-0 flex-1 truncate">{log.sourceName}</span>
                    {log.newVersion && (
                      <span className="shrink-0 text-muted-foreground">→ v{log.newVersion}</span>
                    )}
                    <span className="shrink-0 text-muted-foreground">{log.durationMs}ms</span>
                    <span className="shrink-0 text-muted-foreground">{timeFmt.format(new Date(log.startedAt))}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
