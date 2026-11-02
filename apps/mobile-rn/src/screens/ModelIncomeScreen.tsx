// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getOverview,
  getCommissionList,
  getDayMonthSummary,
  type CommissionOverview,
  type CommissionRecord,
  type DayMonthSummary,
} from '@ihui/api-client'
import {
  ModelIncomeScreen as SharedModelIncomeScreen,
  type ModelIncomeItem,
  type ModelIncomeSummary,
  type ModelIncomeTab,
} from '@ihui/rn-app'
import { formatDateByTemplate } from '../utils/date-utils'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 每页条数(触底续取,对齐端内 income 的分页单位) */
const PAGE_SIZE = 20

function toItems(list: CommissionRecord[]): ModelIncomeItem[] {
  return list.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    status: r.status,
    createdAt: formatDateByTemplate(r.createdAt, 'YYYY-MM-DD HH:mm'),
    userNickname: r.userNickname,
    orderAmount: r.orderAmount,
    rate: r.rate,
    commissionAmount: r.commissionAmount,
  }))
}

export default function ModelIncomeScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<ModelIncomeTab>('all')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [overview, setOverview] = useState<CommissionOverview | null>(null)
  const [dayMonth, setDayMonth] = useState<DayMonthSummary | null>(null)
  const [records, setRecords] = useState<ModelIncomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const [overviewRes, listRes, dayMonthRes] = await Promise.all([
        getOverview(),
        getCommissionList({ page: 1, pageSize: PAGE_SIZE }),
        getDayMonthSummary(),
      ])
      let errMsg = ''
      if (overviewRes.success) setOverview(overviewRes.data)
      else errMsg = overviewRes.error || t('modelIncome.loadOverviewFailed')
      if (listRes.success) {
        setRecords(toItems(listRes.data.list))
        setPage(1)
        setHasMore(PAGE_SIZE < listRes.data.total)
      } else {
        errMsg = errMsg || listRes.error || t('modelIncome.loadListFailed')
      }
      if (dayMonthRes.success) setDayMonth(dayMonthRes.data)
      if (errMsg) setError(errMsg)
    } catch {
      setError(t('modelIncome.networkError'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = page + 1
      const res = await getCommissionList({ page: next, pageSize: PAGE_SIZE })
      if (res.success) {
        setRecords((prev) => [...prev, ...toItems(res.data.list)])
        setPage(next)
        setHasMore(next * PAGE_SIZE < res.data.total)
      }
    } catch {
      setError(t('modelIncome.networkError'))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page, t])

  const summary: ModelIncomeSummary | null =
    overview || dayMonth
      ? {
          totalCommission: overview?.totalCommission ?? 0,
          availableCommission: overview?.availableCommission ?? 0,
          withdrawnCommission: overview?.withdrawnCommission ?? 0,
          pendingCommission: overview?.pendingCommission ?? 0,
          day: dayMonth?.day ?? 0,
        }
      : null

  return (
    <SharedModelIncomeScreen
      t={t}
      items={records}
      summary={summary}
      loading={loading}
      refreshing={refreshing}
      error={error}
      activeTab={tab}
      onSelectTab={setTab}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      showWithdrawModal={showWithdraw}
      onOpenWithdraw={() => setShowWithdraw(true)}
      onCloseWithdraw={() => setShowWithdraw(false)}
      onConfirmWithdraw={() => setShowWithdraw(false)}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onLoadMore={loadMore}
      onBack={() => navigation.goBack()}
      onRetry={() => { void load(); }}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
