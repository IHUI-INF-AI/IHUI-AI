import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
interface Progress { totalCourses: number; completedCourses: number; totalMinutes: number; weekMinutes: number; streakDays: number; courses: Array<{ id: string; title: string; progress: number }> }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function StudyProgressScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Progress>('/api/study/progress')
      if (cancelled) return
      if (res.success) setProgress(res.data)
      else setError(res.error || t('studyProgress.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <View style={styles.center}><Loading /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error || !progress) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error || t('studyProgress.loadFailed')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('studyProgress.title')}</Text>
      <View style={styles.statGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{progress.completedCourses}/{progress.totalCourses}</Text><Text style={styles.statLabel}>{t('studyProgress.courses')}</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{progress.totalMinutes}</Text><Text style={styles.statLabel}>{t('studyProgress.totalMinutes')}</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{progress.weekMinutes}</Text><Text style={styles.statLabel}>{t('studyProgress.weekMinutes')}</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{progress.streakDays}</Text><Text style={styles.statLabel}>{t('studyProgress.streak')}</Text></View>
      </View>
      <Text style={styles.sectionTitle}>{t('studyProgress.courseProgress')}</Text>
      {progress.courses.length === 0 ? (
        <Text style={styles.muted}>{t('common.empty')}</Text>
      ) : progress.courses.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
          <View style={styles.bar}><View style={[styles.barFill, { width: `${c.progress}%` }]} /></View>
          <Text style={styles.meta}>{c.progress}%</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.surface.bg, padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary, marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '600', color: tokens.success.DEFAULT },
  statLabel: { marginTop: 4, fontSize: 11, color: tokens.text.secondary },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: tokens.text.primary, marginBottom: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: tokens.text.primary },
  bar: { height: 4, backgroundColor: tokens.surface.card, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: tokens.success.DEFAULT },
  meta: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: tokens.success.DEFAULT },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
