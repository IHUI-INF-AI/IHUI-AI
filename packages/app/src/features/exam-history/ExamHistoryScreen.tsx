// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ExamHistoryItem, ExamHistoryScreenProps } from '../../types'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

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
      <View style={styles.container}>
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      </View>
    )
  }
  if (error && items.length === 0) {
    return (
      <View style={styles.container}>
        {/* 错误态仍保留返回入口(原错误分支的返回钮语义不变) */}
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{t('examHistory.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState title={t('examHistory.empty')} colorScheme={colorScheme} />}
        renderItem={({ item }) => (
          <PressableCard
            onPress={() => onPressItem(item.id)}
            colorScheme={colorScheme}
            style={styles.card}
          >
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
          </PressableCard>
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
      paddingHorizontal: 10,
    },
    title: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
    },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: tk.text.primary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: rnRadius.md,
      marginLeft: 8,
    },
    badgePassed: { backgroundColor: tk.success.light },
    badgeFailed: { backgroundColor: tk.danger.light },
    badgePassedText: { fontSize: 11, color: tk.success.DEFAULT, fontWeight: '600' },
    badgeFailedText: { fontSize: 11, color: tk.danger.DEFAULT, fontWeight: '600' },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    score: { flexShrink: 0, fontSize: 18, fontWeight: '700', color: tk.brand.DEFAULT },
    metaTime: { fontSize: 11, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
