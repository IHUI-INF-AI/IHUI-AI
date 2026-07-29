import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { MessageDetailScreen as SharedMessageDetailScreen } from '@ihui/rn-app'
import type { MessageDetailData } from '@ihui/types'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'MessageDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function MessageDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [message, setMessage] = useState<MessageDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<MessageDetailData>(`/api/messages/${encodeURIComponent(id)}`)
      if (!res.success) {
        setError(res.error || t('messageDetail.loadFailed'))
      } else {
        setMessage(res.data ?? null)
      }
    } catch {
      setError(t('messageDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const handleReply = () => {
    if (!message) return
    navigation.navigate('MessageChat', { peerId: message.fromUser, name: message.fromUser })
  }

  return (
    <SharedMessageDetailScreen
      t={t}
      message={message}
      loading={loading}
      error={error}
      onReply={handleReply}
      onBack={() => navigation.goBack()}
    />
  )
}
