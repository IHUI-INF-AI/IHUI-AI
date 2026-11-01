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
// 共享词表唯一真相源(canonical,§0.6 单一真相源:页面内不得再写一份合法值数组)。
import {
  MONITOR_ALERT_SEVERITIES,
  MONITOR_ALERT_STATUSES,
  isMonitorAlertSeverity,
  isMonitorAlertStatus,
  type MonitorAlertSeverity,
  type MonitorAlertStatus,
} from '@ihui/types'

interface ErrorStats {
  total: number
  today: number
  critical: number
  resolved: number
}

/**
 * 后端 /api/admin/error-dashboard/errors 的真实行形状:
 * `select * from monitor_alerts`(packages/database/src/schema/monitor.ts 列名逐字同名)。
 * 旧前端自造的 `level`(真列是 severity)与 `endpoint`(真列是 source)/`open|ignored`
 * 状态在这一族数据上恒为 undefined ⇒ `LEVEL_STYLE[e.level]` 取到 undefined 再取属性即崩表。
 * 库里 severity/status 是裸 varchar(无 CHECK),值按 string 读、经词表谓词判定,未知值走兜底。
 */
interface AlertRow {
  id: string
  name: string
  source: string
  severity: string
  status: string
  message: string | null
  firedAt: string | null
  resolvedAt: string | null
  createdAt: string
}

/** 后端 success({ list, page, pageSize }) 信封(旧前端把 data 当裸数组用,同样是契约错位) */
interface AlertsResponse {
  list: AlertRow[]
  page: number
  pageSize: number
}

const DEFAULT_STATS: ErrorStats = { total: 0, today: 0, critical: 0, resolved: 0 }

interface BadgeStyle {
  bg: string
  text: string
  label: string
}

const SEVERITY_STYLE: Record<MonitorAlertSeverity, BadgeStyle> = {
  info: { bg: 'bg-sky-500/10', text: 'text-sky-600', label: 'Info' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Warning' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Critical' },
}
const STATUS_STYLE: Record<MonitorAlertStatus, BadgeStyle> = {
  firing: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Firing' },
  suppressed: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Suppressed' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Resolved' },
}
const NEUTRAL_BADGE: Pick<BadgeStyle, 'bg' | 'text'> = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
}

/** 带兜底的取用出口:未知枚举不抛错、不折成已知档,原样显示裸值(空值显示 —) */
function severityBadge(value: string): BadgeStyle {
  if (isMonitorAlertSeverity(value)) return SEVERITY_STYLE[value]
  return { ...NEUTRAL_BADGE, label: value.trim() === '' ? '—' : value }
}
function statusBadge(value: string): BadgeStyle {
  if (isMonitorAlertStatus(value)) return STATUS_STYLE[value]
  return { ...NEUTRAL_BADGE, label: value.trim() === '' ? '—' : value }
}

const FIRED_AT_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
function formatFiredAt(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : FIRED_AT_FMT.format(d)
}

const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function ErrorDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const [severityFilter, setSeverityFilter] = React.useState<'all' | MonitorAlertSeverity>('all')
  const [statusFilter, setStatusFilter] = React.useState<'all' | MonitorAlertStatus>('all')

  const { data: stats = DEFAULT_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'error-dashboard', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<ErrorStats>('/api/admin/error-dashboard/stats')
      if (r.success && r.data) return r.data
      return DEFAULT_STATS
    },
  })
  const { data: alerts = [] } = useQuery<AlertRow[]>({
    queryKey: ['admin', 'error-dashboard', 'errors'],
    queryFn: async () => {
      const r = await fetchApi<AlertsResponse>('/api/admin/error-dashboard/errors')
      const payload = r.success ? r.data : undefined
      return payload && Array.isArray(payload.list) ? payload.list : []
    },
  })

  // 筛选真列名:旧实现拿 e.level(后端无此列,恒 undefined)比较 ⇒ 任何非 all 筛选恒空
  const filtered = alerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
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
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
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
                    <span className="text-body font-medium text-muted-foreground">{c.label}</span>
                    <c.icon className={cn('h-4 w-4', c.color)} />
                  </div>
                  <div className="mt-1 text-display font-bold">{c.value}</div>
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
                aria-label={t('errorDash.filterLevel')}
                value={severityFilter}
                onChange={(e) => {
                  const v = e.target.value
                  // 收窄走词表谓词(不用 as 强绕类型):非法值直接忽略
                  if (v === 'all' || isMonitorAlertSeverity(v)) setSeverityFilter(v)
                }}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                {MONITOR_ALERT_SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {SEVERITY_STYLE[v].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('errorDash.filterStatus')}</span>
              <select
                aria-label={t('errorDash.filterStatus')}
                value={statusFilter}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'all' || isMonitorAlertStatus(v)) setStatusFilter(v)
                }}
                className={selectClass}
              >
                <option value="all">{t('errorDash.all')}</option>
                {MONITOR_ALERT_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {STATUS_STYLE[v].label}
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
        {filtered.length === 0 ? (
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
                {filtered.map((a) => {
                  const sev = severityBadge(a.severity)
                  const st = statusBadge(a.status)
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs">{a.name}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <TruncatedText value={a.message ?? '—'} className="max-w-[260px]" />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {a.source}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-label font-medium',
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
                            'inline-flex rounded-md px-2 py-0.5 text-label font-medium',
                            st.bg,
                            st.text,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                        {formatFiredAt(a.firedAt)}
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
