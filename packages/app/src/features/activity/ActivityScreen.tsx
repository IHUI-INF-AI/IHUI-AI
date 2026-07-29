import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ActivityItem, ActivityScreenProps } from '../../types'

/** 活动屏/Props 类型 re-export(单一来源 @ihui/types) */
export type { ActivityItem, ActivityScreenProps }

const ACTIVITY_STATUS_KEYS: Record<ActivityItem['status'], string> = {
  upcoming: 'activity.status_upcoming',
  ongoing: 'activity.status_ongoing',
  ended: 'activity.status_ended',
}

function statusColor(status: ActivityItem['status'], tk: AppThemeTokens): string {
  if (status === 'ongoing') return tk.brand.DEFAULT
  if (status === 'upcoming') return tk.warning.amber
  return tk.text.tertiary
}

/**
 * 活动屏共享组件 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示(可选)+ loading 态
 * + 活动卡片列表(标题 + 状态徽章 + 描述[2行] + 开始/结束时间 + 参与人数 + 立即参与按钮)
 * + 下拉刷新 + 空态。状态色:ongoing→brand,upcoming→amber,ended→tertiary。
 * 平台特定(导航 / API 调用 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function ActivityScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: ActivityScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('activity.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<ActivityItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('activity.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status, tk) }]}>
                  <Text style={styles.badgeText}>{t(ACTIVITY_STATUS_KEYS[item.status])}</Text>
                </View>
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.meta}>
                {t('activity.startTime')}: {item.startTime}
              </Text>
              <Text style={styles.meta}>
                {t('activity.endTime')}: {item.endTime}
              </Text>
              <Text style={styles.meta}>
                {t('activity.participants')}: {item.participants}
              </Text>
              <TouchableOpacity style={styles.joinBtn}>
                <Text style={styles.joinText}>{t('activity.joinNow')}</Text>
              </TouchableOpacity>
            </View>
          )}
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 16 },
    separator: { height: 12 },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    badgeText: { fontSize: 10, color: tk.surface.light },
    cardDesc: { marginTop: 6, fontSize: 12, color: tk.text.medium, lineHeight: 18 },
    meta: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
    joinBtn: { marginTop: 8, paddingVertical: 6, alignItems: 'flex-end' },
    joinText: { fontSize: 12, color: tk.brand.DEFAULT },
  })
}
