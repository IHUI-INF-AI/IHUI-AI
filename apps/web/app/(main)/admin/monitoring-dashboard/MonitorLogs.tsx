'use client'

import { ScrollText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { LogSummary } from './types'

interface Props {
  logs: LogSummary | undefined
  t: (k: string) => string
}

export function MonitorLogs({ logs, t }: Props) {
  const recent = logs?.recent ?? []
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" />
          {t('monitor.logSummary')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-md border p-2 text-center">
            <div className="text-xs text-muted-foreground">{t('monitor.logTotal')}</div>
            <div className="mt-0.5 text-lg font-bold">{(logs?.total ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <div className="text-xs text-muted-foreground">{t('monitor.logErrors')}</div>
            <div className="mt-0.5 text-lg font-bold text-red-600">{logs?.errors ?? 0}</div>
          </div>
          <div className="rounded-md border p-2 text-center">
            <div className="text-xs text-muted-foreground">{t('monitor.logWarnings')}</div>
            <div className="mt-0.5 text-lg font-bold text-amber-600">{logs?.warnings ?? 0}</div>
          </div>
        </div>
        <div className="space-y-1">
          {recent.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/30"
            >
              <span
                className={cn(
                  'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                  l.level === 'error'
                    ? 'bg-red-500/10 text-red-600'
                    : l.level === 'warn'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-primary/10 text-primary',
                )}
              >
                {l.level}
              </span>
              <span className="flex-1 break-words text-muted-foreground">{l.message}</span>
              <span className="shrink-0 font-mono text-muted-foreground">{l.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
