import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { OrderDetailScreen as SharedOrderDetailScreen, type OrderDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'OrderDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function OrderDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [order, setOrder] = useState<OrderDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<OrderDetailItem>(`/api/orders/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setOrder(res.data)
      else setError(res.error || t('orderDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  return (
    <SharedOrderDetailScreen
      t={t}
      item={order}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
