// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getCommissionList, type CommissionRecord } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
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
  // 取数失败要单独留一条通道:旧代码把 success:false 折算成空数组,用户看到的是
  // 「暂无订单数据」,会把"接口挂了"误读成"我本来就没有订单"。
  const [error, setError] = useState('')
  // XUI-069:翻页/切 tab/搜索会并发发请求,旧响应不得覆盖新状态。
  const reqSeqRef = useRef(0)

  const loadPage = useCallback(
    async (nextPage: number, reset: boolean) => {
      const seq = (reqSeqRef.current += 1)
      if (reset) setLoading(true)
      else setLoadingMore(true)
      const statusParam = activeTab === 'all' ? undefined : statusText(activeTab)
      try {
        const res = await getCommissionList({
          page: nextPage,
          pageSize: PAGE_SIZE,
          status: statusParam,
        })
        if (seq !== reqSeqRef.current) return
        // success:false 不是"没有数据",是"这次没取到":进错误态;首屏/切 tab 失败时还要清掉
        // 上一档的旧列表,否则错误态被旧数据挡住,用户会以为看到的还是当前档的数据
        if (!res.success) {
          setError(apiFailureToText(res, t('common.loadFailed')))
          if (reset) {
            setOrders([])
            setHasMore(false)
          }
          return
        }
        const list = res.data?.list ?? []
        setError('')
        setOrders((prev) => (reset ? list : [...prev, ...list]))
        setHasMore(list.length >= PAGE_SIZE)
        setPage(nextPage)
      } catch {
        if (seq !== reqSeqRef.current) return
        // 网络异常同样不能静默留空/留旧数据,否则用户以为订单被删了或看到别的档位
        setError(t('common.loadFailed'))
        if (reset) {
          setOrders([])
          setHasMore(false)
        }
      } finally {
        // 被更新的请求顶掉时不复位,免得把新请求的 loading 提前关掉
        if (seq === reqSeqRef.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [activeTab, t],
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
      errorText={error}
      onRetry={() => void loadPage(1, true)}
      onSearch={onSearch}
      onKeywordChange={setKeyword}
      onTabChange={(tab) => setActiveTab(tab as TabValue)}
      onEndReached={onEndReached}
      onBack={() => navigation.goBack()}
      onPressItem={(orderId) => navigation.navigate('OrderDetail', { id: orderId })}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
