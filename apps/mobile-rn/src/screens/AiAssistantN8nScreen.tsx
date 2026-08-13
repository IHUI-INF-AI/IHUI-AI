/**
 * AiAssistantN8nScreen N8N 助手对话(mobile-rn 端,复杂页)
 *
 * 1:1 复刻历史 Uniapp pages/tools/ai_assistant_n8n.vue 的对话框架(简化版):
 * - NavBar「N8N 助手」+ 返回
 * - 消息列表:FlatList 渲染气泡(user 右 / assistant 左),复用 ChatScreen 气泡视觉(自实现简化版)
 * - 输入区:TextInput + 发送按钮(简化,不接 BottomActionBar 全套)
 * - n8n 工作流调用:agentId 路由参数作为 workflowId,调 executeN8nWorkflow(@ihui/api-client);
 *   无 agentId 或调用失败 → mock 响应 + Alert「n8n 工作流待接入」(chatWithN8n API 仓库暂无)
 * - 路由参数:{ agentId?: string }
 *
 * 拆子组件到同文件内 function(AGENTS.md §4):AiAssistantN8nScreen(主)+ MessageBubble。
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
import { executeN8nWorkflow } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Empty from '../components/common/Empty'
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
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<N8nRouteProp>()
  const agentId = route.params?.agentId
  const listRef = useRef<FlatList<N8nMessage> | null>(null)
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
    setMessages((prev) => [...prev, userMsg])
    setSending(true)
    scrollToEnd()

    let reply = ''
    if (agentId) {
      const res = await executeN8nWorkflow(agentId, { message: text })
      if (res.success && res.data) {
        reply = '已提交 n8n 工作流执行(执行ID:' + res.data.executionId + '),结果将通过通知推送。'
      } else {
        reply = 'n8n 工作流调用失败:' + (res.error || '请稍后重试')
        Alert.alert('n8n 工作流待接入', '工作流执行失败,已返回模拟结果')
      }
    } else {
      reply = 'n8n 工作流待接入。您的输入已记录:「' + text + '」,配置 agentId 后可对接真实工作流。'
      Alert.alert('n8n 工作流待接入', '未传入 agentId,当前为模拟响应')
    }

    const aiMsg: N8nMessage = { id: nextId(), role: 'assistant', content: reply }
    setMessages((prev) => [...prev, aiMsg])
    setSending(false)
    scrollToEnd()
  }

  const renderItem: ListRenderItem<N8nMessage> = ({ item }) => <MessageBubble message={item} />

  return (
    <View style={styles.root}>
      <NavBar title="N8N 助手" onBack={() => navigation.goBack()} />
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
            <Empty text={agentId ? '向 N8N 助手发送消息开始对话' : '未绑定工作流,发送消息将得到模拟响应'} />
          }
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="请输入您的问题"
            placeholderTextColor={tokens.text.tertiary}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={sending || input.trim().length === 0}
            style={({ pressed }) => [
              styles.sendBtn,
              sending || input.trim().length === 0 ? styles.sendBtnDisabled : null,
              pressed ? styles.pressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="发送"
          >
            {sending ? (
              <ActivityIndicator color={tokens.surface.light} size="small" />
            ) : (
              <Text style={styles.sendText}>发送</Text>
            )}
          </Pressable>
        </View>
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
  pressed: { opacity: 0.85 },
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
