import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PlanStatus, StudyPlanItem, StudyPlanScreenProps } from '../../types'

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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('studyPlan.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listBody}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>{t('studyPlan.empty')}</Text>
            </View>
          ) : (
            items.map((item) => {
              const clamped = Math.max(0, Math.min(100, item.progress))
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => onPressItem(item)}
                  activeOpacity={0.7}
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
                </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    cardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    cardTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    statusBadge: {
      fontSize: 10,
      fontWeight: '600',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
      overflow: 'hidden',
    },
    courseName: {
      marginTop: 2,
      fontSize: 12,
      color: tk.text.secondary,
    },
    progressBar: {
      height: 4,
      backgroundColor: tk.surface.muted,
      borderRadius: 2,
      marginTop: 10,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      backgroundColor: tk.success.DEFAULT,
      borderRadius: 2,
    },
    cardFoot: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    lessonsText: { fontSize: 11, color: tk.text.tertiary },
    progressText: { fontSize: 12, fontWeight: '500', color: tk.text.primary },
    deadlineText: { fontSize: 11, color: tk.text.tertiary },
  })
}
