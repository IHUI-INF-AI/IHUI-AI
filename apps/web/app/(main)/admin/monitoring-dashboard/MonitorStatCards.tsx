'use client'

import { Server, Activity, CheckCircle2, XCircle } from 'lucide-react'
import { type useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { SERVICE_ICONS } from './types'
import type { ServiceItem } from './types'

interface Props {
  services: ServiceItem[]
  perfCards: { label: string; value: string | number; color: string }[]
  t: ReturnType<typeof useTranslations>
}

export function MonitorStatCards({ services, perfCards, t }: Props) {
  const healthyCount = services.filter((s) => s.status === 'healthy').length
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t('monitor.services')}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t('monitor.healthyCount', { healthy: healthyCount, total: services.length })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {services.map((s) => {
              const Icon = SERVICE_ICONS[s.name] ?? Server
              const ok = s.status === 'healthy'
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-md border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', ok ? 'text-emerald-600' : 'text-red-600')} />
                    <span className="text-sm font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ok ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                    )}
                    <span className={cn('text-xs', ok ? 'text-emerald-600' : 'text-red-600')}>
                      {s.latency}ms
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            {t('monitor.perf')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {perfCards.map((c) => (
              <div key={c.label} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className={cn('mt-1 text-xl font-bold', c.color)}>{c.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
