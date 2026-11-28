// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { apiOrThrow } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { BackButton } from '@/components/common'
import {
  AnalyticsDashboard,
  type AnalyticsPeriod,
  type AnalyticsOverview,
  type AnalyticsMetricsSummary,
  type AccountHealth,
} from '@/components/publish/AnalyticsDashboard'
import {
  dedupeContent,
  rankTopContent,
  type ContentPerformance,
} from '@/lib/publish/top-content'

interface OverviewResponse {
  totalPublished: number
  successRate: number
  avgDurationMs: number
  activeAccounts: number
  trend: ReadonlyArray<{ date: string; count: number }>
  platformDistribution: ReadonlyArray<{ platform: string; count: number; color: string }>
  failureReasons: ReadonlyArray<{ reason: string; count: number }>
  metrics?: AnalyticsMetricsSummary | null
}

interface MonitorMetrics {
  views: number
  likes: number
  comments: number
  shares: number
}

/** 监测页已经在用的逐篇快照;这里只取复盘需要的字段,不跨路由 import 组件类型。 */
interface MonitorItemLite {
  task_id: string
  title: string
  platform: string
  created_at: string | null
  finished_at: string | null
  published_url: string | null
  metrics: MonitorMetrics | null
}

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

function buildTopContent(
  items: ReadonlyArray<MonitorItemLite>,
  period: AnalyticsPeriod,
  now = Date.now(),
): ContentPerformance[] {
  const cutoff = now - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000
  const candidates = items
    .filter((item) => {
      if (!item.metrics) return false
      const ts = item.finished_at ?? item.created_at
      if (!ts) return false
      const time = new Date(ts).getTime()
      return Number.isFinite(time) && time >= cutoff
    })
    .map((item) => ({
      taskId: item.task_id,
      title: item.title,
      platform: item.platform,
      views: item.metrics?.views ?? 0,
      likes: item.metrics?.likes ?? 0,
      comments: item.metrics?.comments ?? 0,
      shares: item.metrics?.shares ?? 0,
      publishedAt: item.finished_at ?? item.created_at,
      publishedUrl: item.published_url,
    }))
  return rankTopContent(dedupeContent(candidates), 5)
}

export default function AnalyticsPage() {
  const t = useTranslations('publish')
  const toast = useToast()
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('30d')
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null)
  const [accounts, setAccounts] = React.useState<AccountHealth[]>([])
  const [topContent, setTopContent] = React.useState<ContentPerformance[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(
    async (p: AnalyticsPeriod) => {
      setLoading(true)
      try {
        const [ovRes, acRes, monitorRes] = await Promise.all([
          apiOrThrow<OverviewResponse>(`/api/publish/analytics/overview?period=${p}`).catch(
            () => null,
          ),
          apiOrThrow<AccountHealth[]>(`/api/publish/analytics/accounts?period=${p}`).catch(
            () => [],
          ),
          apiOrThrow<{ items?: MonitorItemLite[] }>(
            '/api/publish/monitor/overview?limit=50',
          ).catch(() => ({ items: [] as MonitorItemLite[] })),
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
            metrics: ovRes.metrics ?? null,
          })
        } else {
          setOverview(null)
        }
        setAccounts(acRes)
        setTopContent(buildTopContent(monitorRes.items ?? [], p))
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
    <div className="px-4 space-y-3">
      <BackButton />
      <div>
        <h2 className="text-base font-semibold">{t('analytics.title')}</h2>
        <p className="text-label text-muted-foreground">{t('analytics.subtitle')}</p>
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
          topContent={topContent}
        />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
