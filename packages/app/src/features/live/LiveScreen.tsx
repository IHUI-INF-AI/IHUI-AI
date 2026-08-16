import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LiveScreenItem, LiveScreenProps } from '../../types'

/** 直播屏/Props 类型 re-export(单一来源 @ihui/types) */
export type { LiveScreenItem, LiveScreenProps }

type LiveStatusKey = 'live.ongoing' | 'live.upcoming' | 'live.ended'

function statusKey(item: LiveScreenItem): LiveStatusKey {
  if (item.isLive) return 'live.ongoing'
  if (new Date(item.startTime).getTime() > Date.now()) return 'live.upcoming'
  return 'live.ended'
}

function statusColor(key: LiveStatusKey, tk: AppThemeTokens): string {
  if (key === 'live.ongoing') return tk.danger.DEFAULT
  if (key === 'live.upcoming') return tk.warning.amber
  return tk.text.tertiary
}

/**
 * 直播屏共享组件 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 错误提示(可选)+ loading 态
 * + 直播卡片列表(标题 + 状态徽章 + 讲师 + 开始时间 + 观看人数,可点击)
 * + 下拉刷新 + 空态。状态判断:isLive→ongoing,startTime>now→upcoming,else→ended。
 * 平台特定(导航 / API 调用 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function LiveScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: LiveScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('live.title')}</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<LiveScreenItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('live.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const key = statusKey(item)
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onPressItem(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: statusColor(key, tk) }]}>
                    <Text style={styles.badgeText}>{t(key)}</Text>
                  </View>
                </View>
                {item.lecturerName ? (
                  <Text style={styles.lecturer}>
                    {t('live.lecturer')}: {item.lecturerName}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {t('live.startAt')}: {item.startTime}
                  </Text>
                  <Text style={styles.meta}>
                    {t('live.viewerCount', { count: item.viewCount })}
                  </Text>
                </View>
              </TouchableOpacity>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { flex: 1, fontSize: 20, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { paddingHorizontal: 10, paddingVertical: 16 },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 12, color: tk.surface.light },
    lecturer: { marginTop: 6, fontSize: 14, color: tk.text.medium },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    meta: { fontSize: 12, color: tk.text.tertiary },
  })
}
