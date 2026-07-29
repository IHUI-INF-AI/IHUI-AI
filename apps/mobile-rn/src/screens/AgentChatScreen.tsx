import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentChatScreen as SharedAgentChatScreen, type AgentChatMessage } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AgentChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { agentId, name } = route.params
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AgentChatMessage[]>(
        `/api/agents/${encodeURIComponent(agentId)}/messages`,
      )
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('agentChat.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [agentId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<AgentChatMessage>(
      `/api/agents/${encodeURIComponent(agentId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      },
    )
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: text },
        res.data,
      ])
      setInput('')
    } else if (!res.success) {
      setError(res.error || t('agentChat.sendFailed'))
    }
  }

  return (
    <SharedAgentChatScreen
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
