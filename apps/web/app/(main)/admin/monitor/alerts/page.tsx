// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'

import { AlertFilter } from './AlertFilter'
import { AlertTable } from './AlertTable'
import { AlertRules } from './AlertDialog'
import { apiOrThrow } from '@/lib/api'
import type { Alert, AlertRule } from './types'
import { BackButton } from '@/components/common'

export default function AdminMonitorAlertsPage() {
  const qc = useQueryClient()
  const [severity, setSeverity] = React.useState('all')
  const [status, setStatus] = React.useState('all')

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'alerts', severity, status],
    queryFn: () => {
      // 筛选参数由后端**真的**按列过滤(旧写法把 level=/status= 发给
      // registerCrud 的 GET,而它只解析 page/pageSize/search ⇒ 两个筛选器从未生效)。
      const qs = new URLSearchParams()
      if (severity !== 'all') qs.set('severity', severity)
      if (status !== 'all') qs.set('status', status)
      const query = qs.toString()
      return apiOrThrow<{ list: Alert[] }>(
        `/api/admin/monitoring/alerts${query ? `?${query}` : ''}`,
      ).then((d) => d.list ?? [])
    },
  })

  const { data: rules = [] } = useQuery({
    queryKey: ['admin', 'monitor', 'alert-rules'],
    queryFn: () =>
      apiOrThrow<{ list: AlertRule[] }>('/api/admin/monitor/alert-rules').then((d) => d.list ?? []),
  })

  const ackMut = useMutation({
    mutationFn: (id: string) =>
      apiOrThrow(`/api/admin/monitor/alerts/${id}/ack`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] }),
  })
  const resolveMut = useMutation({
    mutationFn: (id: string) =>
      apiOrThrow(`/api/admin/monitor/alerts/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'monitor', 'alerts'] }),
  })

  // 汇总口径与库内真值对齐:firing=触发中(旧写法的 'active' 全仓不存在 ⇒ 恒 0)。
  const activeCount = alerts.filter((a) => a.status === 'firing').length
  const criticalCount = alerts.filter(
    (a) => a.severity === 'critical' && a.status === 'firing',
  ).length
  const warningCount = alerts.filter(
    (a) => a.severity === 'warning' && a.status === 'firing',
  ).length

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <AlertTriangle className="h-6 w-6 text-primary" />
          告警管理
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">监控告警处理与规则管理</p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">活跃告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger-text">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">严重告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger-text">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">警告</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-text">{warningCount}</div>
          </CardContent>
        </Card>
      </div>

      <AlertFilter
        severity={severity}
        setSeverity={setSeverity}
        status={status}
        setStatus={setStatus}
      />

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
