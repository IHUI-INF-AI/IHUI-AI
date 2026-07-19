import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Circle { id: string; name: string; description: string; memberCount: number; postCount: number; isJoined: boolean; cover?: string }

type Route = RouteProp<RootStackParamList, 'CircleDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function CircleDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [circle, setCircle] = useState<Circle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Circle>(`/api/circles/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setCircle(res.data)
      else setError(res.error || t('circleDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  const onJoin = async () => {
    if (!circle) return
    setJoining(true)
    const res = await fetchApi<void>(`/api/circles/${encodeURIComponent(id)}/join`, { method: 'POST' })
    setJoining(false)
    if (res.success) setCircle({ ...circle, isJoined: true, memberCount: circle.memberCount + 1 })
    else setError(res.error || t('common.failed'))
  }

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !circle) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('circleDetail.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{circle.name}</Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>{t('circleDetail.members', { count: circle.memberCount })}</Text>
        <Text style={styles.stat}>{t('circleDetail.posts', { count: circle.postCount })}</Text>
      </View>
      <Text style={styles.desc}>{circle.description || '—'}</Text>
      <View style={styles.actionRow}>
        {circle.isJoined ? (
          <>
            <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('CircleChat', { circleId: circle.id, name: circle.name })}><Text style={styles.btnOutlineText}>{t('circleDetail.chat')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('PostCreate', { circleId: circle.id })}><Text style={styles.btnPrimaryText}>{t('circleDetail.post')}</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.btnPrimary} onPress={onJoin} disabled={joining}><Text style={styles.btnPrimaryText}>{joining ? t('common.loading') : t('circleDetail.join')}</Text></TouchableOpacity>
        )}
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
  statRow: { flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 12 },
  stat: { fontSize: 11, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  desc: { fontSize: 14, lineHeight: 22, color: '#374151' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  btnOutline: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: PRIMARY, alignItems: 'center' },
  btnOutlineText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  btnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
