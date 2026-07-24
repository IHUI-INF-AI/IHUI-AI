'use client'

import { ScrollText, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { LEVEL_COLOR, LEVELS } from './helpers'
import type { Log, LogLevel } from './types'

interface Props {
  logs: Log[]
  isLoading: boolean
  logLevel: 'all' | LogLevel
  setLogLevel: (v: 'all' | LogLevel) => void
  fmt: (v?: string) => string
}

export function InstanceLogs({ logs, isLoading, logLevel, setLogLevel, fmt }: Props) {
  const t = useTranslations('workflows')
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ScrollText className="h-4 w-4 text-primary" />
          {t('instanceDetail.logs')}
        </h2>
        <Select value={logLevel} onValueChange={(v) => setLogLevel(v as 'all' | LogLevel)}>
          <SelectTrigger className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('instanceDetail.allLevels')}</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          {t('instanceDetail.noLogs')}
        </div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border bg-card">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-start gap-3 border-b px-3 py-1.5 text-xs last:border-0 transition-colors hover:bg-muted/30"
            >
              <span className="shrink-0 font-mono text-muted-foreground">{fmt(l.timestamp)}</span>
              <span className={cn('w-12 shrink-0 font-semibold uppercase', LEVEL_COLOR[l.level])}>
                {l.level}
              </span>
              <span className="min-w-0 flex-1 break-all">{l.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
