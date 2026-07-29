import { useMemo } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamHistoryItem, ExamHistoryScreenProps } from '../../types'

/** ExamHistory 共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { ExamHistoryItem, ExamHistoryScreenProps }

export function ExamHistoryScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: ExamHistoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('examHistory.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('examHistory.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPressItem(item.id)}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.examTitle}
                </Text>
                <View style={[styles.badge, item.passed ? styles.badgePassed : styles.badgeFailed]}>
                  <Text style={item.passed ? styles.badgePassedText : styles.badgeFailedText}>
                    {item.passed ? t('examHistory.passed') : t('examHistory.failed')}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.score}>
                  {item.score}/{item.totalScore}
                </Text>
                <Text style={styles.metaTime}>{item.submittedAt}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 48,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
    back: { fontSize: 14, color: tk.text.medium },
    title: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    empty: { paddingVertical: 40, alignItems: 'center' },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    badgePassed: { backgroundColor: tk.success.light },
    badgeFailed: { backgroundColor: tk.danger.light },
    badgePassedText: { fontSize: 11, color: tk.success.DEFAULT, fontWeight: '600' },
    badgeFailedText: { fontSize: 11, color: tk.danger.DEFAULT, fontWeight: '600' },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    score: { fontSize: 13, fontWeight: '600', color: tk.brand.DEFAULT },
    metaTime: { fontSize: 11, color: tk.text.tertiary },
  })
}
