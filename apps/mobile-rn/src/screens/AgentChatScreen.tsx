import { useEffect, useRef, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }

type Route = RouteProp<RootStackParamList, 'AgentChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { agentId, name } = route.params
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMsg> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ChatMsg[]>(`/api/agents/${encodeURIComponent(agentId)}/messages`)
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('agentChat.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [agentId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<ChatMsg>(`/api/agents/${encodeURIComponent(agentId)}/messages`, {
      method: 'POST', body: JSON.stringify({ content: text }),
    })
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: text, createdAt: new Date().toISOString() }, res.data])
      setInput('')
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    } else if (!res.success) {
      setError(res.error || t('agentChat.sendFailed'))
    }
  }

  if (loading) return <View className="flex-1 items-center justify-center bg-card p-4"><Loading /><Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text></View>
  if (error && messages.length === 0) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
      <TouchableOpacity className="rounded-lg bg-primary px-4 py-2" onPress={() => navigation.goBack()}><Text className="text-sm text-primary-foreground">{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <View className="mb-2 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Text className="text-sm text-muted-foreground">{t('common.back')}</Text></TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-foreground" numberOfLines={1}>{name}</Text>
      </View>
      <FlatList
        ref={(r) => { listRef.current = r }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        ListEmptyComponent={<View className="items-center py-10"><Text className="text-[13px] text-muted-foreground">{t('agentChat.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View className={`mb-2 max-w-[85%] rounded-lg p-2.5 ${item.role === 'user' ? 'self-end bg-primary' : 'self-start bg-muted'}`}>
            <Text className={`text-sm ${item.role === 'user' ? 'text-primary-foreground' : 'text-foreground'}`}>{item.content}</Text>
          </View>
        )}
      />
      <View className="flex-row items-center gap-2 py-2">
        <Input className="flex-1" value={input} onChangeText={setInput} placeholder={t('agentChat.placeholder')} />
        <TouchableOpacity className={`rounded-lg bg-primary px-3.5 py-2 ${(!input.trim() || sending) ? 'opacity-50' : ''}`} onPress={onSend} disabled={!input.trim() || sending}>
          <Text className="text-sm font-semibold text-primary-foreground">{t('agentChat.send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
