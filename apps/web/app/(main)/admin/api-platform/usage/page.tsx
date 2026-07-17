'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, BarChart3, TrendingUp, Zap, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'

interface UsageRow {
  id: string
  appName: string
  callCount: number
  successCount: number
  failCount: number
  avgLatency: number
  quotaUsed: number
  quotaTotal: number
}

interface UsageSummary {
  totalCalls: number
  totalSuccess: number
  totalFail: number
  avgLatency: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function AdminApiPlatformUsagePage() {
  const t = useTranslations('adminApiUsage')
  const [range, setRange] = React.useState('7d')

  const { data: summary } = useQuery({
    queryKey: ['admin', 'api-platform', 'usage', 'summary', range],
    queryFn: () => api<UsageSummary>(`/api/admin/api-platform/usage/summary?range=${range}`),
  })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'api-platform', 'usage', range],
    queryFn: () =>
      api<{ list: UsageRow[] }>(`/api/admin/api-platform/usage?range=${range}`).then(
        (d) => d.list ?? [],
      ),
  })

  const successRate =
    summary && summary.totalCalls > 0 ? (summary.totalSuccess / summary.totalCalls) * 100 : 0
  const cards = [
    {
      key: 'totalCalls',
      label: t('totalCalls'),
      value: summary?.totalCalls ?? 0,
      icon: BarChart3,
      cls: 'text-primary',
    },
    {
      key: 'success',
      label: t('success'),
      value: summary?.totalSuccess ?? 0,
      icon: TrendingUp,
      cls: 'text-emerald-600',
    },
    {
      key: 'fail',
      label: t('fail'),
      value: summary?.totalFail ?? 0,
      icon: Zap,
      cls: 'text-red-600',
    },
    {
      key: 'avgLatency',
      label: t('avgLatency'),
      value: `${summary?.avgLatency ?? 0}ms`,
      icon: Clock,
      cls: 'text-primary',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className={selectClass} aria-label={t('rangeAriaLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">{t('range24h')}</SelectItem>
            <SelectItem value="7d">{t('range7d')}</SelectItem>
            <SelectItem value="30d">{t('range30d')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold', c.cls)}>
                  {typeof c.value === 'number' ? formatNumber(c.value) : c.value}
                </div>
                {c.key === 'success' && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('successRate')} {successRate.toFixed(1)}%
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs uppercase">{t('colApp')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colCallCount')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colSuccess')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colFail')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colAvgLatency')}</TableHead>
              <TableHead className="text-xs uppercase">{t('colQuotaUsage')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const rate = r.quotaTotal > 0 ? (r.quotaUsed / r.quotaTotal) * 100 : 0
                const rowSuccessRate = r.callCount > 0 ? (r.successCount / r.callCount) * 100 : 0
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.appName}</TableCell>
                    <TableCell>{formatNumber(r.callCount)}</TableCell>
                    <TableCell className="text-emerald-600">
                      {formatNumber(r.successCount)}
                    </TableCell>
                    <TableCell className="text-red-600">{formatNumber(r.failCount)}</TableCell>
                    <TableCell>{r.avgLatency}ms</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-2xl bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-md',
                              rate > 90
                                ? 'bg-red-500'
                                : rate > 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500',
                            )}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {r.quotaUsed}/{r.quotaTotal} ({rate.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t('successRate')} {rowSuccessRate.toFixed(1)}%
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
