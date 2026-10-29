// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

/**
 * 教育看板共享屏(2026-10-29 立)。
 * 契约照 web 现读(`apps/web/app/(main)/edu/dashboard/page.tsx`):单端点 `GET /api/edu/dashboard`,
 * 回 { studyHours, totalCourses, completedCourses, inProgressCourses, avgProgress, totalExams,
 *      passedExams, totalCerts, recentCourses[{id,title,cover?,progress,lastLearnAt?}] }。
 */
export interface EduRecentCourse {
  id: string
  title: string
  progress: number
  lastLearnAt: string
}

export interface EduDashboardData {
  studyHours: number
  totalCourses: number
  completedCourses: number
  inProgressCourses: number
  avgProgress: number
  totalExams: number
  passedExams: number
  totalCerts: number
  recentCourses: EduRecentCourse[]
}

export interface EduDashboardScreenProps {
  t: (key: string, vars?: Record<string, string | number>) => string
  data: EduDashboardData | null
  loading: boolean
  error: string
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export function EduDashboardScreen({
  t,
  data,
  loading,
  error,
  onRetry,
  onBack,
  colorScheme = 'light',
}: EduDashboardScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) return <ScreenSkeleton colorScheme={colorScheme} />
  if (error) return <ErrorState message={error} onRetry={onRetry} colorScheme={colorScheme} />

  const d = data
  const cards: Array<{ key: string; label: string; value: string }> = d
    ? [
        { key: 'studyHours', label: t('eduDashboard.studyHours'), value: String(d.studyHours) },
        {
          key: 'totalCourses',
          label: t('eduDashboard.totalCourses'),
          value: String(d.totalCourses),
        },
        {
          key: 'completedCourses',
          label: t('eduDashboard.completedCourses'),
          value: String(d.completedCourses),
        },
        {
          key: 'inProgressCourses',
          label: t('eduDashboard.inProgressCourses'),
          value: String(d.inProgressCourses),
        },
        {
          key: 'avgProgress',
          label: t('eduDashboard.avgProgress'),
          value: `${Math.round(d.avgProgress)}%`,
        },
        { key: 'totalExams', label: t('eduDashboard.totalExams'), value: String(d.totalExams) },
        { key: 'passedExams', label: t('eduDashboard.passedExams'), value: String(d.passedExams) },
        { key: 'totalCerts', label: t('eduDashboard.totalCerts'), value: String(d.totalCerts) },
      ]
    : []

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('eduDashboard.title')}</Text>
      </View>
      <FlatList
        data={d?.recentCourses ?? []}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <View style={styles.grid}>
            {cards.map((c) => (
              <View key={c.key} style={styles.card}>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {c.value}
                </Text>
                <Text style={styles.cardLabel}>{c.label}</Text>
              </View>
            ))}
            <Text style={styles.sectionTitle}>{t('eduDashboard.recentCourses')}</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title={t('eduDashboard.noCourses')} colorScheme={colorScheme} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowMeta}>
              {t('eduDashboard.progress')} {Math.round(item.progress)}%
              {item.lastLearnAt ? ` · ${item.lastLearnAt}` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    title: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    body: { padding: rnSpacing.md, gap: rnSpacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm, marginBottom: rnSpacing.sm },
    card: {
      flexBasis: '31%',
      flexGrow: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.sm,
      gap: 2,
    },
    cardValue: { fontSize: rnType.subtitle.size, fontWeight: '600', color: tk.text.primary },
    cardLabel: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    sectionTitle: {
      width: '100%',
      fontSize: rnType.subtitle.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    row: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.lg,
      padding: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    rowTitle: { fontSize: rnType.body.size, color: tk.text.primary },
    rowMeta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
