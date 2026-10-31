// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui-react'

import { AlertTable } from './AlertTable'
import { AlertRules } from './AlertDialog'
import { apiOrThrow } from '@/lib/api'
import type { Alert, AlertRule } from './types'
import { BackButton } from '@/components/common'

export default function AdminMonitorAlertsPage() {
  const qc = useQueryClient()

  // 2026-10-31 摘除 level/status 两个筛选 Select:后端 `registerCrud` 的 GET 只解析
  // page/pageSize/search(_shared.ts 的 paginationSchema),`level=` / `status=` 会被
  // zod 静默剥掉 ⇒ 这两个筛选器今天是完全空转的假功能,故整体摘掉(不冒充能筛)。
  // AlertFilter.tsx 保留为"后端支持服务端筛选后再接回"的词表正确组件,当前不渲染。
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'alerts'],
    queryFn: () =>
      apiOrThrow<{ list: Alert[] }>('/api/admin/monitor/alerts').then((d) => d.list ?? []),
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

  // 状态词表与库侧一致(schema/monitor.ts:默认 firing,ack 写 suppressed),
  // 旧 'active' 永不命中 ⇒ 三张卡此前恒为 0。
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
