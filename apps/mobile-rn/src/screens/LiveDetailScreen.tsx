// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveById, subscribeLive, type Live } from '@ihui/api-client'
import {
  LiveDetailScreen as SharedLiveDetailScreen,
  type LiveDetailChatMessage,
  type LiveDetailItem,
} from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatTimeOnly } from '../utils/date-utils'
import { getToken } from '../lib/token'
import { API_BASE_URL } from '../lib/config'
import { LiveChatClient, type ChatMessage, type ChatStatus } from '../lib/ws/chat-client'
import { NavChrome } from '../components/NavChrome'

type Route = RouteProp<RootStackParamList, 'LiveDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LiveDetail'>

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
  const { resolvedTheme } = useTheme()
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
      <NavChrome>
        <NavBar title={live?.title ?? t('liveDetail.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      {/* 直播预告 / 主播端入口(孤儿路由修复:LivePreview/LiveHost 注册无入口,直播详情补挂) */}
      <View style={styles.entryRow}>
        {/* 动态按压态不得写成函数形态的 style:Pressable 被 cssInterop 注册过,函数声明会被展开成
            空对象而整份内联样式静默消失(守门 131 立项那一型)。外层只留纯布局档 flex 承接两个按钮
            的等分宽度,盒子的底色/圆角/内距下移到子 View 的数组形态上 —— 可见位置与尺寸一字不变。 */}
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('LivePreview', { id })}
          accessibilityRole="button"
          accessibilityLabel="直播预告"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>直播预告</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('LiveHost')}
          accessibilityRole="button"
          accessibilityLabel="主播端"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>主播端</Text>
            </View>
          )}
        </Pressable>
      </View>
      <SharedLiveDetailScreen
        t={t}
        colorScheme={resolvedTheme}
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
        onOpenChat={() => navigation.navigate('LiveChat', { liveId: id })}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  entryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  // 外层裸 Pressable 的命中层:只承接行内等分这一条纯布局档,不画任何底色/描边。
  entryBtnHit: {
    flex: 1,
  },
  entryBtn: {
    // 不得在这里写 flex: —— 等分宽度由外层 entryBtnHit 承担。
    // 整份样式原先挂在横向行里的 Pressable 上(flex 指宽度),搬到子 View 后同一份 flex 落在
    // 列方向上会把内容高度压成 0 ⇒ 按钮盒在、文字被裁掉(真机 VC53 实拍)。
    paddingVertical: 10,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brandAccent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBtnPressed: {
    opacity: 0.8,
  },
  entryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.brandAccent.foreground,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
