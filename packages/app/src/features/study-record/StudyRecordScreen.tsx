import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  StudyRecordItem,
  StudyRecordScreenProps,
  StudyRecordStats,
  StudyRecordStatus,
} from '@ihui/types'

/** 学习记录/Props 类型 re-export(单一来源 @ihui/types) */
export type { StudyRecordItem, StudyRecordScreenProps, StudyRecordStats, StudyRecordStatus }

/**
 * 学习记录共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 副标题 + userNickname)
 * + statsCard(6 个指标 2 行)+ 学习记录卡片列表(courseTitle/lessonTitle + statusBadge
 * + duration/progress + lastStudyAt)+ 下拉刷新 + loading/empty 态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function StudyRecordScreen({
  t,
  records,
  stats,
  userNickname,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: StudyRecordScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusLabel = (status: StudyRecordStatus) => {
    switch (status) {
      case 'completed':
        return t('studyRecord.statusCompleted')
      case 'paused':
        return t('studyRecord.statusPaused')
      case 'in_progress':
        return t('studyRecord.statusInProgress')
      default:
        return t('studyRecord.statusInProgress')
    }
  }

  const statusStyle = (status: StudyRecordStatus) => {
    switch (status) {
      case 'completed':
        return styles.statusCompleted
      case 'paused':
        return styles.statusPaused
      case 'in_progress':
        return styles.statusInProgress
      default:
        return styles.statusInProgress
    }
  }

  const renderStats = (s: StudyRecordStats) => (
    <View style={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.totalDuration}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.totalDuration')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.totalCourses}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.totalCourses')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.completedCourses}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.completedCourses')}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.totalLessons}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.totalLessons')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.completedLessons}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.completedLessons')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{s.continuousDays}</Text>
          <Text style={styles.statLabel}>{t('studyRecord.continuousDays')}</Text>
        </View>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{t('studyRecord.title')}</Text>
          <Text style={styles.subtitle}>{t('studyRecord.subtitle', { name: userNickname })}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<StudyRecordItem>
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={stats ? renderStats(stats) : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('studyRecord.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const title = item.courseTitle || item.lessonTitle || t('studyRecord.untitled')
            return (
              <View style={styles.card}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <View style={[styles.statusBadge, statusStyle(item.status)]}>
                    <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.cardMeta}>
                    {item.duration !== null
                      ? `${t('studyRecord.duration')}: ${item.duration}`
                      : item.progress !== null
                        ? `${t('studyRecord.progress')}: ${item.progress}%`
                        : ''}
                  </Text>
                  <Text style={styles.cardTime}>{item.lastStudyAt}</Text>
                </View>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    titleBox: { flex: 1 },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 14, paddingBottom: 32 },
    separator: { height: 8 },
    statsCard: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    statLabel: { marginTop: 8, fontSize: 11, color: tk.text.secondary, textAlign: 'center' },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
      marginRight: 8,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    statusCompleted: { backgroundColor: tk.success.light },
    statusPaused: { backgroundColor: tk.surface.card },
    statusInProgress: { backgroundColor: tk.warning.light },
    statusText: { fontSize: 10, fontWeight: '600' },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    cardMeta: { fontSize: 11, color: tk.text.secondary },
    cardTime: { fontSize: 11, color: tk.text.tertiary },
  })
}
