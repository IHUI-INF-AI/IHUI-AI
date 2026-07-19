import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'AgentReviewDetail'>
interface Detail { id: string; agentName: string; author: string; rating: number; content: string; createdAt: string }

export function AgentReviewDetailScreen() {
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
      const r = await fetch(`${API_BASE_URL}/api/agent-reviews/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Detail }
      setItem(d.data ?? null)
    } catch { setError(t('agentReviewDetail.loadFailed')) } finally { setLoading(false) }
  }, [id, token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('agentReviewDetail.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('agentReviewDetail.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.agent}>{item.agentName}</Text>
        <View style={s.metaRow}>
          <Text style={s.author}>{t('agentReviewDetail.author')}: {item.author}</Text>
          <Text style={s.rating}>{'★'.repeat(Math.max(1, Math.min(5, item.rating || 0)))}</Text>
        </View>
        <Text style={s.content}>{item.content}</Text>
        <Text style={s.time}>{item.createdAt}</Text>
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
  agent: { fontSize: 16, fontWeight: '600', color: '#10B981' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  author: { fontSize: 12, color: '#6B7280' },
  rating: { fontSize: 12, color: '#F59E0B' },
  content: { marginTop: 12, fontSize: 14, color: '#374151', lineHeight: 22 },
  time: { marginTop: 12, fontSize: 11, color: '#9CA3AF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
