// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, RefreshControl } from 'react-native'
import { fetchApi, getAdminStats, type AdminStats } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { MetricCard } from '../components/dashboard/MetricCard'
import Empty from '../components/common/Empty'
import Loading from '../components/common/Loading'

/** GET /api/admin/analytics/summary */
interface AnalyticsSummary {
  summary: { totalEvents: number; eventTypes: number; uniqueUsers: number }
  todayEvents: number
  byEvent: Array<{ event: string; count: number }>
}

/** GET /api/admin/bi/dashboard */
interface BiDashboard {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  activeUsers: number
}

/** GET /api/admin/error-dashboard/stats */
interface ErrorStats {
  total: number
  today: number
  critical: number
  resolved: number
}

interface DashboardData {
  stats: AdminStats | null
  analytics: AnalyticsSummary | null
  bi: BiDashboard | null
  errors: ErrorStats | null
}

const EMPTY: DashboardData = {
  stats: null,
  analytics: null,
  bi: null,
  errors: null,
}

function Section({ title, items }: { title: string; items: Array<{ label: string; value: string }> }) {
  if (items.length === 0) return null
  return (
    <View className="mb-4">
      <Text className="mb-2 px-1 text-sm font-semibold text-foreground">{title}</Text>
      <View className="flex-row flex-wrap justify-between">
        {items.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </View>
    </View>
  )
}

/**
 * 只读「数据看板」:聚合运营/BI/错误四类数据源并以指标卡展示。
 * 数据源(均 requireAdmin,移动端无权限时由错误态兜底):
 *  - getAdminStats():使用与营收概览(usage/cost)
 *  - /api/admin/analytics/summary:行为埋点概览(usage)
 *  - /api/admin/bi/dashboard:BI 概览(bi/cost)
 *  - /api/admin/error-dashboard/stats:错误看板(errors)
 * 各请求独立容错,部分失败仍可展示其余分区。
 */
export function DashboardScreen() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [adminRes, analyticsRes, biRes, errorRes] = await Promise.allSettled([
      getAdminStats(),
      fetchApi<AnalyticsSummary>('/api/admin/analytics/summary'),
      fetchApi<BiDashboard>('/api/admin/bi/dashboard'),
      fetchApi<ErrorStats>('/api/admin/error-dashboard/stats'),
    ])

    const stats =
      adminRes.status === 'fulfilled' && adminRes.value.success
        ? adminRes.value.data ?? null
        : null
    const analytics =
      analyticsRes.status === 'fulfilled' && analyticsRes.value.success
        ? analyticsRes.value.data ?? null
        : null
    const bi =
      biRes.status === 'fulfilled' && biRes.value.success ? biRes.value.data ?? null : null
    const errors =
      errorRes.status === 'fulfilled' && errorRes.value.success
        ? errorRes.value.data ?? null
        : null

    const okCount = [stats, analytics, bi, errors].filter((v) => v !== null).length
    if (okCount === 0) {
      const firstError =
        adminRes.status === 'rejected'
          ? String(adminRes.reason)
          : adminRes.value.success
            ? t('dashboard.loadFailed')
            : (adminRes.value.error ?? t('dashboard.loadFailed'))
      setError(firstError)
    }
    setData({ stats, analytics, bi, errors })
    setLoading(false)
    setRefreshing(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const fmt = (n: number | null | undefined): string =>
    n === null || n === undefined || Number.isNaN(n)
      ? '—'
      : new Intl.NumberFormat(locale).format(n)

  if (loading) return <Loading text={t('common.loading')} />
  if (error && !data.stats && !data.analytics && !data.bi && !data.errors) {
    return <Empty text={error} actionText={t('common.retry')} onAction={load} />
  }

  const usageMetrics = [
    { label: t('dashboard.totalUsers'), value: fmt(data.stats?.totalUsers) },
    { label: t('dashboard.activeSessions'), value: fmt(data.stats?.activeSessions) },
    { label: t('dashboard.uniqueUsers'), value: fmt(data.analytics?.summary.uniqueUsers) },
    { label: t('dashboard.todayEvents'), value: fmt(data.analytics?.todayEvents) },
  ]
  const costMetrics = [
    { label: t('dashboard.todayRevenue'), value: fmt(data.stats?.todayRevenue) },
    { label: t('dashboard.totalRevenue'), value: fmt(data.bi?.totalRevenue) },
    { label: t('dashboard.totalOrders'), value: fmt(data.bi?.totalOrders) },
  ]
  const biMetrics = [
    { label: t('dashboard.biTotalUsers'), value: fmt(data.bi?.totalUsers) },
    { label: t('dashboard.activeUsers'), value: fmt(data.bi?.activeUsers) },
  ]
  const errorMetrics = [
    { label: t('dashboard.errorTotal'), value: fmt(data.errors?.total) },
    { label: t('dashboard.errorToday'), value: fmt(data.errors?.today) },
    { label: t('dashboard.errorCritical'), value: fmt(data.errors?.critical) },
    { label: t('dashboard.errorResolved'), value: fmt(data.errors?.resolved) },
  ]

  return (
    <ScrollView
      className="flex-1 bg-background px-4 pt-4"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <Section title={t('dashboard.usage')} items={usageMetrics} />
      <Section title={t('dashboard.cost')} items={costMetrics} />
      <Section title={t('dashboard.bi')} items={biMetrics} />
      <Section title={t('dashboard.errors')} items={errorMetrics} />
    </ScrollView>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
