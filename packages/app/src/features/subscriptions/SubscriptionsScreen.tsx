// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
  Image,
  Pressable,
  Switch,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SubscriptionsItem, SubscriptionsScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ScreenSkeleton } from '../../components/ScreenStates'

/** 订阅列表共享屏 — props 注入式跨端组件 */
export type { SubscriptionsItem, SubscriptionsScreenProps }

/** 直播态 → 文案键(与 RN 端 live.ongoing/upcoming/ended 同一份 key) */
const LIVE_STATUS_LABEL: Record<'upcoming' | 'living' | 'ended', string> = {
  living: 'live.ongoing',
  upcoming: 'live.upcoming',
  ended: 'live.ended',
}

export function SubscriptionsScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onCancel,
  onBack,
  reminderEnabled,
  onToggleReminder,
  onPressItem,
  onGoDiscover,
  colorScheme = 'light',
}: SubscriptionsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  // 直播段只认 targetType === 'live'(通用订阅项不进入本段,也不受本段字段影响)
  const liveItems = items.filter((i) => i.targetType === 'live')

  const renderItem = (item: SubscriptionsItem) => {
    if (item.targetType === 'live') {
      const row = (
        <View style={styles.card}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.liveCover} />
          ) : null}
          <View style={styles.body}>
            <Text style={styles.targetId} numberOfLines={1}>
              {item.title ?? item.targetId}
            </Text>
            {item.anchor ? <Text style={styles.createdAt}>{item.anchor}</Text> : null}
            {item.startTime ? <Text style={styles.createdAt}>{item.startTime}</Text> : null}
            {item.status ? (
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'living'
                    ? styles.statusBadgeLiving
                    : item.status === 'upcoming'
                      ? styles.statusBadgeUpcoming
                      : styles.statusBadgeEnded,
                ]}
              >
                <Text style={styles.statusText}>{t(LIVE_STATUS_LABEL[item.status])}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(item)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.cancelBtnText}>
              {t('memberSubscriptionPage.cancelSubscription')}
            </Text>
          </TouchableOpacity>
        </View>
      )
      // 仅壳注入 onPressItem 时直播行可点(通用形态不被污染)
      return onPressItem ? (
        <Pressable onPress={() => onPressItem(item)} accessibilityRole="button">
          {row}
        </Pressable>
      ) : (
        row
      )
    }

    // 非直播项:保持既有通用订阅行形态(缩略 targetType / targetId / createdAt / 取消)
    return (
      <View style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbText}>{item.targetType}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.targetId} numberOfLines={1}>
            {item.targetId}
          </Text>
          <Text style={styles.createdAt}>{item.createdAt}</Text>
        </View>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onCancel(item)}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.cancelBtnText}>{t('memberSubscriptionPage.cancelSubscription')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {onBack ? (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('subscriptions.title')}</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {liveItems.length > 0 ? (
        <View style={styles.liveSection}>
          <View style={styles.liveCountRow}>
            <Text style={styles.liveCountText}>{t('live.subscribe.count')}</Text>
            <Text style={styles.liveCountNum}>{liveItems.length}</Text>
            <Text style={styles.liveCountText}>{t('live.subscribe.unit')}</Text>
          </View>
          {onToggleReminder ? (
            <View style={styles.reminderCard}>
              <View style={styles.reminderBody}>
                <Text style={styles.reminderTitle}>{t('live.subscribe.reminder')}</Text>
                <Text style={styles.reminderDesc}>{t('live.subscribe.reminderDesc')}</Text>
              </View>
              <Switch value={reminderEnabled ?? false} onValueChange={onToggleReminder} />
            </View>
          ) : null}
        </View>
      ) : null}

      <FlatList<SubscriptionsItem>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState
              title={t('subscriptions.empty')}
              actionLabel={onGoDiscover ? t('live.subscribe.discover') : undefined}
              onAction={onGoDiscover}
              colorScheme={colorScheme}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => renderItem(item)}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.xs,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.danger.DEFAULT,
    },
    listBody: { padding: rnSpacing['sm-loose'], paddingBottom: rnSpacing['3xl'] },
    separator: { height: 12 },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary },
    footer: { alignItems: 'center', paddingVertical: rnSpacing.lg },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    thumbText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tk.brand.DEFAULT,
    },
    body: { marginLeft: rnSpacing.md, flex: 1 },
    targetId: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    createdAt: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
    },
    cancelBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    cancelBtnText: {
      fontSize: rnType.body.size,
      color: tk.text.medium,
      fontWeight: '600',
    },
    // ── 直播订阅段(新增;既有样式键不动) ──
    liveSection: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingTop: rnSpacing.md,
      gap: rnSpacing.md,
    },
    liveCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: rnSpacing.sm },
    liveCountText: { fontSize: rnType.body.size, color: tk.text.primary },
    liveCountNum: {
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    reminderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    reminderBody: { flex: 1, gap: rnSpacing.xs },
    reminderTitle: { fontSize: rnType.body.size, color: tk.text.primary },
    reminderDesc: { fontSize: rnType.label.size, color: tk.text.secondary },
    liveCover: {
      width: 56,
      height: 56,
      marginRight: rnSpacing.md,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      marginTop: rnSpacing.sm,
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
    },
    statusBadgeLiving: { backgroundColor: tk.danger.light },
    statusBadgeUpcoming: { backgroundColor: tk.warning.light },
    statusBadgeEnded: { backgroundColor: tk.surface.muted },
    statusText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.text.medium },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
