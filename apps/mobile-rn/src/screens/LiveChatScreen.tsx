import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface ChatMsg { id: string; userId: string; nickname: string; content: string; createdAt: string }

type Route = RouteProp<RootStackParamList, 'LiveChat'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PRIMARY = '#10B981'

export function LiveChatScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { liveId } = route.params
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
      const res = await fetchApi<ChatMsg[]>(`/api/live/${encodeURIComponent(liveId)}/messages`)
      if (cancelled) return
      if (res.success) setMessages(res.data ?? [])
      else setError(res.error || t('liveChat.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [liveId, t])

  const onSend = async () => {
    const text = input.trim()
    if (!text) return
    setSending(true)
    const res = await fetchApi<ChatMsg>(`/api/live/${encodeURIComponent(liveId)}/messages`, {
      method: 'POST', body: JSON.stringify({ content: text }),
    })
    setSending(false)
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data])
      setInput('')
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
    } else if (!res.success) {
      setError(res.error || t('liveChat.sendFailed'))
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
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('liveChat.title')}</Text>
      <FlatList
        ref={(r) => { listRef.current = r }}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('liveChat.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.msg}>
            <Text style={styles.user}>{item.nickname}</Text>
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.meta}>{item.createdAt}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder={t('liveChat.placeholder')} placeholderTextColor="#9ca3af" />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && styles.sendDisabled]} onPress={onSend} disabled={!input.trim() || sending}>
          <Text style={styles.sendText}>{t('liveChat.send')}</Text>
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
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  msg: { padding: 10, borderRadius: 8, backgroundColor: '#f9fafb', marginBottom: 8 },
  user: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  content: { marginTop: 4, fontSize: 14, color: '#111827' },
  meta: { marginTop: 4, fontSize: 10, color: '#9ca3af' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 14, color: '#111827' },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  sendDisabled: { backgroundColor: '#9ca3af' },
  sendText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
