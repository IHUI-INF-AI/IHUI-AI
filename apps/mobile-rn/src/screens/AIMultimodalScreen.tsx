import { useState } from 'react'
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
import { sendAiChat } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type Mode = 'text' | 'image' | 'audio'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

const MODELS = ['gpt-4o', 'claude-3.5-sonnet', 'gemini-1.5-pro']

export function AIMultimodalScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [mode, setMode] = useState<Mode>('text')
  const [model, setModel] = useState(MODELS[0])
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modelChip, model === m && styles.modelChipActive]}
              onPress={() => setModel(m)}
            >
              <Text style={[styles.modelChipText, model === m && styles.modelChipTextActive]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
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
            style={[
              styles.msgBubble,
              item.role === 'user' ? styles.msgUser : styles.msgAssistant,
            ]}
          >
            <Text style={styles.msgRole}>
              {item.role === 'user' ? user?.nickname ?? 'me' : 'AI'}
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
          placeholderTextColor="#9ca3af"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
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

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  userText: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },
  modeBtnActive: { backgroundColor: PRIMARY },
  modeBtnText: { textAlign: 'center', fontSize: 13, color: '#374151' },
  modeBtnTextActive: { color: '#fff', fontWeight: '600' },
  modelRow: { paddingHorizontal: 16, paddingBottom: 8 },
  modelLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  modelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  modelChipActive: { backgroundColor: PRIMARY },
  modelChipText: { fontSize: 12, color: '#374151' },
  modelChipTextActive: { color: '#fff' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  msgBubble: { padding: 10, borderRadius: 8, marginBottom: 8, maxWidth: '85%' },
  msgUser: { backgroundColor: '#d1fae5', alignSelf: 'flex-end' },
  msgAssistant: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start' },
  msgRole: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  msgContent: { fontSize: 14, color: '#111827' },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#dc2626' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderTopColor: '#e5e7eb',
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
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: PRIMARY },
  sendBtnDisabled: { backgroundColor: '#9ca3af' },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f3f4f6' },
  clearText: { color: '#374151', fontSize: 13 },
})
