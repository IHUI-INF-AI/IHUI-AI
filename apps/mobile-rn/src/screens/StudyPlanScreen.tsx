import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface PlanItem { id: string; title: string; courseName: string; targetMinutes: number; completedMinutes: number; dueDate: string; status: 'pending' | 'inProgress' | 'completed' }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function StudyPlanScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<PlanItem[]>('/api/study/plans')
      if (cancelled) return
      if (res.success) setPlans(res.data ?? [])
      else setError(res.error || t('studyPlan.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('studyPlan.title')}</Text>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('studyPlan.empty')}</Text></View>}
        renderItem={({ item }) => {
          const pct = item.targetMinutes > 0 ? Math.min(100, Math.round((item.completedMinutes / item.targetMinutes) * 100)) : 0
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.status, item.status === 'completed' && styles.statusDone]}>{t(`studyPlan.${item.status}`)}</Text>
              </View>
              <Text style={styles.course}>{item.courseName}</Text>
              <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>
              <View style={styles.cardFoot}>
                <Text style={styles.meta}>{item.completedMinutes}/{item.targetMinutes}min · {pct}%</Text>
                <Text style={styles.meta}>{t('studyPlan.due')}:{item.dueDate}</Text>
              </View>
            </View>
          )
        }}
      />
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
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  status: { fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  statusDone: { color: PRIMARY, backgroundColor: '#ecfdf5' },
  course: { marginTop: 4, fontSize: 12, color: '#374151' },
  bar: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: PRIMARY },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  meta: { fontSize: 11, color: '#9ca3af' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
