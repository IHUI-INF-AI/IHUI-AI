import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { MessageDetailData, MessageDetailScreenProps } from '@ihui/types'

/** 消息详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { MessageDetailData, MessageDetailScreenProps }

/**
 * 消息详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 回复按钮)+ loading 态
 * + error/null 态(错误文本 + 返回按钮)+ 正常详情(ScrollView 显示
 * subject + fromUser + createdAt + content)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function MessageDetailScreen({
  t,
  message,
  loading,
  error,
  onReply,
  onBack,
  colorScheme = 'light',
}: MessageDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('messageDetail.title')}</Text>
        <TouchableOpacity
          onPress={onReply}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={loading || !!error || !message}
        >
          <Text style={styles.replyText}>{t('messageDetail.reply')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : error || !message ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || t('messageDetail.notFound')}</Text>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.subject}>{message.subject}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('messageDetail.from')}</Text>
            <Text style={styles.metaValue}>{message.fromUser}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>{t('messageDetail.createdAt')}</Text>
            <Text style={styles.metaValue}>{message.createdAt}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.content}>{message.content}</Text>
        </ScrollView>
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
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { flex: 1, fontSize: 18, fontWeight: '600', color: tk.text.primary },
    replyText: { fontSize: 14, color: tk.success.DEFAULT, fontWeight: '600' },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    backBtnText: { fontSize: 13, color: tk.text.primary },
    body: { padding: 16, paddingBottom: 32 },
    subject: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    metaLabel: { fontSize: 12, color: tk.text.tertiary },
    metaValue: { fontSize: 12, color: tk.text.secondary },
    divider: {
      height: 1,
      backgroundColor: tk.border.light,
      marginVertical: 12,
    },
    content: { fontSize: 14, color: tk.text.medium, lineHeight: 22 },
  })
}
