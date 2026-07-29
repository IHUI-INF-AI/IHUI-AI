import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { StudyProgressData, StudyProgressScreenProps } from '../../types'

/** 学习进度共享屏 — props 注入式跨端组件 */
export type { StudyProgressData, StudyProgressScreenProps }

export function StudyProgressScreen({
  t,
  progress,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: StudyProgressScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !progress) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('studyProgress.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('studyProgress.title')}</Text>
      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{progress.completedCourses}/{progress.totalCourses}</Text>
          <Text style={styles.statLabel}>{t('studyProgress.courses')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{progress.totalMinutes}</Text>
          <Text style={styles.statLabel}>{t('studyProgress.totalMinutes')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{progress.weekMinutes}</Text>
          <Text style={styles.statLabel}>{t('studyProgress.weekMinutes')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{progress.streakDays}</Text>
          <Text style={styles.statLabel}>{t('studyProgress.streak')}</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>{t('studyProgress.courseProgress')}</Text>
      {progress.courses.length === 0 ? (
        <Text style={styles.muted}>{t('common.empty')}</Text>
      ) : (
        progress.courses.map((c) => (
          <View key={c.id} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${c.progress}%` }]} />
            </View>
            <Text style={styles.meta}>{c.progress}%</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tk.surface.bg, padding: 16 },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary, marginBottom: 12 },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '600', color: tk.success.DEFAULT },
    statLabel: { marginTop: 4, fontSize: 11, color: tk.text.secondary },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light, marginBottom: 8 },
    cardTitle: { fontSize: 14, fontWeight: '500', color: tk.text.primary },
    bar: { height: 4, backgroundColor: tk.surface.card, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
    barFill: { height: 4, backgroundColor: tk.success.DEFAULT },
    meta: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: tk.success.DEFAULT },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
