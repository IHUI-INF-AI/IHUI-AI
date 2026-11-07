// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的订单 — 小程序薄壳
 *
 * UI 单源:packages/app/src/features/order/OrderScreen.tsx
 *   RN 消费点:apps/mobile-rn/src/screens/OrderScreen.tsx:177 `<SharedOrderScreen … onPay={onPay}`
 * 平台能力(下拉刷新/触底加载/支付跳转)仅在本端实现,共享屏内零 Taro、零 wx.requestPayment。
 * i18n:共享屏按键为 order.*,本端缺该键 ⇒ 经 ORDER_TEXT 映射到既有 common.* / user.orders.* 词条,
 *   不允许渲染裸 key(scripts/tests/miniapp-shell-form.test.mjs T11 断言)。
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { getOrderList, type Order } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useI18n } from '@/i18n'
import { useTheme } from '@/rn-compat/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { OrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app/features/order/OrderScreen'

const PAGE_SIZE = 10

/** 共享屏词条 → 本端既有词条(全部解析为人话;缺任一条 T11 必红) */
const ORDER_TEXT: Record<string, string> = {
  'order.title': 'order.list.title',
  'order.loadFailed': 'order.loadFailed',
  'order.tab.all': 'user.orders.tabsAll',
  'order.tab.pending': 'user.orders.tabsPending',
  'order.tab.shipped': 'memberDashboard.status.shipped',
  'order.tab.completed': 'memberDashboard.status.completed',
  'order.tab.refunded': 'order.tab.refunded',
  'order.searchPlaceholder': 'search.placeholder',
  'order.empty': 'user.orders.empty',
  'order.amount': 'order.refund.amountLabel',
  'order.noMore': 'common.noMore',
  'order.pay': 'user.orders.pay',
  'order.status.pending': 'memberDashboard.status.pending',
  'order.status.paid': 'memberDashboard.status.paid',
  'order.status.shipped': 'memberDashboard.status.shipped',
  'order.status.completed': 'memberDashboard.status.completed',
  'order.status.cancelled': 'memberDashboard.status.cancelled',
  'order.status.refunded': 'order.status.refunded',
  'order.status.refunding': 'order.status.refunding',
  'order.status.failed': 'order.status.failed',
}

/** 共享 tab → 后端 OrderStatus 查询参数(对齐 RN tabToStatus) */
const TAB_STATUS: Record<string, string> = {
  all: '',
  pending: 'pending',
  shipped: 'paid',
  completed: 'completed',
  refunded: 'refunded',
}

function toOrderItem(order: Order): OrderItem {
  const parsed = Number(order.amount)
  return {
    id: String(order.id),
    orderNo: order.orderNo,
    title: order.title,
    amount: Number.isFinite(parsed) ? parsed : null,
    status: order.status as OrderItem['status'],
    createdAt: order.createTime,
  }
}

export default function Orders() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const { resolvedTheme } = useTheme()

  const [items, setItems] = useState<OrderItem[]>([])
  const [activeTab, setActiveTab] = useState<OrderTab>('all')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  const pageRef = useRef(1)
  const tabRef = useRef<OrderTab>('all')
  const itemsRef = useRef<OrderItem[]>([])
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const rawAmountRef = useRef<Map<string, string>>(new Map())

  const load = useCallback(
    async (mode: 'refresh' | 'more' = 'refresh') => {
      if (loadingRef.current) return
      if (mode === 'more' && !hasMoreRef.current) return
      loadingRef.current = true
      const nextPage = mode === 'more' ? pageRef.current : 1
      if (mode === 'refresh') {
        setLoading(true)
        setError('')
      } else {
        setLoadingMore(true)
      }
      try {
        const res = await getOrderList({
          page: nextPage,
          pageSize: PAGE_SIZE,
          status: TAB_STATUS[tabRef.current] ?? '',
        })
        const raw = res.list || []
        raw.forEach((o) => rawAmountRef.current.set(String(o.id), String(o.amount ?? '')))
        const mapped = raw.map(toOrderItem)
        const prev = mode === 'more' ? itemsRef.current : []
        const next = [...prev, ...mapped]
        itemsRef.current = next
        pageRef.current = nextPage + 1
        hasMoreRef.current = next.length < (res.total ?? next.length)
        setItems(next)
        setHasMore(hasMoreRef.current)
      } catch {
        setError(t('order.loadFailed'))
      } finally {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load('refresh')
  }, [load])

  const onLoadMore = useCallback(() => {
    void load('more')
  }, [load])

  const onSelectTab = useCallback(
    (tab: OrderTab) => {
      if (tab === tabRef.current) return
      tabRef.current = tab
      setActiveTab(tab)
      pageRef.current = 1
      void load('refresh')
    },
    [load],
  )

  const onPressItem = useCallback((item: OrderItem) => {
    Taro.navigateTo({ url: `/pkg-shop/order/detail?id=${item.id}` })
  }, [])

  // 支付回调留在端内:共享屏只渲染操作区,这里走小程序支付页(原 orders.tsx:82 行为)
  const onPay = useCallback((item: OrderItem) => {
    const amount =
      rawAmountRef.current.get(item.id) ?? (item.amount !== null ? String(item.amount) : '')
    Taro.navigateTo({ url: `/pkg-shop/pay/index?orderNo=${item.orderNo}&amount=${amount}` })
  }, [])

  const sharedT = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const mapped = ORDER_TEXT[key]
      return t(mapped ?? key, params)
    },
    [t],
  )

  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    // G-933 冷启动门控:GET /orders/me(orderRoutes 组级 checkAuth)需鉴权
    return gate.waitUntilReady(() => {
      void load('refresh')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  usePullDownRefresh(() => {
    void load('refresh').then(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    void load('more')
  })

  return (
    <ThemeRoot>
      <OrderScreen
        t={sharedT}
        items={items}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        onRefresh={onRefresh}
        onLoadMore={onLoadMore}
        onPressItem={onPressItem}
        onPay={onPay}
        onBack={() => Taro.navigateBack()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
