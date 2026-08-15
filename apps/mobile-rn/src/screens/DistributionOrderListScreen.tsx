import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCommissionList, type CommissionRecord } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { DistributionOrderListScreen as SharedDistributionOrderListScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type TabValue = 'all' | '0' | '1' | '2'

const PAGE_SIZE = 10

function statusText(status: string): string {
  switch (status) {
    case '0':
    case 'pending':
      return '待结算'
    case '1':
    case 'refunded':
      return '退单'
    case '2':
    case 'settled':
    case 'finished':
      return '已完成'
    default:
      return status || '未知'
  }
}

export default function DistributionOrderListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [orders, setOrders] = useState<CommissionRecord[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      if (reset) setLoading(true)
      else setLoadingMore(true)
      const statusParam = activeTab === 'all' ? undefined : statusText(activeTab)
      const res = await getCommissionList({
        page: nextPage,
        pageSize: PAGE_SIZE,
        status: statusParam,
      })
      const list = res.success ? (res.data?.list ?? []) : []
      setOrders((prev) => (reset ? list : [...prev, ...list]))
      setHasMore(list.length >= PAGE_SIZE)
      setPage(nextPage)
      setLoading(false)
      setLoadingMore(false)
    },
    [activeTab],
  )

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const onSearch = (): void => {
    void loadPage(1, true)
  }

  const onEndReached = (): void => {
    if (!loading && !loadingMore && hasMore) {
      void loadPage(page + 1, false)
    }
  }

  return (
    <SharedDistributionOrderListScreen
      t={t}
      orders={orders.map((o) => ({
        id: o.id,
        orderId: o.orderId,
        userNickname: o.userNickname,
        orderAmount: o.orderAmount,
        commissionAmount: o.commissionAmount,
        rate: o.rate,
        createdAt: o.createdAt,
        status: o.status,
      }))}
      keyword={keyword}
      activeTab={activeTab}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onSearch={onSearch}
      onKeywordChange={setKeyword}
      onTabChange={(tab) => setActiveTab(tab as TabValue)}
      onEndReached={onEndReached}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
