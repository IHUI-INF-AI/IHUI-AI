// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'

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
        {/* back-label-exempt: 错误态/空态卡片内的按钮文案,或翻页/弹窗关闭动作 —— 此处「返回」是按钮文字而非页头箭头,换裸箭头反而不表意 until 2027-09-25 */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
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
      borderRadius: rnRadius.xl,
      backgroundColor: tk.brand.cta,
    },
    backBtnText: { color: tk.surface.light, fontSize: 16 },
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
      borderRadius: rnRadius.xl,
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
      borderRadius: rnRadius.xl,
      alignItems: 'center',
    },
    actionBtnPrimary: { backgroundColor: tk.brand.cta },
    actionBtnPrimaryText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    actionBtnSecondary: {
      borderWidth: 1,
      borderColor: tk.brandAccent.deep,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
