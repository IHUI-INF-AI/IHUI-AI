import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AskDetailScreen as SharedAskDetailScreen, type AskDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AskDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AskDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [ask, setAsk] = useState<AskDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AskDetailItem>(`/api/asks/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setAsk(res.data)
      else setError(res.error || t('askDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedAskDetailScreen
      t={t}
      item={ask}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
