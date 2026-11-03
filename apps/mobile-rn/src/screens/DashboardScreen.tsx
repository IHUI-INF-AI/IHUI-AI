// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchApi, getAdminStats, type AdminStats } from '@ihui/api-client'
import {
  DashboardScreen as SharedDashboardScreen,
  getTokens,
  type DashboardMetricItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
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

/**
 * 只读「数据看板」wrapper:聚合运营/BI/错误四类数据源并映射为共享层指标项。
 * 数据源(均 requireAdmin,移动端无权限时由错误态兜底):
 *  - getAdminStats():使用与营收概览(usage/cost)
 *  - /api/admin/analytics/summary:行为埋点概览(usage)
 *  - /api/admin/bi/dashboard:BI 概览(bi/cost)
 *  - /api/admin/error-dashboard/stats:错误看板(errors)
 * 各请求独立容错,部分失败仍可展示其余分区。纯 UI 渲染在 @ihui/rn-app DashboardScreen。
 */
export function DashboardScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
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
        ? (adminRes.value.data ?? null)
        : null
    const analytics =
      analyticsRes.status === 'fulfilled' && analyticsRes.value.success
        ? (analyticsRes.value.data ?? null)
        : null
    const bi =
      biRes.status === 'fulfilled' && biRes.value.success ? (biRes.value.data ?? null) : null
    const errors =
      errorRes.status === 'fulfilled' && errorRes.value.success
        ? (errorRes.value.data ?? null)
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

  /** 数字格式化在端内完成( locale 感知),共享层只收展示文本 */
  const fmt = useCallback(
    (n: number | null | undefined): string =>
      n === null || n === undefined || Number.isNaN(n)
        ? '—'
        : new Intl.NumberFormat(locale).format(n),
    [locale],
  )

  const items = useMemo<DashboardMetricItem[]>(() => {
    // 四源全失败时不渲染指标卡,交给空态(Empty + 重试)兜底,与迁移前行为一致
    if (!data.stats && !data.analytics && !data.bi && !data.errors) return []
    const usageGroup = t('dashboard.usage')
    const costGroup = t('dashboard.cost')
    const biGroup = t('dashboard.bi')
    const errorsGroup = t('dashboard.errors')
    return [
      {
        id: 'usage.totalUsers',
        group: usageGroup,
        label: t('dashboard.totalUsers'),
        value: fmt(data.stats?.totalUsers),
      },
      {
        id: 'usage.activeSessions',
        group: usageGroup,
        label: t('dashboard.activeSessions'),
        value: fmt(data.stats?.activeSessions),
      },
      {
        id: 'usage.uniqueUsers',
        group: usageGroup,
        label: t('dashboard.uniqueUsers'),
        value: fmt(data.analytics?.summary.uniqueUsers),
      },
      {
        id: 'usage.todayEvents',
        group: usageGroup,
        label: t('dashboard.todayEvents'),
        value: fmt(data.analytics?.todayEvents),
      },
      {
        id: 'cost.todayRevenue',
        group: costGroup,
        label: t('dashboard.todayRevenue'),
        value: fmt(data.stats?.todayRevenue),
      },
      {
        id: 'cost.totalRevenue',
        group: costGroup,
        label: t('dashboard.totalRevenue'),
        value: fmt(data.bi?.totalRevenue),
      },
      {
        id: 'cost.totalOrders',
        group: costGroup,
        label: t('dashboard.totalOrders'),
        value: fmt(data.bi?.totalOrders),
      },
      {
        id: 'bi.totalUsers',
        group: biGroup,
        label: t('dashboard.biTotalUsers'),
        value: fmt(data.bi?.totalUsers),
      },
      {
        id: 'bi.activeUsers',
        group: biGroup,
        label: t('dashboard.activeUsers'),
        value: fmt(data.bi?.activeUsers),
      },
      {
        id: 'errors.total',
        group: errorsGroup,
        label: t('dashboard.errorTotal'),
        value: fmt(data.errors?.total),
      },
      {
        id: 'errors.today',
        group: errorsGroup,
        label: t('dashboard.errorToday'),
        value: fmt(data.errors?.today),
      },
      {
        id: 'errors.critical',
        group: errorsGroup,
        label: t('dashboard.errorCritical'),
        value: fmt(data.errors?.critical),
      },
      {
        id: 'errors.resolved',
        group: errorsGroup,
        label: t('dashboard.errorResolved'),
        value: fmt(data.errors?.resolved),
      },
    ]
  }, [data, fmt, t])

  return (
    <SharedDashboardScreen
      t={t}
      tk={getTokens(resolvedTheme)}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={load}
      renderLoading={() => <Loading text={t('common.loading')} />}
      renderEmpty={() => (
        <Empty text={error || t('common.empty')} actionText={t('common.retry')} onAction={load} />
      )}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
