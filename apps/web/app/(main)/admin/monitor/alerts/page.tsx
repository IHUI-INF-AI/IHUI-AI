'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'

import { AlertFilter } from './AlertFilter'
import { AlertTable } from './AlertTable'
import { AlertRules } from './AlertDialog'
import { api } from './helpers'
import type { Alert, AlertRule } from './types'

export default function AdminMonitorAlertsPage() {
  const qc = useQueryClient()
  const [level, setLevel] = React.useState('all')
  const [status, setStatus] = React.useState('all')

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'alerts', level, status],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (level !== 'all') qs.set('level', level)
      if (status !== 'all') qs.set('status', status)
      return api<{ list: Alert[] }>(`/api/admin/monitor/alerts?${qs.toString()}`).then(
        (d) => d.list ?? [],
      )
    },
  })

  const { data: rules = [] } = useQuery({
    queryKey: ['admin', 'monitor', 'alert-rules'],
    queryFn: () =>
      api<{ list: AlertRule[] }>('/api/admin/monitor/alert-rules').then((d) => d.list ?? []),
  })

  const ackMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/monitor/alerts/${id}/ack`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] }),
  })
  const resolveMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/monitor/alerts/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] }),
  })

  const activeCount = alerts.filter((a) => a.status === 'active').length
  const criticalCount = alerts.filter((a) => a.level === 'critical' && a.status === 'active').length
  const warningCount = alerts.filter((a) => a.level === 'warning' && a.status === 'active').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <AlertTriangle className="h-6 w-6 text-primary" />
          告警管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">监控告警处理与规则管理</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">活跃告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">严重告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">警告</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
          </CardContent>
        </Card>
      </div>

      <AlertFilter level={level} setLevel={setLevel} status={status} setStatus={setStatus} />

      <AlertTable
        list={alerts}
        isLoading={isLoading}
        ackPending={ackMut.isPending}
        resolvePending={resolveMut.isPending}
        onAck={(id) => ackMut.mutate(id)}
        onResolve={(id) => resolveMut.mutate(id)}
      />

      <AlertRules rules={rules} />
    </div>
  )
}
