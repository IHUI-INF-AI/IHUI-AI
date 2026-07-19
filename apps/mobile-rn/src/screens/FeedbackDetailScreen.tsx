import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'FeedbackDetail'>
interface Detail { id: string; type: string; content: string; status: string; reply: string; createdAt: string }

export function FeedbackDetailScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/feedback/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Detail }
      setItem(d.data ?? null)
    } catch { setError(t('feedbackDetail.loadFailed')) } finally { setLoading(false) }
  }, [id, token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('feedbackDetail.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('feedbackDetail.title')}</Text>
      </View>
      <View style={s.body}>
        <View style={s.metaRow}>
          <Text style={s.typeBadge}>{item.type}</Text>
          <Text style={s.statusBadge}>{item.status}</Text>
        </View>
        <Text style={s.sectionTitle}>{t('feedbackDetail.content')}</Text>
        <Text style={s.content}>{item.content}</Text>
        <Text style={s.time}>{item.createdAt}</Text>
        <Text style={s.sectionTitle}>{t('feedbackDetail.reply')}</Text>
        <Text style={[s.content, !item.reply && s.muted]}>{item.reply || t('common.empty')}</Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  body: { padding: 16 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBadge: { fontSize: 11, color: '#FFFFFF', backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  statusBadge: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  sectionTitle: { marginTop: 12, fontSize: 13, fontWeight: '600', color: '#6B7280' },
  content: { marginTop: 6, fontSize: 14, color: '#374151', lineHeight: 22 },
  time: { marginTop: 8, fontSize: 11, color: '#9CA3AF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { color: '#9CA3AF', fontStyle: 'italic' },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
