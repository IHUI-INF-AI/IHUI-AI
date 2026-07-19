import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'LivePreview'>
interface Detail { id: string; title: string; lecturer: string; startAt: string; intro: string; subscribed: boolean }

export function LivePreviewScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/live/preview/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Detail }
      setItem(d.data ?? null)
    } catch { setError(t('livePreview.loadFailed')) } finally { setLoading(false) }
  }, [id, token, t])

  useEffect(() => { void load() }, [load])

  const subscribe = async () => {
    if (!item) return
    setSubscribing(true)
    try {
      const r = await fetch(`${API_BASE_URL}/api/live/preview/${id}/subscribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!r.ok) throw new Error()
      setItem({ ...item, subscribed: true })
    } catch { setError(t('livePreview.loadFailed')) } finally { setSubscribing(false) }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator /><Text style={s.muted}>{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('livePreview.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('livePreview.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.liveTitle}>{item.title}</Text>
        <Text style={s.meta}>{t('livePreview.lecturer')}: {item.lecturer}</Text>
        <Text style={s.meta}>{t('livePreview.startAt')}: {item.startAt}</Text>
        <Text style={s.intro}>{item.intro}</Text>
        <TouchableOpacity
          style={[s.btn, (item.subscribed || subscribing) && s.btnDisabled]}
          onPress={subscribe}
          disabled={item.subscribed || subscribing}
        >
          <Text style={s.btnText}>{item.subscribed ? t('livePreview.subscribed') : t('livePreview.subscribe')}</Text>
        </TouchableOpacity>
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
  liveTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  meta: { marginTop: 6, fontSize: 13, color: '#6B7280' },
  intro: { marginTop: 12, fontSize: 14, color: '#374151', lineHeight: 22 },
  btn: { marginTop: 20, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  error: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
