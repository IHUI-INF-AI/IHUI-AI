import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { getLiveById, subscribeLive, type Live } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { LiveStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<LiveStackParamList, 'LiveDetail'>
type NavigationProp = NativeStackNavigationProp<LiveStackParamList>

interface ChatMessage {
  id: string
  nickname: string
  content: string
  createdAt: string
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

export function LiveDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [live, setLive] = useState<Live | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList<ChatMessage> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getLiveById(id)
      if (cancelled) return
      if (res.success) {
        setLive(res.data)
      } else {
        setError(res.error || t('live.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  const onSubscribe = async () => {
    if (!live) return
    setSubscribing(true)
    const res = await subscribeLive(live.id)
    setSubscribing(false)
    if (res.success) {
      setSubscribed(true)
    } else {
      setError(res.error || t('common.failed'))
    }
  }

  const onSend = () => {
    const text = input.trim()
    if (!text) return
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nickname: t('common.confirm') === '确认' ? '我' : 'me',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, msg])
    setInput('')
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    )
  }

  if (error || !live) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-red-600">{error || t('live.loadFailed')}</Text>
        <Button className="mt-4" onPress={() => navigation.goBack()}>
          {t('common.back')}
        </Button>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-black"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-base text-neutral-700 dark:text-neutral-300">
            {t('common.back')}
          </Text>
        </TouchableOpacity>
        <Text className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {live.title}
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-2">
          {live.isLive ? (
            <View className="rounded-md bg-red-500 px-2 py-0.5">
              <Text className="text-xs text-white">{t('live.ongoing')}</Text>
            </View>
          ) : (
            <View className="rounded-md bg-amber-500 px-2 py-0.5">
              <Text className="text-xs text-white">{t('live.upcoming')}</Text>
            </View>
          )}
          {live.lecturerName ? (
            <Text className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {t('live.lecturer')}:{live.lecturerName}
            </Text>
          ) : null}
          <Text className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
            {t('live.viewerCount', { count: live.viewCount })}
          </Text>
        </View>
      </View>

      <View className="aspect-video w-full items-center justify-center bg-black">
        <Text className="text-2xl text-white">▶</Text>
        <Text className="mt-1 text-xs text-neutral-400">{t('live.title')}</Text>
      </View>

      <View className="px-4 py-3">
        {subscribed ? (
          <View className="rounded-md bg-emerald-50 p-3">
            <Text className="text-sm text-emerald-700">✓ {t('live.subscribed')}</Text>
          </View>
        ) : (
          <Button loading={subscribing} onPress={onSubscribe}>
            {t('live.subscribe')}
          </Button>
        )}
      </View>

      <View className="px-4 pb-2">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('live.intro')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {live.intro ?? '—'}
        </Text>
      </View>

      <View className="flex-1 px-4 mt-2">
        <Text className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('live.chat')}
        </Text>
        <Card className="flex-1 p-2">
          <FlatList
            ref={(r) => {
              listRef.current = r
            }}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 4 }}
            ListEmptyComponent={
              <View className="items-center py-6">
                <Text className="text-xs text-neutral-500">{t('live.chatEmpty')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="mb-1 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {item.nickname}
                  </Text>
                  <Text className="text-[10px] text-neutral-400">{formatTime(item.createdAt)}</Text>
                </View>
                <Text className="mt-0.5 text-sm text-neutral-900 dark:text-neutral-50">
                  {item.content}
                </Text>
              </View>
            )}
          />
        </Card>
      </View>

      <View className="flex-row items-center gap-2 px-4 py-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('live.chatPlaceholder')}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50"
          placeholderTextColor="#9ca3af"
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Button size="sm" onPress={onSend} disabled={!input.trim()}>
          {t('live.chatSend')}
        </Button>
      </View>
    </KeyboardAvoidingView>
  )
}
