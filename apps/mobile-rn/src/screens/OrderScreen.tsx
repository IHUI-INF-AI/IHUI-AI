import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getOrders, type OrderStatus } from '@ihui/api-client'
import { OrderScreen as SharedOrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 将前端 tab 映射为后端 OrderStatus 查询参数。
 * - 'all' → 不过滤(返回全部)
 * - 'shipped' → 后端无 'shipped' 状态,降级为 'paid'(已支付/待收货属于已支付生命周期)
 * - 其他 → 直接作为 OrderStatus 传递
 */
function tabToStatus(tab: OrderTab): OrderStatus | undefined {
  if (tab === 'all') return undefined
  if (tab === 'shipped') return 'paid'
  return tab as OrderStatus
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
          createdAt: o.createdAt,
        })),
      )
    } catch {
      setError(t('order.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, activeTab])

  useEffect(() => {
    void load()
  }, [load])

  const onSelectTab = (tab: OrderTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  const onPressItem = (item: OrderItem) => {
    navigation.navigate('OrderDetail', { id: item.id })
  }

  return (
    <SharedOrderScreen
      t={t}
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
