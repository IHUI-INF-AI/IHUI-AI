// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { LiveScreenItem, LiveScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, PressableCard, ScreenSkeleton } from '../../components/ScreenStates'

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
  contentBottomPadding = 16,
}: LiveScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const showError: boolean = error !== '' && items.length === 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('live.title')}</Text>
      </View>

      {showError ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : (
        <FlatList<LiveScreenItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listBody, { paddingBottom: contentBottomPadding }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            showError ? null : <EmptyState title={t('live.empty')} colorScheme={colorScheme} />
          }
          renderItem={({ item }) => {
            const key = statusKey(item)
            return (
              <PressableCard
                style={[styles.card, { backgroundColor: 'transparent' }]}
                onPress={() => onPressItem(item.id)}
                colorScheme={colorScheme}
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
              </PressableCard>
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
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    errorText: {
      paddingHorizontal: rnSpacing.lg,
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    listBody: { paddingHorizontal: 10, paddingVertical: rnSpacing.lg },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    badge: { paddingHorizontal: 10, paddingVertical: rnSpacing.xs, borderRadius: rnRadius.md },
    badgeText: { fontSize: rnType.label.size, color: tk.surface.light },
    lecturer: { marginTop: 6, fontSize: rnType.body.size, color: tk.text.medium },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rnSpacing.sm,
    },
    meta: { fontSize: rnType.label.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
