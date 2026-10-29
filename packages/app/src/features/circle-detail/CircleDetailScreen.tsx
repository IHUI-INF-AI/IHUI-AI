// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CircleDetailItem, CircleDetailScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 圈子详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { CircleDetailItem, CircleDetailScreenProps }

/**
 * 圈子详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回)+ 标题 + 统计(成员数/帖子数)
 * + 描述 + 操作按钮(未加入:加入;已加入:成员/发帖/退出)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function CircleDetailScreen({
  t,
  item,
  loading,
  error,
  onJoin,
  onLeave,
  onPressPost,
  onPressMembers,
  onBack,
  colorScheme = 'light',
}: CircleDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
  }
  if (error || !item) {
    return (
      <ErrorState
        message={error || t('circleDetail.loadFailed')}
        onRetry={onBack}
        retryLabel={t('common.back')}
        colorScheme={colorScheme}
      />
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
      <Text style={styles.title}>{item.name}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>
            {t('circleDetail.members', { count: item.memberCount })}
          </Text>
        </View>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>{t('circleDetail.posts', { count: item.postCount })}</Text>
        </View>
      </View>
      <Text style={styles.description}>{item.description || '—'}</Text>
      <View style={styles.actions}>
        {item.isJoined ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={onPressMembers}
            >
              <Text style={styles.actionBtnSecondaryText}>{t('circleDetail.membersAction')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={onPressPost}
            >
              <Text style={styles.actionBtnPrimaryText}>{t('circleDetail.post')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={onLeave}>
              <Text style={styles.actionBtnOutlineText}>{t('circleDetail.leave')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={onJoin}>
            <Text style={styles.actionBtnPrimaryText}>{t('circleDetail.join')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
      paddingBottom: rnSpacing['3xl'],
    },
    title: {
      marginTop: rnSpacing.sm,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: rnSpacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginBottom: rnSpacing.md,
    },
    statBadge: {
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    statText: { fontSize: rnType.body.size, color: tk.text.secondary },
    description: {
      fontSize: rnType.title.size,
      lineHeight: 22,
      color: tk.text.primary,
    },
    actions: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xl,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: rnSpacing.md,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
    },
    actionBtnPrimary: { backgroundColor: tk.brand.cta },
    actionBtnPrimaryText: {
      color: tk.surface.light,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    actionBtnSecondary: {
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.surface.bg,
    },
    actionBtnSecondaryText: {
      color: tk.brand.DEFAULT,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
    actionBtnOutline: {
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    actionBtnOutlineText: {
      color: tk.text.secondary,
      fontSize: rnType.title.size,
      fontWeight: '600',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
