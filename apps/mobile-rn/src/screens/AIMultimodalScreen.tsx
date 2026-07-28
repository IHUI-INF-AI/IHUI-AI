import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiModels, sendAiChat } from '@ihui/api-client'
import type { ChatMessage as AiChatMessage } from '@ihui/types'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type Mode = 'text' | 'image' | 'audio'

// 接入 @ihui/types 跨端契约:role + content 继承自 AiChatMessage,
// 本地仅保留 UI 扩展字段(id / createdAt)。
interface ChatMessage extends AiChatMessage {
  id: string
  createdAt: number
}

export function AIMultimodalScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<Mode>('text')
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 从 @ihui/api-client 加载真实模型列表,替换原硬编码 MODELS。
  // 加载失败静默处理:models 维持空数组,UI 显示"暂无可用模型"提示。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getAiModels({ page: 1, pageSize: 100 })
      if (cancelled) return
      if (res.success) {
        const names = res.data.list
          .map((m) => m.name)
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
        setModels(names)
        setModel((prev) => prev || names[0] || '')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')
    const res = await sendAiChat({ message: text, model })
    setLoading(false)
    if (res.success) {
      const data = res.data as { content?: string; message?: string; reply?: string }
      const reply = data?.content ?? data?.message ?? data?.reply ?? JSON.stringify(data)
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: 'assistant', content: reply, createdAt: Date.now() },
      ])
    } else {
      setError(res.error || t('aiMultimodal.error'))
    }
  }

  const handleClear = () => {
    setMessages([])
    setError('')
  }

  const modeKeys: Mode[] = ['text', 'image', 'audio']
  const modeLabelKey = (m: Mode) =>
    m === 'text'
      ? 'aiMultimodal.textMode'
      : m === 'image'
        ? 'aiMultimodal.imageMode'
        : 'aiMultimodal.audioMode'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('aiMultimodal.title')}</Text>
        <Text style={styles.subtitle}>{t('aiMultimodal.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      <View style={styles.modeRow}>
        {modeKeys.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {t(modeLabelKey(m))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.modelRow}>
        <Text style={styles.modelLabel}>{t('aiMultimodal.switchModel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {models.length === 0 ? (
            <Text style={styles.modelEmpty}>暂无可用模型</Text>
          ) : (
            models.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modelChip, model === m && styles.modelChipActive]}
                onPress={() => setModel(m)}
              >
                <Text style={[styles.modelChipText, model === m && styles.modelChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('aiMultimodal.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[styles.msgBubble, item.role === 'user' ? styles.msgUser : styles.msgAssistant]}
          >
            <Text style={styles.msgRole}>
              {item.role === 'user' ? (user?.nickname ?? 'me') : 'AI'}
            </Text>
            <Text style={styles.msgContent}>{item.content}</Text>
          </View>
        )}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('aiMultimodal.inputPlaceholder')}
          placeholderTextColor={tokens.text.tertiary}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={tokens.surface.light} size="small" />
          ) : (
            <Text style={styles.sendText}>{t('aiMultimodal.send')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>{t('aiMultimodal.clear')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  subtitle: { marginTop: 4, fontSize: 13, color: tokens.text.secondary },
  userText: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.surface.card },
  modeBtnActive: { backgroundColor: tokens.success.DEFAULT },
  modeBtnText: { textAlign: 'center', fontSize: 13, color: tokens.text.medium },
  modeBtnTextActive: { color: tokens.surface.light, fontWeight: '600' },
  modelRow: { paddingHorizontal: 16, paddingBottom: 8 },
  modelLabel: { fontSize: 12, color: tokens.text.secondary, marginBottom: 4 },
  modelEmpty: { fontSize: 12, color: tokens.text.tertiary, paddingVertical: 6 },
  modelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    marginRight: 8,
  },
  modelChipActive: { backgroundColor: tokens.success.DEFAULT },
  modelChipText: { fontSize: 12, color: tokens.text.medium },
  modelChipTextActive: { color: tokens.surface.light },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tokens.text.tertiary },
  msgBubble: { padding: 10, borderRadius: 8, marginBottom: 8, maxWidth: '85%' },
  msgUser: { backgroundColor: tokens.success.lighter, alignSelf: 'flex-end' },
  msgAssistant: { backgroundColor: tokens.surface.card, alignSelf: 'flex-start' },
  msgRole: { fontSize: 11, color: tokens.text.secondary, marginBottom: 2 },
  msgContent: { fontSize: 14, color: tokens.text.primary },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: tokens.danger.DEFAULT },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderTopColor: tokens.border.light,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border.light,
    fontSize: 14,
    color: tokens.text.primary,
    textAlignVertical: 'top',
  },
  sendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  sendBtnDisabled: { backgroundColor: tokens.text.tertiary },
  sendText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  clearText: { color: tokens.text.medium, fontSize: 13 },
})
