'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Loader2 } from 'lucide-react'

import { MonitorStatCards } from './MonitorStatCards'
import { MonitorAlerts } from './MonitorAlerts'
import { MonitorLogs } from './MonitorLogs'
import { api, buildPerfCards } from './helpers'
import type { ServiceItem, PerfItem, AlertItem, LogSummary } from './types'

export default function MonitoringDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: services, isLoading } = useQuery({
    queryKey: ['admin', 'monitoring', 'services'],
    queryFn: () => api<ServiceItem[]>('/api/admin/monitoring/services'),
  })
  const { data: perf } = useQuery({
    queryKey: ['admin', 'monitoring', 'perf'],
    queryFn: () => api<PerfItem>('/api/admin/monitoring/perf'),
  })
  const { data: alerts } = useQuery({
    queryKey: ['admin', 'monitoring', 'alerts'],
    queryFn: () => api<AlertItem[]>('/api/admin/monitoring/alerts'),
  })
  const { data: logs } = useQuery({
    queryKey: ['admin', 'monitoring', 'logs'],
    queryFn: () => api<LogSummary>('/api/admin/monitoring/logs'),
  })

  const servicesList = services ?? []
  const alertsList = alerts ?? []
  const perfCards = buildPerfCards(perf, t)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          {t('monitor.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('monitor.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <MonitorStatCards services={servicesList} perfCards={perfCards} t={t} />
          <MonitorAlerts alerts={alertsList} t={t} />
          <MonitorLogs logs={logs} t={t} />
        </div>
      )}
    </div>
  )
}
