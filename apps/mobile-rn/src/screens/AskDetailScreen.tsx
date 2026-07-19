import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Ask { id: string; title: string; content: string; author: string; answers: Answer[]; views: number; createdAt: string }
interface Answer { id: string; author: string; content: string; isAccepted: boolean; createdAt: string }

type Route = RouteProp<RootStackParamList, 'AskDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function AskDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [ask, setAsk] = useState<Ask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Ask>(`/api/asks/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setAsk(res.data)
      else setError(res.error || t('askDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !ask) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('askDetail.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{ask.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{ask.author}</Text>
        <Text style={styles.meta}>{t('askDetail.views', { count: ask.views })} · {ask.createdAt}</Text>
      </View>
      <Text style={styles.content}>{ask.content}</Text>
      <Text style={styles.sectionTitle}>{t('askDetail.answers', { count: ask.answers.length })}</Text>
      {ask.answers.length === 0 ? (
        <Text style={styles.muted}>{t('askDetail.empty')}</Text>
      ) : ask.answers.map((a) => (
        <View key={a.id} style={[styles.answer, a.isAccepted && styles.accepted]}>
          <View style={styles.answerHead}>
            <Text style={styles.author}>{a.author}</Text>
            {a.isAccepted ? <Text style={styles.acceptedTag}>✓ {t('askDetail.accepted')}</Text> : null}
          </View>
          <Text style={styles.answerContent}>{a.content}</Text>
          <Text style={styles.meta}>{a.createdAt}</Text>
        </View>
      ))}
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
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 },
  author: { fontSize: 13, color: PRIMARY, fontWeight: '500' },
  meta: { fontSize: 11, color: '#9ca3af' },
  content: { fontSize: 14, lineHeight: 22, color: '#374151', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  answer: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  accepted: { borderColor: PRIMARY, backgroundColor: '#ecfdf5' },
  answerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  acceptedTag: { fontSize: 11, color: PRIMARY, fontWeight: '600' },
  answerContent: { marginTop: 6, fontSize: 13, color: '#374151' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
