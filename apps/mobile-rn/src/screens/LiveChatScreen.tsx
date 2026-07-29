import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { LiveChatScreen as SharedLiveChatScreen, type LiveChatMessage } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'LiveChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function LiveChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { liveId } = route.params
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<LiveChatMessage[]>(
        `/api/live/${encodeURIComponent(liveId)}/messages`,
      )
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('liveChat.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [liveId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<LiveChatMessage>(
      `/api/live/${encodeURIComponent(liveId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      },
    )
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data])
      setInput('')
    } else if (!res.success) {
      setError(res.error || t('liveChat.sendFailed'))
    }
  }

  return (
    <SharedLiveChatScreen
      t={t}
      messages={messages}
      loading={loading}
      error={error}
      input={input}
      sending={sending}
      onInputChange={setInput}
      onSend={onSend}
      onBack={() => navigation.goBack()}
    />
  )
}
