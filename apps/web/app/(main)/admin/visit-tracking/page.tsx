'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BarChart3, Eye, Users, Globe, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

interface VisitSummary {
  pv: number
  uv: number
  ipCount: number
  memberCount: number
}
interface DayPvItem {
  visitDate: string
  pv: number
}
interface DayUvItem {
  visitDate: string
  uv: number
}
interface IpCityItem {
  ip: string | null
  city: string | null
  pv: number
  uv: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function VisitTrackingPage() {
  const t = useTranslations('visitTracking')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['visit-tracking', 'summary'],
    queryFn: () => api<{ summary: VisitSummary }>(`/api/admin/visit-tracking/summary`).then((d) => d.summary),
  })
  const { data: pvData } = useQuery({
    queryKey: ['visit-tracking', 'day-pv'],
    queryFn: () => api<{ list: DayPvItem[] }>(`/api/admin/visit-tracking/day/pv/list`).then((d) => d.list),
  })
  const { data: uvData } = useQuery({
    queryKey: ['visit-tracking', 'day-uv'],
    queryFn: () => api<{ list: DayUvItem[] }>(`/api/admin/visit-tracking/day/uv/list`).then((d) => d.list),
  })
  const { data: ipCityData, isLoading: loadingIpCity } = useQuery({
    queryKey: ['visit-tracking', 'ip-city'],
    queryFn: () => api<{ list: IpCityItem[]; total: number }>(`/api/admin/visit-tracking/ip-city/summary/list?pageSize=20`),
  })

  const cards = [
    { label: t('pv'), value: summary?.pv ?? 0, icon: Eye, color: 'text-primary' },
    { label: t('uv'), value: summary?.uv ?? 0, icon: Users, color: 'text-blue-600' },
    { label: t('ipCount'), value: summary?.ipCount ?? 0, icon: Globe, color: 'text-emerald-600' },
    { label: t('memberCount'), value: summary?.memberCount ?? 0, icon: BarChart3, color: 'text-purple-600' },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <BarChart3 className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 概览卡片 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('overview')}</h2>
        {loadingSummary ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 每日 PV/UV 趋势 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dayPv')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(pvData ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">{t('date')}</th>
                      <th className="px-3 py-1.5 text-left font-medium">PV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pvData ?? []).map((d) => (
                      <tr key={d.visitDate} className="border-t">
                        <td className="px-3 py-1.5 text-muted-foreground">{d.visitDate}</td>
                        <td className="px-3 py-1.5">{d.pv}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dayUv')}</CardTitle>
          </CardHeader>
          <CardContent>
            {(uvData ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">{t('date')}</th>
                      <th className="px-3 py-1.5 text-left font-medium">UV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(uvData ?? []).map((d) => (
                      <tr key={d.visitDate} className="border-t">
                        <td className="px-3 py-1.5 text-muted-foreground">{d.visitDate}</td>
                        <td className="px-3 py-1.5">{d.uv}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* IP 城市统计 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('ipCity')}</h2>
        {loadingIpCity ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (ipCityData?.list ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <Globe className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">IP</th>
                  <th className="px-4 py-2 text-left font-medium">{t('city')}</th>
                  <th className="px-4 py-2 text-left font-medium">PV</th>
                  <th className="px-4 py-2 text-left font-medium">UV</th>
                </tr>
              </thead>
              <tbody>
                {(ipCityData?.list ?? []).map((r, i) => (
                  <tr key={`${r.ip ?? ''}-${r.city ?? ''}-${i}`} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.ip ?? '-'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.city ?? '-'}</td>
                    <td className="px-4 py-2">{r.pv}</td>
                    <td className="px-4 py-2">{r.uv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
