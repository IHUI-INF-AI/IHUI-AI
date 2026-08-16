import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CircleDetailItem, CircleDetailScreenProps } from '../../types'

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('circleDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.backText}>{t('common.back')}</Text>
      </TouchableOpacity>
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
      paddingTop: 48,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center', marginBottom: 8 },
    backBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    backBtnText: { color: tk.surface.light, fontSize: 16 },
    backText: { fontSize: 16, color: tk.text.medium },
    title: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    statBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    statText: { fontSize: 14, color: tk.text.secondary },
    description: {
      fontSize: 16,
      lineHeight: 22,
      color: tk.text.primary,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    actionBtnPrimary: { backgroundColor: tk.brand.DEFAULT },
    actionBtnPrimaryText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    actionBtnSecondary: {
      borderWidth: 1,
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.bg,
    },
    actionBtnSecondaryText: { color: tk.brand.DEFAULT, fontSize: 16, fontWeight: '600' },
    actionBtnOutline: {
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    actionBtnOutlineText: { color: tk.text.secondary, fontSize: 16, fontWeight: '600' },
  })
}
