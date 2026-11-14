// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { Tappable } from '@ihui/ui-native'
import { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ActivityDetailItem, ActivityDetailScreenProps } from '../../types'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 活动详情共享屏 — props 注入式跨端组件 */
export type { ActivityDetailItem, ActivityDetailScreenProps }

export function ActivityDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  onRetry,
  onJoin,
  onLeave,
  joining = false,
  colorScheme = 'light',
}: ActivityDetailScreenProps & { onRetry?: () => void }) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('activityDetail.title')}</Text>
        </View>
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (error || !item) {
    // BUG-NEW-01:错误/空态也必须保留页头返回入口(2b43c08fe1 曾把页头整段换掉)。
    // 重试与返回是两个独立 affordance:返回恒由页头 BackChevron 承担,重试只在调用方注入 onRetry 时出现。
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('activityDetail.title')}</Text>
        </View>
        <ErrorState
          message={error || t('activities.notFound')}
          onRetry={onRetry}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('activityDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('activityDetail.startAt')}</Text>
          <Text style={styles.metaValue}>{item.startAt}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>{t('activityDetail.endAt')}</Text>
          <Text style={styles.metaValue}>{item.endAt}</Text>
        </View>
        {item.location ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('activityDetail.location')}</Text>
            <Text style={styles.metaValue}>{item.location}</Text>
          </View>
        ) : null}
        <Text style={styles.content}>{item.content}</Text>
        {/*
          后端 POST|DELETE /activities/:id/join 与详情里的 joined 字段早已就绪
          (promotions.ts 注释写明"前端据此决定显示报名还是取消报名"),
          但本屏此前整段是只读的:用户在列表点「立即参与」进到这里,再没有任何入口能报名。
        */}
        {onJoin || onLeave ? (
          <Tappable
            style={[styles.actionBtn, joining && styles.actionBtnBusy]}
            pressedStyle={styles.actionBtnPressed}
            disabled={joining}
            onPress={() => {
              if (item.joined) onLeave?.()
              else onJoin?.()
            }}
          >
            <Text style={styles.actionText}>
              {joining
                ? t('activity.joining')
                : item.joined
                  ? t('activities.cancelJoin')
                  : t('activities.join')}
            </Text>
          </Tappable>
        ) : null}
      </View>
    </ScrollView>
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
    title: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    body: { padding: rnSpacing['md-loose'] },
    itemTitle: { fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: rnSpacing.sm,
    },
    metaLabel: { fontSize: rnType.body.size, color: tk.text.secondary },
    metaValue: { fontSize: rnType.body.size, fontWeight: '500', color: tk.text.primary },
    content: {
      marginTop: rnSpacing.md,
      fontSize: rnType.title.size,
      lineHeight: rnType.strong.lineHeight,
      color: tk.text.primary,
    },
    actionBtn: {
      marginTop: rnSpacing.xl,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.lg,
      alignItems: 'center',
      backgroundColor: tk.brand.DEFAULT,
    },
    actionBtnBusy: { opacity: 0.5 },
    actionBtnPressed: { opacity: 0.85 },
    actionText: { fontSize: rnType.title.size, fontWeight: '600', color: tk.surface.light },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
