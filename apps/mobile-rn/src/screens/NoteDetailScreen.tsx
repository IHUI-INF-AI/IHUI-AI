import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Note { id: string; title: string; content: string; tags: string[]; views: number; likes: number; author: string; createdAt: string }

type Route = RouteProp<RootStackParamList, 'NoteDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function NoteDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Note>(`/api/notes/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setNote(res.data)
      else setError(res.error || t('noteDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !note) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('noteDetail.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{note.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{note.author}</Text>
        <Text style={styles.meta}>{t('noteDetail.views', { count: note.views })} · {note.createdAt}</Text>
      </View>
      {note.tags.length > 0 ? (
        <View style={styles.tagRow}>{note.tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View>
      ) : null}
      <Text style={styles.content}>{note.content}</Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>❤ {note.likes}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  author: { fontSize: 13, color: PRIMARY, fontWeight: '500' },
  meta: { fontSize: 11, color: '#9ca3af' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { fontSize: 11, color: PRIMARY, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  content: { fontSize: 14, lineHeight: 22, color: '#374151' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  stat: { fontSize: 12, color: '#374151', backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
