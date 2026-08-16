'use client'

/**
 * 数据分析页 — period 切换 + 组合 AnalyticsDashboard 组件。
 * 调用 /api/publish/analytics/* 端点获取聚合数据。
 *
 * AGENTS.md §4:< 200 行 / rounded-md / 无分割线
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import {
  AnalyticsDashboard,
  type AnalyticsPeriod,
  type AnalyticsOverview,
  type AccountHealth,
} from '@/components/publish/AnalyticsDashboard'

interface OverviewResponse {
  totalPublished: number
  successRate: number
  avgDurationMs: number
  activeAccounts: number
  trend: ReadonlyArray<{ date: string; count: number }>
  platformDistribution: ReadonlyArray<{ platform: string; count: number; color: string }>
  failureReasons: ReadonlyArray<{ reason: string; count: number }>
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AnalyticsPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('30d')
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null)
  const [accounts, setAccounts] = React.useState<AccountHealth[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(
    async (p: AnalyticsPeriod) => {
      setLoading(true)
      try {
        const [ovRes, acRes] = await Promise.all([
          api<OverviewResponse>(`/api/publish/analytics/overview?period=${p}`).catch(() => null),
          api<AccountHealth[]>(`/api/publish/analytics/accounts?period=${p}`).catch(() => []),
        ])
        if (ovRes) {
          setOverview({
            totalPublished: ovRes.totalPublished,
            successRate: ovRes.successRate,
            avgDurationMs: ovRes.avgDurationMs,
            activeAccounts: ovRes.activeAccounts,
            trend: ovRes.trend,
            platformDistribution: ovRes.platformDistribution,
            failureReasons: ovRes.failureReasons,
          })
        } else {
          setOverview(null)
        }
        setAccounts(acRes)
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    void load(period)
  }, [load, period])

  return (
    <div className="space-y-3">
      <BackButton />
      <div>
        <h2 className="text-base font-semibold">{t('analytics.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('analytics.subtitle')}</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AnalyticsDashboard
          period={period}
          onPeriodChange={setPeriod}
          overview={overview}
          accounts={accounts}
        />
      )}
    </div>
  )
}
