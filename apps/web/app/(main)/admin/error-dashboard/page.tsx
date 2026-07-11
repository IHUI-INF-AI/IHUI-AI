'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Bug, AlertTriangle, AlertOctagon, CheckCircle2, Loader2, Filter } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ErrorStats {
  total: number
  today: number
  critical: number
  resolved: number
}

interface ErrorItem {
  id: string
  type: string
  message: string
  endpoint: string
  time: string
  level: 'error' | 'warning' | 'critical'
  status: 'open' | 'resolved' | 'ignored'
}

const DEFAULT_STATS: ErrorStats = { total: 0, today: 0, critical: 0, resolved: 0 }

const LEVEL_STYLE: Record<ErrorItem['level'], { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Critical' },
  error: { bg: 'bg-orange-500/10', text: 'text-orange-600', label: 'Error' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Warning' },
}
const STATUS_STYLE: Record<ErrorItem['status'], { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Open' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Resolved' },
  ignored: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Ignored' },
}

const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ErrorDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const [levelFilter, setLevelFilter] = React.useState<'all' | ErrorItem['level']>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | ErrorItem['status']>('all')

  const { data: stats = DEFAULT_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'error-dashboard', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<ErrorStats>('/api/admin/error-dashboard/stats')
      if (r.success && r.data) return r.data
      return DEFAULT_STATS
    },
  })
  const { data: errors = [] } = useQuery({
    queryKey: ['admin', 'error-dashboard', 'errors'],
    queryFn: async () => {
      const r = await fetchApi<ErrorItem[]>('/api/admin/error-dashboard/errors')
      if (r.success && r.data) return r.data
      return []
    },
  })

  const filtered = errors.filter((e) => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    if (statusFilter !== 'all' && e.status !== statusFilter) return false
    return true
  })

  const cards = [
    { label: t('errorDash.total'), value: stats.total, icon: Bug, color: 'text-primary' },
    {
      label: t('errorDash.today'),
      value: stats.today,
      icon: AlertTriangle,
      color: 'text-amber-600',
    },
    {
      label: t('errorDash.critical'),
      value: stats.critical,
      icon: AlertOctagon,
      color: 'text-red-600',
    },
    {
      label: t('errorDash.resolved'),
      value: stats.resolved,
      icon: CheckCircle2,
      color: 'text-emerald-600',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bug className="h-6 w-6 text-primary" />
          {t('errorDash.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('errorDash.subtitle')}</p>
      </div>

      {/* 统计卡 */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
                    <c.icon className={cn('h-4 w-4', c.color)} />
                  </div>
                  <div className="mt-1 text-2xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 筛选 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('errorDash.filterLevel')}</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as 'all' | ErrorItem['level'])}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                <option value="critical">Critical</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('errorDash.filterStatus')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ErrorItem['status'])}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLevelFilter('all')
                setStatusFilter('all')
              }}
            >
              <Filter className="h-4 w-4" />
              {t('errorDash.reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('errorDash.errorList')}</h2>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('errorDash.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={th}>{t('errorDash.colType')}</th>
                  <th className={th}>{t('errorDash.colMessage')}</th>
                  <th className={th}>{t('errorDash.colEndpoint')}</th>
                  <th className={th}>{t('errorDash.colLevel')}</th>
                  <th className={th}>{t('errorDash.colStatus')}</th>
                  <th className={th}>{t('errorDash.colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((e) => {
                  const lv = LEVEL_STYLE[e.level]
                  const st = STATUS_STYLE[e.status]
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs">{e.type}</code>
                      </td>
                      <td className="max-w-[260px] break-words px-4 py-2.5" title={e.message}>
                        {e.message}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {e.endpoint}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            lv.bg,
                            lv.text,
                          )}
                        >
                          {lv.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            st.bg,
                            st.text,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                        {e.time}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
