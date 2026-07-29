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
import type {
  TaskCenterItem,
  TaskCenterScreenProps,
  TaskCenterTab,
} from '../../types'

/** 任务中心共享屏 — props 注入式跨端组件 */
export type { TaskCenterItem, TaskCenterScreenProps, TaskCenterTab }

const TABS: TaskCenterTab[] = ['daily', 'weekly', 'newbie']

const TAB_KEYS: Record<TaskCenterTab, string> = {
  daily: 'taskCenter.tab_daily',
  weekly: 'taskCenter.tab_weekly',
  newbie: 'taskCenter.tab_newbie',
}

export function TaskCenterScreen({
  t,
  tasks,
  activeTab,
  loading,
  refreshing,
  error,
  claimingId,
  onTabChange,
  onRefresh,
  onRetry,
  onClaim,
  onAction,
  onBack,
  colorScheme = 'light',
}: TaskCenterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  const filtered = tasks.filter((task) => task.type === activeTab)

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('taskCenter.title')}</Text>
        <Text style={styles.subtitle}>{t('taskCenter.subtitle')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => onTabChange(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {t(TAB_KEYS[tab])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
            <Text style={styles.retryText}>{t('taskCenter.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('taskCenter.empty')}</Text>
          </View>
        ) : (
          filtered.map((task) => {
            const progressPct =
              task.target > 0
                ? Math.min(100, Math.round((task.progress / task.target) * 100))
                : 0
            return (
              <View key={task.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText}>+{task.reward}</Text>
                  </View>
                </View>
                <Text style={styles.taskDesc}>{task.description}</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, { width: `${progressPct}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {t('taskCenter.progress', {
                      current: task.progress,
                      target: task.target,
                    })}
                  </Text>
                </View>
                {task.claimed ? (
                  <View style={[styles.actionBtn, styles.claimedBtn]}>
                    <Text style={styles.claimedBtnText}>
                      {t('taskCenter.claimed')}
                    </Text>
                  </View>
                ) : task.completed ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onClaim(task)}
                    disabled={claimingId === task.id}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.actionBtnText}>
                      {claimingId === task.id
                        ? t('common.loading')
                        : t('taskCenter.claim')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.goBtn]}
                    onPress={() => onAction(task)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.actionBtnText}>
                      {t('taskCenter.goToDo')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 12, color: tk.text.tertiary, marginTop: 8 },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    backText: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 4, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: 4, fontSize: 13, color: tk.text.secondary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 6,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.success.DEFAULT },
    tabText: { fontSize: 12, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    retryText: { fontSize: 12, color: tk.success.DEFAULT },
    list: { padding: 16, paddingBottom: 32 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 10,
      backgroundColor: tk.surface.bg,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    taskTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: 8,
    },
    rewardBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: tk.success.light,
    },
    rewardText: {
      fontSize: 12,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    taskDesc: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    progressBarFill: {
      height: 6,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    progressText: { fontSize: 11, color: tk.text.tertiary },
    actionBtn: {
      marginTop: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
      alignItems: 'center',
    },
    goBtn: { backgroundColor: tk.surface.card },
    claimedBtn: { backgroundColor: tk.surface.card },
    actionBtnText: { fontSize: 13, color: tk.surface.light },
    claimedBtnText: { fontSize: 13, color: tk.text.tertiary },
  })
}
