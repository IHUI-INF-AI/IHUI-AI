// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { Tappable } from '@ihui/ui-native'

import { useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ActivityItem, ActivityScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
  return tk.text.secondary
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
  onItemPress,
  onJoin,
  joiningId,
  onRetry,
  colorScheme = 'light',
}: ActivityScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('activity.title')}</Text>
      </View>

      {error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : loading && items.length === 0 ? (
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : (
        <FlatList<ActivityItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              title={t('activity.empty')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
              colorScheme={colorScheme}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={onItemPress ? 0.85 : 1}
              onPress={onItemPress ? () => onItemPress(item) : undefined}
            >
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
              {typeof item.participants === 'number' ? (
                <Text style={styles.meta}>
                  {t('activity.participants')}: {item.participants}
                </Text>
              ) : null}
              {/*
                历史上这里是 `<TouchableOpacity style={styles.joinBtn}>` —— 没有 onPress。
                伤害不止"点不动":Pressability 的 onStartShouldSetResponder 返回 !disabled,
                所以这个内层 Touchable 一定抢走 responder,松手时自己无 onPress、外层卡片的
                跳转也收不到事件 ⇒ 整块「立即参与」是点击死区。现在有 onJoin 才是按钮,
                没有就退回静态 View(不占可点区域,点击照常落到卡片上)。
              */}
              {onJoin ? (
                <Tappable
                  style={[styles.joinBtn, joiningId === item.id && styles.joinBtnBusy]}
                  disabled={joiningId === item.id}
                  onPress={() => onJoin(item)}
                >
                  <Text style={styles.joinText}>
                    {joiningId === item.id
                      ? t('activity.joining')
                      : item.joined
                        ? t('activities.cancelJoin')
                        : t('activities.join')}
                  </Text>
                </Tappable>
              ) : (
                <View style={styles.joinBtn}>
                  <Text style={styles.joinText}>{t('activities.join')}</Text>
                </View>
              )}
            </TouchableOpacity>
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
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    errorText: {
      paddingHorizontal: rnSpacing['sm-loose'],
      fontSize: rnType.body.size,
      color: tk.danger.deepText,
    },
    center: { alignItems: 'center', paddingVertical: rnSpacing['5xl'] },
    muted: { fontSize: rnType.body.size, color: tk.text.secondary, marginTop: rnSpacing.sm },
    listBody: { padding: rnSpacing['md-loose'] },
    separator: { height: 12 },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { flex: 1, fontSize: rnType.title.size, fontWeight: '700', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: rnType.badge.size, color: tk.surface.light },
    cardDesc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.medium,
      lineHeight: rnType.bodySm.lineHeight,
    },
    meta: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.medium },
    joinBtn: {
      marginTop: rnSpacing.sm,
      paddingVertical: rnSpacing['xs-loose'],
      alignItems: 'flex-end',
    },
    joinBtnBusy: { opacity: 0.5 },
    joinText: { fontSize: rnType.body.size, color: tk.brand.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
