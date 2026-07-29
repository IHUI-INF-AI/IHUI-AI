import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { MessageChatScreen as SharedMessageChatScreen, type MessageChatMessage } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'MessageChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function MessageChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { peerId, name } = route.params
  const [messages, setMessages] = useState<MessageChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<MessageChatMessage[]>(
        `/api/messages/chat/${encodeURIComponent(peerId)}`,
      )
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('messageChat.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [peerId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<MessageChatMessage>(
      `/api/messages/chat/${encodeURIComponent(peerId)}`,
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
      setError(res.error || t('messageChat.sendFailed'))
    }
  }

  return (
    <SharedMessageChatScreen
      t={t}
      title={name}
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
