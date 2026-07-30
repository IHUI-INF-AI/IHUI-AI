import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveById, subscribeLive, type Live } from '@ihui/api-client'
import {
  LiveDetailScreen as SharedLiveDetailScreen,
  type LiveDetailChatMessage,
  type LiveDetailItem,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import type { LiveStackParamList } from '../navigation/RootNavigator'
import { formatTimeOnly } from '../utils/date-utils'
import { getToken } from '../lib/token'
import { API_BASE_URL } from '../lib/config'
import {
  LiveChatClient,
  type ChatMessage,
  type ChatStatus,
} from '../lib/ws/chat-client'

type Route = RouteProp<LiveStackParamList, 'LiveDetail'>
type NavigationProp = NativeStackNavigationProp<LiveStackParamList>

/** 把后端 Live 映射为共享层 LiveDetailItem(平台无关字段) */
function mapLive(live: Live): LiveDetailItem {
  return {
    id: live.id,
    title: live.title,
    isLive: live.isLive,
    lecturerName: live.lecturerName ?? undefined,
    viewCount: live.viewCount,
    playUrl: live.playUrl,
    intro: live.intro,
  }
}

/** 把 ChatMessage 映射为共享层 LiveDetailChatMessage(createdAt 已格式化) */
function mapMessage(m: ChatMessage): LiveDetailChatMessage {
  return {
    id: m.id,
    nickname: m.nickname,
    content: m.content,
    createdAt: formatTimeOnly(m.createdAt),
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
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle')
  const [chatError, setChatError] = useState('')
  const clientRef = useRef<LiveChatClient | null>(null)

  // 加载直播详情
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
        setError(res.error || t('liveDetail.loadFailed'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  // 建立聊天 WebSocket 连接
  useEffect(() => {
    if (loading) return
    const client = new LiveChatClient({
      baseUrl: API_BASE_URL,
      tokenProvider: () => getToken(),
    })
    clientRef.current = client
    const unsub = client.subscribe({
      onStatusChange: setChatStatus,
      onMessage: (msg) => {
        setMessages((prev) => [...prev, msg])
      },
      onHistory: (history) => {
        setMessages(history)
      },
      onError: (err) => setChatError(err),
    })
    client.connect(id)
    return () => {
      unsub()
      client.disconnect()
      clientRef.current = null
    }
  }, [id, loading])

  const onSubscribe = useCallback(async () => {
    if (!live) return
    setSubscribing(true)
    const res = await subscribeLive(live.id)
    setSubscribing(false)
    if (res.success) {
      setSubscribed(true)
    } else {
      setError(res.error || t('common.failed'))
    }
  }, [live, t])

  const onSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    const client = clientRef.current
    if (!client) return
    const ok = client.send(text)
    if (ok) {
      // 服务端会把消息回推;本地不直接 append,避免重复
      setInput('')
    } else {
      setChatError(t('liveDetail.chatNotReady'))
    }
  }, [input, t])

  const sharedLive = useMemo(() => (live ? mapLive(live) : null), [live])
  const sharedMessages = useMemo(() => messages.map(mapMessage), [messages])

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={live?.title ?? t('liveDetail.title')}
        onBack={() => navigation.goBack()}
      />
      <SharedLiveDetailScreen
        t={t}
        live={sharedLive}
        loading={loading}
        error={error}
        subscribed={subscribed}
        subscribing={subscribing}
        messages={sharedMessages}
        input={input}
        chatStatus={chatStatus}
        chatError={chatError}
        onInputChange={setInput}
        onSend={onSend}
        onSubscribe={onSubscribe}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}
