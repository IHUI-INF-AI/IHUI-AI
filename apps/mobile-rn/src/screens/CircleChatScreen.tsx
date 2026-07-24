import { useEffect, useRef, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Input, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ChatMsg { id: string; userId: string; nickname: string; content: string; createdAt: string }

type Route = RouteProp<RootStackParamList, 'CircleChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CircleChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId, name } = route.params
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList<ChatMsg> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<ChatMsg[]>(`/api/circles/${encodeURIComponent(circleId)}/messages`)
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('circleChat.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [circleId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<ChatMsg>(`/api/circles/${encodeURIComponent(circleId)}/messages`, { method: 'POST', body: JSON.stringify({ content: text }) })
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data])
      setInput('')
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    } else if (!res.success) setError(res.error || t('circleChat.sendFailed'))
  }

  if (loading) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Loading />
      <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
    </View>
  )
  if (error && messages.length === 0) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
      <TouchableOpacity className="mt-3 rounded-md bg-primary px-4 py-2" onPress={() => navigation.goBack()}>
        <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
    </View>
  )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <View className="mb-2 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-foreground" numberOfLines={1}>{name}</Text>
      </View>
      <FlatList
        ref={(r) => { listRef.current = r }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-[13px] text-muted-foreground">{t('circleChat.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-2 rounded-md bg-muted p-2.5">
            <Text className="text-xs font-semibold text-primary">{item.nickname}</Text>
            <Text className="mt-1 text-sm text-foreground">{item.content}</Text>
            <Text className="mt-1 text-[10px] text-muted-foreground">{item.createdAt}</Text>
          </View>
        )}
      />
      <View className="flex-row items-center gap-2 py-2">
        <Input
          className="flex-1"
          value={input}
          onChangeText={setInput}
          placeholder={t('circleChat.placeholder')}
        />
        <TouchableOpacity
          className={`rounded-md px-3.5 py-2 ${!input.trim() || sending ? 'bg-muted-foreground' : 'bg-primary'}`}
          onPress={onSend}
          disabled={!input.trim() || sending}
        >
          <Text className="text-sm font-semibold text-primary-foreground">{t('circleChat.send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
