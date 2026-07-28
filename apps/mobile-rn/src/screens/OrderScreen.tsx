import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, type Order } from '@ihui/api-client'
import { OrderScreen as SharedOrderScreen, type OrderItem, type OrderTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

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
      const res = await fetchApi<Order[]>(`/api/orders?status=${activeTab}`)
      if (!res.success) throw new Error()
      setItems(
        (res.data ?? []).map((o) => ({
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
