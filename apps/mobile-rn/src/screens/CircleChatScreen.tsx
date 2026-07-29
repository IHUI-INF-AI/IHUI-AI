import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CircleChatScreen as SharedCircleChatScreen, type CircleChatMessage } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ApiChatMsg {
  id: string
  userId: string
  nickname: string
  content: string
  createdAt: string
}

type Route = RouteProp<RootStackParamList, 'CircleChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toChatMessage(m: ApiChatMsg): CircleChatMessage {
  return {
    id: m.id,
    role: 'other',
    author: m.nickname,
    content: m.content,
    createdAt: m.createdAt,
  }
}

export function CircleChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId, name } = route.params
  const [messages, setMessages] = useState<CircleChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<ApiChatMsg[]>(
        `/api/circles/${encodeURIComponent(circleId)}/messages`,
      )
      if (res.success) {
        setMessages((res.data ?? []).map(toChatMessage))
      } else {
        setError(res.error || t('circleChat.loadFailed'))
      }
    } catch {
      setError(t('circleChat.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [circleId, t])

  useEffect(() => {
    void load()
  }, [load])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<ApiChatMsg>(
      `/api/circles/${encodeURIComponent(circleId)}/messages`,
      { method: 'POST', body: JSON.stringify({ content: text }) },
    )
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [...prev, toChatMessage(res.data as ApiChatMsg)])
      setInput('')
    } else if (!res.success) {
      setError(res.error || t('circleChat.sendFailed'))
    }
  }

  return (
    <SharedCircleChatScreen
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
