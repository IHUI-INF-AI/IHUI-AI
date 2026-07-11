'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertTriangle, CheckCircle2, Bell, Check, X } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Alert {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  message: string
  source: string
  status: 'active' | 'acknowledged' | 'resolved'
  createdAt: string
  resolvedAt: string | null
}

interface AlertRule {
  id: string
  name: string
  metric: string
  threshold: number
  operator: '>' | '<' | '>=' | '<='
  enabled: boolean
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const LEVEL_STYLE: Record<
  Alert['level'],
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', icon: AlertTriangle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: AlertTriangle },
  info: { bg: 'bg-primary/10', text: 'text-primary', icon: Bell },
}
const STATUS_LABEL: Record<Alert['status'], string> = {
  active: '活跃',
  acknowledged: '已确认',
  resolved: '已解决',
}
const STATUS_STYLE: Record<Alert['status'], string> = {
  active: 'bg-red-500/10 text-red-600',
  acknowledged: 'bg-amber-500/10 text-amber-600',
  resolved: 'bg-emerald-500/10 text-emerald-600',
}

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
            <div className="text-2xl font-bold text-red-600">
              {alerts.filter((a) => a.status === 'active').length}
            </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className={selectClass} aria-label="级别">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部级别</SelectItem>
            <SelectItem value="critical">严重</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="info">信息</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">级别</TableHead>
              <TableHead className="text-xs uppercase">标题</TableHead>
              <TableHead className="text-xs uppercase">来源</TableHead>
              <TableHead className="text-xs uppercase">状态</TableHead>
              <TableHead className="text-xs uppercase">时间</TableHead>
              <TableHead className="text-right text-xs uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                  暂无告警
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((a) => {
                const st = LEVEL_STYLE[a.level]
                const Icon = st.icon
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                          st.bg,
                          st.text,
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {a.level}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      <div className="max-w-[300px] break-words text-xs text-muted-foreground">
                        {a.message}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.source}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                          STATUS_STYLE[a.status],
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {STATUS_LABEL[a.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === 'active' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ackMut.isPending}
                          onClick={() => ackMut.mutate(a.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                          确认
                        </Button>
                      )}
                      {a.status !== 'resolved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate(a.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          解决
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {rules.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              告警规则
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.metric} {r.operator} {r.threshold}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                      r.enabled
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        r.enabled ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                    {r.enabled ? '启用' : '禁用'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
