// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOrders, type OrderStatus } from '@ihui/api-client'
import { OrderScreen as SharedOrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { formatDateByTemplate } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 分页大小(对齐 Uniapp user_order_list/index.vue pageSize: 20) */
const PAGE_SIZE = 20

/**
 * 对齐 Uniapp pages/user_order_list/index.vue(我的订单)的文案覆盖:
 * - order.title「我的订单」:mobile-rn zh-CN override 为「订单」,恢复 Uniapp 导航标题
 * - order.tab.shipped「待收货」:Uniapp tab3 待收货筛 status 1|2(已支付+已发货),
 *   RN 该 tab 经 tabToStatus 降级查询 'paid',查询语义一致 → 文案对齐为「待收货」
 * - order.empty「暂无订单信息」:Uniapp 空态文案逐字对齐
 */
const UNIAPP_TEXT: Record<string, string> = {
  'order.title': '我的订单',
  'order.tab.shipped': '待收货',
  'order.empty': '暂无订单信息',
}

/**
 * 将前端 tab 映射为后端 OrderStatus 查询参数。
 * - 'all' → 不过滤(返回全部)
 * - 'shipped' → 后端无 'shipped' 状态,降级为 'paid'(对齐 Uniapp「待收货」tab 筛 status 1|2 的已支付生命周期)
 * - 其他 → 直接作为 OrderStatus 传递
 */
function tabToStatus(tab: OrderTab): OrderStatus | undefined {
  if (tab === 'all') return undefined
  if (tab === 'shipped') return 'paid'
  return tab as OrderStatus
}

/** 对齐 Uniapp formatTimestamp:`YYYY-MM-DD HH:mm` */
function formatOrderTime(input: string | null | undefined): string {
  return formatDateByTemplate(input, 'YYYY-MM-DD HH:mm')
}

export function OrderScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<OrderItem[]>([])
  const [activeTab, setActiveTab] = useState<OrderTab>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // 上拉分页状态(对齐 Uniapp pageNum/hasMore/loading 守卫)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const [error, setError] = useState('')

  // t 包装:Uniapp 对齐文案优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(
    async (mode: 'refresh' | 'more' = 'refresh') => {
      // 对齐 Uniapp getFlowOrderList:refresh 重置 pageNum=1,loadMore 追加下一页
      const nextPage = mode === 'more' ? pageRef.current + 1 : 1
      if (mode === 'refresh') {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError('')
      try {
        const status = tabToStatus(activeTab)
        const res = await getOrders({ status, page: nextPage, pageSize: PAGE_SIZE })
        if (!res.success) throw new Error()
        const list = (res.data?.list ?? []).map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          title: o.targetTitle,
          image: o.image ?? undefined,
          amount: o.payAmount,
          status: o.status,
          // Uniapp「下单时间:YYYY-MM-DD HH:mm」
          createdAt: formatOrderTime(o.createdAt),
        }))
        // 追加/覆盖(函数式更新,避免闭包 items 依赖导致 load 反复重建)
        setItems((prev) => (mode === 'more' ? [...prev, ...list] : list))
        pageRef.current = nextPage
        // hasMore:后端带 total 用「已加载页 * pageSize < total」,否则回退 Uniapp「len === pageSize」
        const total = res.data?.total
        setHasMore(
          typeof total === 'number' ? nextPage * PAGE_SIZE < total : list.length === PAGE_SIZE,
        )
      } catch {
        setError(uniappT('order.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [activeTab, uniappT],
  )

  useEffect(() => {
    void load()
  }, [load])

  const onSelectTab = (tab: OrderTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  // 上拉加载下一页(对齐 Uniapp onReachBottom → loadMore,带 hasMore/loading 守卫)
  const onLoadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return
    void load('more')
  }, [loading, loadingMore, refreshing, hasMore, load])

  // Uniapp 订单卡片无点击跳转;RN 保留 → OrderDetail 详情(增强,路由已注册)
  const onPressItem = (item: OrderItem) => {
    navigation.navigate('OrderDetail', { id: item.id })
  }

  return (
    <SharedOrderScreen
      t={uniappT}
      items={items}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={onPressItem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      hasMore={hasMore}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
