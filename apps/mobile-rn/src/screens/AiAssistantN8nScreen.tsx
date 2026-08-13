/**
 * AiAssistantN8nScreen AI 助手对话(mobile-rn 端,流式版)
 *
 * 对齐历史 Uniapp pages/tools/ai_assistant_n8n.vue 的流式对话核心:
 * - NavBar「AI 助手」+ 返回(对齐 Uniapp page_title 动态标题,P2 改为 agent.name)
 * - 消息列表:FlatList 渲染气泡(user 右 / assistant 左)
 * - 输入区:TextInput + 发送/停止按钮
 * - 流式输出:复用 streamChat(@ihui/api-client)SSE 端点 + agentId 绑定 N8n 工作流;
 *   onDelta 累积实时更新最后一条 assistant 消息(对齐 Uniapp onMessage 累积 data.content)
 * - 无 agentId → 模拟响应 + Alert(对齐 Uniapp onLoad 无 agentId 不调 processN8nAgent)
 * - 路由参数:{ agentId?: string }
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { streamChat, formatSSEError } from '@ihui/api-client'
import { FALLBACK_MODELS } from '@ihui/shared'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type LocalParamList = RootStackParamList & {
  AiAssistantN8n: { agentId?: string }
}
type N8nRouteProp = RouteProp<LocalParamList, 'AiAssistantN8n'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>

interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function MessageBubble({ message }: { message: N8nMessage }): React.JSX.Element {
  const isUser = message.role === 'user'
  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAi]}>
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.bubbleUser : bubbleStyles.bubbleAi]}>
        <Text style={[bubbleStyles.text, isUser ? bubbleStyles.textUser : bubbleStyles.textAi]}>
          {message.content}
        </Text>
      </View>
    </View>
  )
}

export default function AiAssistantN8nScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<N8nRouteProp>()
  const agentId = route.params?.agentId
  const listRef = useRef<FlatList<N8nMessage> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = (): string => `n8n-${++idCounter.current}`

  const [messages, setMessages] = useState<N8nMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const scrollToEnd = (): void => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }

  const onSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    const userMsg: N8nMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: N8nMessage = { id: nextId(), role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setSending(true)
    scrollToEnd()

    // 无 agentId:模拟响应(对齐 Uniapp onLoad 无 agentId 不调 processN8nAgent)
    if (!agentId) {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: t('aiAssistantN8n.mockResponse') }
        }
        return next
      })
      setSending(false)
      Alert.alert(t('common.confirm'), t('aiAssistantN8n.mockResponse'))
      return
    }

    // 有 agentId:复用 streamChat SSE 流式(对齐 Uniapp connectSocket + onMessage 累积)
    const controller = new AbortController()
    abortRef.current = controller
    const defaultModel = FALLBACK_MODELS[0]?.value ?? 'stepfun/step-router-v1'

    await streamChat({
      model: defaultModel,
      messages: [{ role: 'user', content: text }],
      agentId,
      signal: controller.signal,
      onDelta: (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta }
          }
          return next
        })
        scrollToEnd()
      },
      onError: (err) => {
        const formatted = formatSSEError(new Error(err))
        setSending(false)
        abortRef.current = null
        // 空回复时填充错误提示
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && !last.content) {
            next[next.length - 1] = { ...last, content: t('aiAssistantN8n.callFailed') }
          }
          return next
        })
        Alert.alert(formatted.title, formatted.message)
      },
      onDone: () => {
        setSending(false)
        abortRef.current = null
      },
    })
  }

  const onStop = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
  }

  const renderItem: ListRenderItem<N8nMessage> = ({ item }) => <MessageBubble message={item} />

  return (
    <View style={styles.root}>
      <NavBar title={t('aiAssistantN8n.title')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Empty text={agentId ? t('aiAssistantN8n.empty') : t('aiAssistantN8n.emptyNoAgent')} />
          }
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('aiAssistantN8n.placeholder')}
            placeholderTextColor={tokens.text.tertiary}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          {sending ? (
            <Pressable
              onPress={onStop}
              style={({ pressed }) => [styles.stopBtn, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={t('chat.stop')}
            >
              <Text style={styles.stopText}>{t('chat.stop')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => void onSend()}
              disabled={input.trim().length === 0}
              style={({ pressed }) => [
                styles.sendBtn,
                input.trim().length === 0 ? styles.sendBtnDisabled : null,
                pressed ? styles.pressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('aiAssistantN8n.send')}
            >
              <Text style={styles.sendText}>{t('aiAssistantN8n.send')}</Text>
            </Pressable>
          )}
        </View>
        {sending ? (
          <View style={styles.streamingBar}>
            <ActivityIndicator color={tokens.brand.DEFAULT} size="small" />
            <Text style={styles.streamingText}>{t('aiAssistantN8n.streaming')}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: tokens.surface.card,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    fontSize: 14,
    color: tokens.text.primary,
    textAlignVertical: 'top',
  },
  sendBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
  stopBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: tokens.danger.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: { fontSize: 14, fontWeight: '600', color: tokens.surface.light },
  pressed: { opacity: 0.85 },
  streamingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: tokens.surface.card,
  },
  streamingText: { fontSize: 12, color: tokens.text.tertiary },
})

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bubbleUser: { backgroundColor: tokens.brand.DEFAULT },
  bubbleAi: { backgroundColor: tokens.surface.card },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: tokens.surface.light },
  textAi: { color: tokens.text.primary },
})
