// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCommissionOrders, type CommissionOrderItem } from '@ihui/api-client'
import {
  CommissionOrdersScreen as SharedCommissionOrdersScreen,
  type CommissionOrderRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值(apps/web/app/(main)/distribution/orders/page.tsx:52 PAGE_SIZE = 20) */
const PAGE_SIZE = 20

const NS = 'commissionOrdersPage'

/** 与 web STATUS_KEY 同表(apps/web/app/(main)/distribution/orders/page.tsx:54-59),值=本页 ns 下的 i18n 键 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'commissionOrdersPage.orderStatusPending',
  paid: 'commissionOrdersPage.orderStatusPaid',
  cancelled: 'commissionOrdersPage.orderStatusCancelled',
  refunded: 'commissionOrdersPage.orderStatusRefunded',
}

/**
 * RN 端「佣金订单」薄壳 —— 承载 web /distribution/orders。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/finance/commission/orders(契约 apps/api/src/routes/finance.ts:174-201)、
 * 状态筛选(web 同一取值集 all/pending/paid/cancelled/refunded)、分页游标(触底续页)、
 * 时间 Intl 格式化(与 web 同参 locale + MM/DD HH:mm,page.tsx:94-105)、登录门(web useAuthGate 同口径)。
 * 口径差:web 上一页/下一页按钮在 RN 改为下拉刷新 + 触底续页(同端点同参数),如实登记不谎称同款。
 */
export function CommissionOrdersScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [filterValue, setFilterValue] = useState('all')
  const [rows, setRows] = useState<CommissionOrderRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toRow = useCallback(
    (item: CommissionOrderItem): CommissionOrderRowView => ({
      id: item.id,
      orderNo: item.orderNo,
      typeText: item.paymentMethod ?? '-',
      amountCents: item.amount,
      status: item.status,
      statusText: t(STATUS_LABEL_KEYS[item.status] ?? 'commissionOrdersPage.orderStatusPending'),
      timeText: fmtDate(item.createdAt),
    }),
    [fmtDate, t],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getCommissionOrders({
          page: nextPage,
          limit: PAGE_SIZE,
          status: filterValue === 'all' ? undefined : filterValue,
        })
        if (!res.success || !res.data) {
          setError(res.error ?? t(`${NS}.error`))
          return
        }
        setError(null)
        const items = res.data.items ?? []
        setTotal(res.data.total ?? 0)
        setRows((prev) => (append ? [...prev, ...items.map(toRow)] : items.map(toRow)))
        setPage(nextPage)
      } catch {
        setError(t(`${NS}.error`))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, filterValue, toRow, t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const hasMore = rows.length < total

  return (
    <SharedCommissionOrdersScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      total={total}
      filterValue={filterValue}
      onFilterChange={setFilterValue}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onEndReached={() => {
        if (!loading && !loadingMore && hasMore) void load(page + 1, true)
      }}
      onRefresh={() => void load(1, false)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
