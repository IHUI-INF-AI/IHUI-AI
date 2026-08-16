'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import type { EChartsOption } from 'echarts'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { BackButton } from '@/components/common'
import { DOWNLOADS_CONFIG, PLATFORM_META } from '@/config/downloads.config'

type PlatformKey =
  'web' | 'desktop' | 'ios' | 'android-apk' | 'mobile' | 'wechat-miniapp' | 'extension' | 'cli'

interface DownloadsStats {
  total: number
  byPlatform: Record<string, number>
  byDate: Array<{ date: string; count: number }>
}

const PLATFORM_KEYS: PlatformKey[] = [
  'web',
  'desktop',
  'ios',
  'android-apk',
  'mobile',
  'wechat-miniapp',
  'extension',
  'cli',
]

const PLATFORM_LABEL_KEY: Record<PlatformKey, string> = {
  web: 'platformWeb',
  desktop: 'platformDesktop',
  ios: 'platformIos',
  'android-apk': 'platformAndroidApk',
  mobile: 'platformMobile',
  'wechat-miniapp': 'platformWechatMiniapp',
  extension: 'platformExtension',
  cli: 'platformCli',
}

const PLATFORM_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#94a3b8',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
]

const PENDING_PLATFORMS = [
  {
    platformKey: 'ios' as const,
    labelKey: 'platformIos' as const,
    field: 'appStoreId',
    value: DOWNLOADS_CONFIG.appStoreId,
    guideKey: 'pendingIosGuide' as const,
  },
  {
    platformKey: 'android-apk' as const,
    labelKey: 'platformAndroidApk' as const,
    field: 'apkPath',
    value: DOWNLOADS_CONFIG.apkPath,
    guideKey: 'pendingAndroidGuide' as const,
  },
  {
    platformKey: 'wechat-miniapp' as const,
    labelKey: 'platformWechatMiniapp' as const,
    field: 'wechatMiniProgramQr',
    value: DOWNLOADS_CONFIG.wechatMiniProgramQr,
    guideKey: 'pendingWechatGuide' as const,
  },
]

const dateFmt = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })

export default function DownloadsPage() {
  const t = useTranslations('admin.downloads')
  const [platform, setPlatform] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const params = new URLSearchParams()
  if (platform) params.set('platform', platform)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const qs = params.toString()
  const url = `/api/downloads/stats${qs ? `?${qs}` : ''}`

  const { data, isLoading, error } = useQuery<DownloadsStats>({
    queryKey: ['downloads', 'stats', platform, startDate, endDate],
    queryFn: async () => {
      const r = await fetchApi<DownloadsStats>(url)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    staleTime: 60_000,
  })

  const byDate = data?.byDate ?? []
  const byPlatform = data?.byPlatform ?? {}
  const total = data?.total ?? 0
  const today = byDate.at(-1)?.count ?? 0
  const week = byDate.slice(-7).reduce((s, p) => s + p.count, 0)
  const activePlatforms = Object.values(byPlatform).filter((v) => v > 0).length

  const platformLabel = (k: string): string =>
    PLATFORM_LABEL_KEY[k as PlatformKey] ? t(PLATFORM_LABEL_KEY[k as PlatformKey]) : k

  const trendOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: byDate.map((p) => p.date),
      axisLabel: {
        formatter: (val: string) => {
          const d = new Date(`${val}T00:00:00`)
          return Number.isNaN(d.getTime()) ? val : dateFmt.format(d)
        },
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'line',
        smooth: true,
        data: byDate.map((p) => p.count),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { opacity: 0.1 },
      },
    ],
  }

  const pieOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: Object.entries(byPlatform).map(([k, v]) => ({
          name: platformLabel(k),
          value: v,
        })),
        color: PLATFORM_COLORS,
      },
    ],
  }

  const cards = [
    { label: t('total'), value: total },
    { label: t('activePlatforms'), value: activePlatforms },
    { label: t('today'), value: today },
    { label: t('week'), value: week },
  ]

  const platformRows = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackButton />
      <h1 className="text-lg font-semibold">{t('title')}</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('filterPlatform')}</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">{t('allPlatforms')}</option>
              {PLATFORM_KEYS.map((k) => (
                <option key={k} value={k}>
                  {t(PLATFORM_LABEL_KEY[k])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t('endDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : total === 0 ? (
        <div className="rounded-md border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {t('noData')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {c.value.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('trend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EChart option={trendOption} loading={isLoading} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('distribution')}</CardTitle>
              </CardHeader>
              <CardContent>
                <EChart option={pieOption} height={280} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('detail')}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">{t('platform')}</th>
                      <th className="pb-2 text-right font-medium">{t('count')}</th>
                      <th className="pb-2 text-right font-medium">{t('ratio')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformRows.map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1.5">{platformLabel(k)}</td>
                        <td className="py-1.5 text-right tabular-nums">{v.toLocaleString()}</td>
                        <td className="py-1.5 text-right tabular-nums text-emerald-600">
                          {total > 0 ? ((v / total) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('pendingTitle')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('pendingDesc')}</p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">{t('platform')}</th>
                <th className="pb-2 font-medium">{t('pendingField')}</th>
                <th className="pb-2 font-medium">{t('pendingStatus')}</th>
                <th className="pb-2 font-medium">{t('pendingGuide')}</th>
              </tr>
            </thead>
            <tbody>
              {PENDING_PLATFORMS.map((p) => {
                const hasAssets = PLATFORM_META[p.platformKey].assets.length > 0
                return (
                  <tr key={p.field}>
                    <td className="py-1.5 pr-3 font-medium">{t(p.labelKey)}</td>
                    <td className="py-1.5 pr-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.field}</code>
                    </td>
                    <td className="py-1.5 pr-3">
                      {p.value ? (
                        <span className="rounded bg-emerald-600/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                          {t('pendingConnected')}
                        </span>
                      ) : (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          {t('pendingNotConnected')}
                        </span>
                      )}
                      {hasAssets && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({PLATFORM_META[p.platformKey].assets.length})
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">{t(p.guideKey)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('pendingConfigFile')}:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">
              apps/web/src/config/downloads.config.ts
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
