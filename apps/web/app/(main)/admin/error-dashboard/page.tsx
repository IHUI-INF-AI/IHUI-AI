// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Bug, AlertTriangle, AlertOctagon, CheckCircle2, Loader2, Filter } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { TruncatedText, BackButton } from '@/components/common'
import { cn } from '@/lib/utils'
import {
  MONITOR_ALERT_SEVERITIES,
  MONITOR_ALERT_STATUSES,
  monitorAlertSeverityMeta,
  monitorAlertStatusMeta,
} from '@/lib/admin/monitor-alert-vocabulary'
import { formatDate } from '@/lib/date-utils'

interface ErrorStats {
  total: number
  today: number
  critical: number
  resolved: number
}

/**
 * 库里 `monitor_alerts` 的一行(后端走全列 select ⇒ 列名与 schema 逐字一致)。
 * 旧形态写成 type/endpoint/level/time —— 那些列**库里不存在**(真列是
 * name/source/severity/firedAt),于是 LEVEL_STYLE[e.level] 取到 undefined
 * 就在渲染期抛 TypeError;status 侧用的又是库里不存在的 open/resolved/ignored。
 */
interface ErrorItem {
  id: string
  name: string
  source: string
  severity: string
  status: string
  message: string | null
  firedAt: string
}

const DEFAULT_STATS: ErrorStats = { total: 0, today: 0, critical: 0, resolved: 0 }

const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ErrorDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const [severityFilter, setSeverityFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState('all')

  const { data: stats = DEFAULT_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'error-dashboard', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<ErrorStats>('/api/admin/error-dashboard/stats')
      if (r.success && r.data) return r.data
      return DEFAULT_STATS
    },
  })
  const { data: errors = [] } = useQuery({
    // 筛选进 queryKey ⇒ 改筛选真的重新取数(后端按 severity/status 列过滤)。
    queryKey: ['admin', 'error-dashboard', 'errors', severityFilter, statusFilter],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (severityFilter !== 'all') qs.set('severity', severityFilter)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const query = qs.toString()
      const r = await fetchApi<{ list: ErrorItem[] }>(
        `/api/admin/error-dashboard/errors${query ? `?${query}` : ''}`,
      )
      // 响应体是 {list,page,pageSize};旧写法把整个对象当数组用(⇒ errors.filter 崩)。
      return r.success && r.data?.list ? r.data.list : []
    },
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
    <div className="space-y-4 px-4 py-4">
      <BackButton />
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
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
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
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                {MONITOR_ALERT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {monitorAlertSeverityMeta(s).label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('errorDash.filterStatus')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                {MONITOR_ALERT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {monitorAlertStatusMeta(s).label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSeverityFilter('all')
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
        {errors.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
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
              <tbody>
                {errors.map((e) => {
                  // 词表真值在 monitor-alert-vocabulary(唯一一份);词表外的值落「未判定」。
                  const sev = monitorAlertSeverityMeta(e.severity)
                  const st = monitorAlertStatusMeta(e.status)
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs">{e.name}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <TruncatedText value={e.message ?? ''} className="max-w-[260px]" />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {e.source}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                            sev.bg,
                            sev.text,
                          )}
                        >
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                            st.bg,
                            st.text,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDate(e.firedAt)}
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
