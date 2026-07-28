import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { FeedbackDetailItem, FeedbackDetailScreenProps } from '../../types'

/** 反馈详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { FeedbackDetailItem, FeedbackDetailScreenProps }

/**
 * 反馈详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ badgeRow(type/status 徽章)
 * + 内容 + 创建时间 + 回复(空态斜体)+ loading / error 态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function FeedbackDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: FeedbackDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('feedbackDetail.empty')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('feedbackDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <Text style={styles.typeBadge}>{item.type}</Text>
          <Text style={styles.statusBadge}>{item.status}</Text>
        </View>
        <Text style={styles.labelTitle}>{t('feedbackDetail.content')}</Text>
        <Text style={styles.content}>{item.content}</Text>
        <Text style={styles.createdAt}>{item.createdAt}</Text>
        <Text style={styles.labelTitle}>{t('feedbackDetail.reply')}</Text>
        {item.reply ? (
          <Text style={styles.reply}>{item.reply}</Text>
        ) : (
          <Text style={styles.replyEmpty}>{t('common.empty')}</Text>
        )}
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.card },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 16 },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    typeBadge: {
      fontSize: 11,
      color: tk.surface.light,
      backgroundColor: tk.success.DEFAULT,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    statusBadge: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    labelTitle: { marginTop: 12, fontSize: 13, fontWeight: '600', color: tk.text.secondary },
    content: { marginTop: 6, fontSize: 14, color: tk.text.medium, lineHeight: 22 },
    createdAt: { marginTop: 8, fontSize: 11, color: tk.text.tertiary },
    reply: { marginTop: 6, fontSize: 14, color: tk.text.medium, lineHeight: 22 },
    replyEmpty: {
      marginTop: 6,
      fontSize: 14,
      color: tk.text.tertiary,
      fontStyle: 'italic',
      lineHeight: 22,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
