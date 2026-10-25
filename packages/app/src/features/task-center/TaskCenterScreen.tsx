// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TaskCenterItem, TaskCenterScreenProps, TaskCenterTab } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

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
      <View style={styles.container}>
        <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
          <EmptyState title={t('taskCenter.empty')} colorScheme={colorScheme} />
        ) : (
          filtered.map((task) => {
            const progressPct =
              task.target > 0 ? Math.min(100, Math.round((task.progress / task.target) * 100)) : 0
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
                    <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
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
                    <Text style={styles.claimedBtnText}>{t('taskCenter.claimed')}</Text>
                  </View>
                ) : task.completed ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onClaim(task)}
                    disabled={claimingId === task.id}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.actionBtnText}>
                      {claimingId === task.id ? t('common.loading') : t('taskCenter.claim')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.goBtn]}
                    onPress={() => onAction(task)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text style={styles.actionBtnText}>{t('taskCenter.goToDo')}</Text>
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
    errorText: { fontSize: rnType.body.size, color: tk.danger.DEFAULT },
    header: { paddingHorizontal: 10, paddingBottom: rnSpacing.sm },
    title: { marginTop: rnSpacing.sm, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    subtitle: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.sm,
      gap: 6,
    },
    tab: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.cta },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light },
    errorBar: {
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    retryText: { fontSize: rnType.body.size, color: tk.text.primary },
    list: { padding: 14, paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: rnSpacing.md,
      backgroundColor: tk.surface.light,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    taskTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
      marginRight: rnSpacing.sm,
    },
    rewardBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.md,
      backgroundColor: tk.success.light,
    },
    rewardText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.success.DEFAULT,
    },
    taskDesc: { marginTop: rnSpacing.sm, fontSize: rnType.body.size, color: tk.text.secondary },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    progressBarBg: {
      flex: 1,
      height: 6,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.card,
    },
    progressBarFill: {
      height: 6,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.success.DEFAULT,
    },
    progressText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    actionBtn: {
      marginTop: 10,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goBtn: { backgroundColor: tk.surface.card },
    claimedBtn: { backgroundColor: tk.surface.card },
    actionBtnText: { fontSize: rnType.body.size, color: tk.surface.light },
    claimedBtnText: { fontSize: rnType.body.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
