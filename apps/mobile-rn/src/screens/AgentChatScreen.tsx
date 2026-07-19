import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ChatMsg { id: string; role: 'user' | 'assistant'; content: string; createdAt: string }

type Route = RouteProp<RootStackParamList, 'AgentChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

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

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error && messages.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
      </View>
      <FlatList
        ref={(r) => { listRef.current = r }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('agentChat.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View style={[styles.msg, item.role === 'user' ? styles.msgUser : styles.msgBot]}>
            <Text style={styles.content}>{item.content}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder={t('agentChat.placeholder')} placeholderTextColor="#9ca3af" />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]} onPress={onSend} disabled={!input.trim() || sending}>
          <Text style={styles.sendText}>{t('agentChat.send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: '#111827' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  msg: { padding: 10, borderRadius: 8, marginBottom: 8, maxWidth: '85%' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: PRIMARY },
  msgBot: { alignSelf: 'flex-start', backgroundColor: '#f3f4f6' },
  content: { fontSize: 14, color: '#111827' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  sendDisabled: { backgroundColor: '#9ca3af' },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
