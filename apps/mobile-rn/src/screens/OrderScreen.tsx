import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOrders, type OrderStatus } from '@ihui/api-client'
import { OrderScreen as SharedOrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { formatDateByTemplate } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

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
  const [error, setError] = useState('')

  // t 包装:Uniapp 对齐文案优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const status = tabToStatus(activeTab)
      const res = await getOrders({ status, page: 1, pageSize: 20 })
      if (!res.success) throw new Error()
      setItems(
        (res.data?.list ?? []).map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          title: o.targetTitle,
          amount: o.payAmount,
          status: o.status,
          // Uniapp「下单时间:YYYY-MM-DD HH:mm」
          createdAt: formatOrderTime(o.createdAt),
        })),
      )
    } catch {
      setError(uniappT('order.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, uniappT])

  useEffect(() => {
    void load()
  }, [load])

  const onSelectTab = (tab: OrderTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

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
    />
  )
}
