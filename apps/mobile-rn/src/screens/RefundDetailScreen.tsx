import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { RefundDetailScreen as SharedRefundDetailScreen, type RefundDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'RefundDetail'>

export function RefundDetailScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<RefundDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<RefundDetailItem>(`/refund/${id}`)
      if (!res.success) throw new Error()
      setItem(res.data ?? null)
    } catch {
      setError(t('refundDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedRefundDetailScreen
      t={t}
      item={item}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
