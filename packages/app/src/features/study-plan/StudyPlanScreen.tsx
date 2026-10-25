// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'

import { useMemo } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PlanStatus, StudyPlanItem, StudyPlanScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, PressableCard, ScreenSkeleton } from '../../components/ScreenStates'

/** 学习计划/Props 类型 re-export(单一来源 @ihui/types) */
export type { PlanStatus, StudyPlanItem, StudyPlanScreenProps }

/**
 * 学习计划列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:只负责渲染计划卡片 UI + 下拉刷新 + 进度条 + 状态徽章。
 * 平台特定(导航/API 调用)由 wrapper 通过 props 注入。
 */
export function StudyPlanScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: StudyPlanScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const statusBadgeStyle = (status: PlanStatus) => {
    switch (status) {
      case 'active':
        return { color: tk.success.DEFAULT, backgroundColor: tk.success.light }
      case 'paused':
        return { color: tk.warning.amberText, backgroundColor: tk.warning.amberLight }
      case 'completed':
        return { color: tk.success.deepText, backgroundColor: tk.success.lighter }
      case 'overdue':
        return { color: tk.danger.DEFAULT, backgroundColor: tk.danger.light }
      default:
        return { color: tk.text.secondary, backgroundColor: tk.surface.muted }
    }
  }

  const statusLabel = (status: PlanStatus) => {
    switch (status) {
      case 'active':
        return t('studyPlan.status.active')
      case 'paused':
        return t('studyPlan.status.paused')
      case 'completed':
        return `${t('studyPlan.status.completed')} ✓`
      case 'overdue':
        return t('studyPlan.status.overdue')
      default:
        return String(status)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('studyPlan.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <EmptyState title={t('studyPlan.empty')} colorScheme={colorScheme} />
          ) : (
            items.map((item) => {
              const clamped = clampPercent(item.progress)
              return (
                <PressableCard
                  key={item.id}
                  style={styles.card}
                  onPress={() => onPressItem(item)}
                  colorScheme={colorScheme}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                  <Text style={styles.courseName} numberOfLines={1}>
                    {item.courseName}
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${clamped}%` }]} />
                  </View>
                  <View style={styles.cardFoot}>
                    <Text style={styles.lessonsText}>
                      {t('studyPlan.lessons')}: {item.completedLessons}/{item.totalLessons}
                    </Text>
                    <Text style={styles.progressText}>
                      {t('studyPlan.progress')}: {item.progress}%
                    </Text>
                    <Text style={styles.deadlineText}>
                      {t('studyPlan.deadline')}: {item.deadline}
                    </Text>
                  </View>
                </PressableCard>
              )
            })
          )}
        </ScrollView>
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
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 10, fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    listBody: { padding: 14 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: rnSpacing.sm,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: rnSpacing.sm,
    },
    cardTitle: {
      flex: 1,
      fontSize: rnType.subtitle.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    statusBadge: {
      fontSize: 10,
      fontWeight: '600',
      paddingHorizontal: 6,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      marginLeft: rnSpacing.sm,
      overflow: 'hidden',
    },
    courseName: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    progressBar: {
      height: 6,
      backgroundColor: tk.surface.muted,
      borderRadius: rnRadius.xl,
      marginTop: 10,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      backgroundColor: tk.success.DEFAULT,
      borderRadius: rnRadius.xl,
    },
    cardFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    lessonsText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    progressText: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    deadlineText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
