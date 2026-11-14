// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { StyleSheet, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  fetchAgentChatMessages,
  streamAgentChat,
  type AgentChatStreamHandle,
} from '@ihui/api-client'
import { AgentChatScreen as SharedAgentChatScreen, type AgentChatMessage } from '@ihui/rn-app'
import { VoiceInput } from '../components/VoiceInput'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type Route = RouteProp<RootStackParamList, 'AgentChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentChatScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { agentId, name } = route.params
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  /** undefined = 无流式气泡;'' = 已发流但首包未到(共享屏据此显示加载态);其余为增量全文 */
  const [pendingAssistantText, setPendingAssistantText] = useState<string | undefined>(undefined)
  const [streaming, setStreaming] = useState(false)
  /** 发送/流式失败文案:与 error 分居,有历史消息时也要显式可见(不许静默失败) */
  const [sendError, setSendError] = useState('')
  const activeStreamRef = useRef<AgentChatStreamHandle | null>(null)
  /** 流内已收到的全文:用户主动停止时把已到账的部分固化成一条本地消息 */
  const partialRef = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // 卸载即取消在飞流:api-client 的 guard 保证 abort 后不再触发任何回调
      activeStreamRef.current?.abort()
      activeStreamRef.current = null
    }
  }, [])

  // 历史走 B2 的 version=2 分页读(与流式回落路径同一读面);失败显式进入 error 空态
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const items = await fetchAgentChatMessages(agentId)
        if (!cancelled) setMessages(items)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error && err.message ? err.message : t('agentChat.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId, t])

  const onSend = () => {
    const text = input.trim()
    if (!text || sending) return
    const optimisticUser: AgentChatMessage = {
      id: `local_${Date.now()}_u`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, optimisticUser])
    setInput('')
    setSendError('')
    // 首包(delta)到达前保持 sending:发送禁用、流式气泡显示加载态
    setSending(true)
    setStreaming(true)
    setPendingAssistantText('')
    partialRef.current = ''

    const handle = streamAgentChat(
      { agentId, content: text },
      {
        onDelta: (_delta, accumulated) => {
          if (!mountedRef.current) return
          partialRef.current = accumulated
          setPendingAssistantText(accumulated)
        },
      },
    )
    activeStreamRef.current = handle

    void handle.completion.then(
      (outcome) => {
        if (!mountedRef.current) return
        activeStreamRef.current = null
        partialRef.current = ''
        setSending(false)
        setStreaming(false)
        setPendingAssistantText(undefined)
        // done:用最终落库结果替换本地消息;落库页读失败时用流内全文兜底成一条本地消息
        setMessages(
          (prev) =>
            outcome.messages ?? [
              ...prev,
              {
                id: outcome.messageId ?? `local_${Date.now()}_a`,
                role: 'assistant',
                content: outcome.content,
              },
            ],
        )
      },
      (err: unknown) => {
        if (!mountedRef.current) return
        activeStreamRef.current = null
        partialRef.current = ''
        setSending(false)
        setStreaming(false)
        setPendingAssistantText(undefined)
        // 用户主动停止不算失败:停流动作已由 onStopStreaming 收尾
        if (err instanceof Error && err.name === 'AbortError') return
        // 失败显式报错:撤回乐观消息、恢复输入,文案挂在发送区(有历史消息也可见)
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
        setInput((prev) => (prev ? prev : text))
        setSendError(err instanceof Error && err.message ? err.message : t('agentChat.sendFailed'))
      },
    )
  }

  /** 停止流式:保留已收到的部分内容为本地消息,不把它伪装成服务端落库结果 */
  const onStopStreaming = useCallback(() => {
    const handle = activeStreamRef.current
    if (!handle) return
    handle.abort()
    activeStreamRef.current = null
    const partial = partialRef.current
    partialRef.current = ''
    setSending(false)
    setStreaming(false)
    setPendingAssistantText(undefined)
    if (partial) {
      setMessages((prev) => [
        ...prev,
        { id: `local_${Date.now()}_a`, role: 'assistant', content: partial },
      ])
    }
  }, [])

  /** 语音识别文本填入输入框(对齐 Uniapp AgentDialoguePage 输入区麦克风入口;追加而非清空已有输入) */
  const onVoiceComplete = useCallback((text: string) => {
    if (!text) return
    setInput((prev) => (prev ? `${prev} ${text}` : text))
  }, [])

  // 共享屏 loading / 错误空态时无输入框,同步隐藏语音输入条
  const showVoiceRow = !loading && !(error && messages.length === 0)

  return (
    <View style={styles.container}>
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
        colorScheme={resolvedTheme}
        pendingAssistantText={pendingAssistantText}
        streaming={streaming}
        onStopStreaming={onStopStreaming}
        sendError={sendError}
      />
      {/* 语音输入条 — 长按说话,识别文本填入输入框(对齐 Uniapp AgentDialoguePage icon-mic) */}
      {showVoiceRow ? (
        <View style={styles.voiceRow}>
          <VoiceInput disabled={sending} onComplete={onVoiceComplete} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  voiceRow: { paddingHorizontal: rpx(32), paddingBottom: rpx(24) },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
