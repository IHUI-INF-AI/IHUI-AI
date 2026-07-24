'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { ALERT_STYLE } from './types'
import type { AlertItem } from './types'

interface Props {
  alerts: AlertItem[]
  t: (k: string) => string
}

export function MonitorAlerts({ alerts, t }: Props) {
  const criticalCount = alerts.filter((a) => a.level === 'critical').length
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" />
          {t('monitor.alerts')}
          {criticalCount > 0 && (
            <span className="inline-flex rounded-md bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
              {criticalCount} critical
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('monitor.noAlerts')}</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => {
              const st = ALERT_STYLE[a.level]
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
                    st.bg,
                    st.text,
                  )}
                >
                  {a.level === 'critical' || a.level === 'warning' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1">{a.message}</span>
                  <span className="shrink-0 text-xs opacity-70">{a.time}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
