import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  LivePreviewScreen as SharedLivePreviewScreen,
  type LivePreviewItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'LivePreview'>

export function LivePreviewScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<LivePreviewItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<LivePreviewItem>(`/live/${id}`)
      if (!res.success) throw new Error()
      setItem(res.data ?? null)
    } catch {
      setError(t('livePreview.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const subscribe = async () => {
    if (!item) return
    setSubscribing(true)
    try {
      const res = await fetchApi(`/live/preview/${id}/subscribe`, { method: 'POST' })
      if (!res.success) throw new Error()
      setItem({ ...item, subscribed: true })
    } catch {
      setError(t('livePreview.loadFailed'))
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <SharedLivePreviewScreen
      t={t}
      item={item}
      loading={loading}
      error={error}
      subscribing={subscribing}
      onSubscribe={subscribe}
      onBack={() => navigation.goBack()}
    />
  )
}
