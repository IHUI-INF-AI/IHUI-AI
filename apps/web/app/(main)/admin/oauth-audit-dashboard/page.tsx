'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ShieldCheck, KeyRound, Activity, AlertTriangle, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface AuditStats {
  totalAuth: number
  todayAuth: number
  activeApps: number
  anomalyEvents: number
}

interface AuditLog {
  id: string
  time: string
  app: string
  event: string
  status: 'success' | 'failed' | 'warning'
  ip: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const MOCK_STATS: AuditStats = { totalAuth: 84210, todayAuth: 1240, activeApps: 24, anomalyEvents: 8 }
const MOCK_LOGS: AuditLog[] = [
  { id: '1', time: '2026-07-10 09:12:30', app: '协作工具', event: 'authorization.granted', status: 'success', ip: '203.0.113.42' },
  { id: '2', time: '2026-07-10 09:10:18', app: '数据分析平台', event: 'token.refresh', status: 'success', ip: '198.51.100.7' },
  { id: '3', time: '2026-07-10 09:05:42', app: '未知应用', event: 'authorization.denied', status: 'failed', ip: '198.51.100.99' },
  { id: '4', time: '2026-07-10 08:58:55', app: 'CRM 系统', event: 'token.revoked', status: 'warning', ip: '203.0.113.18' },
  { id: '5', time: '2026-07-10 08:40:00', app: '协作工具', event: 'authorization.granted', status: 'success', ip: '203.0.113.42' },
  { id: '6', time: '2026-07-10 08:22:14', app: '客服系统', event: 'authorization.granted', status: 'success', ip: '192.0.2.88' },
  { id: '7', time: '2026-07-10 08:08:33', app: '数据分析平台', event: 'login.failed', status: 'failed', ip: '198.51.100.7' },
]

const STATUS_STYLE: Record<AuditLog['status'], { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Success' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Warning' },
}

export default function OauthAuditDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: stats = MOCK_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'oauth-audit', 'stats'],
    queryFn: () => Promise.resolve(MOCK_STATS),
  })
  const { data: logs = MOCK_LOGS } = useQuery({
    queryKey: ['admin', 'oauth-audit', 'logs'],
    queryFn: async () => {
      try {
        const d = await api<{ list?: AuditLog[] } | AuditLog[]>('/api/agents/oauth-apps/audit-logs')
        return Array.isArray(d) ? d : (d.list ?? MOCK_LOGS)
      } catch {
        return MOCK_LOGS
      }
    },
  })

  const cards = [
    { label: t('oauthAudit.totalAuth'), value: stats.totalAuth.toLocaleString(), icon: KeyRound, color: 'text-primary' },
    { label: t('oauthAudit.todayAuth'), value: stats.todayAuth.toLocaleString(), icon: Activity, color: 'text-blue-600' },
    { label: t('oauthAudit.activeApps'), value: stats.activeApps, icon: ShieldCheck, color: 'text-emerald-600' },
    { label: t('oauthAudit.anomalyEvents'), value: stats.anomalyEvents, icon: AlertTriangle, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t('oauthAudit.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('oauthAudit.subtitle')}</p>
      </div>

      {/* 统计卡 */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={cn('h-4 w-4', c.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 审计日志 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('oauthAudit.auditLogs')}</h2>
        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('oauthAudit.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('oauthAudit.colTime')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('oauthAudit.colApp')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('oauthAudit.colEvent')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('oauthAudit.colStatus')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('oauthAudit.colIp')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l) => {
                  const st = STATUS_STYLE[l.status]
                  return (
                    <tr key={l.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{l.time}</td>
                      <td className="px-4 py-2.5 font-medium">{l.app}</td>
                      <td className="px-4 py-2.5"><code className="font-mono text-xs text-muted-foreground">{l.event}</code></td>
                      <td className="px-4 py-2.5">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', st.bg, st.text)}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{l.ip}</td>
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
