// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { rnSpacing, rnType } from '@ihui/design-tokens'
import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { MessageDetailData, MessageDetailScreenProps } from '@ihui/types'

import { BackChevron } from '../../components/BackChevron'
import { ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

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
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
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
        <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
      ) : error || !message ? (
        <ErrorState
          message={error || t('messageDetail.notFound')}
          onRetry={onBack}
          retryLabel={t('common.back')}
          colorScheme={colorScheme}
        />
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
      paddingHorizontal: 10,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    replyText: { fontSize: rnType.title.size, color: tk.text.primary, fontWeight: '600' },
    body: { padding: 10, paddingBottom: rnSpacing['3xl'] },
    subject: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    metaLabel: { fontSize: rnType.body.size, color: tk.text.tertiary },
    metaValue: { fontSize: rnType.body.size, color: tk.text.secondary },
    // §4 禁分割线:原 meta 与正文间发丝线改为间距分隔(marginTop 24 ≈ 原 12+1 线+12 的留白)
    content: {
      marginTop: rnSpacing['2xl'],
      fontSize: rnType.title.size,
      color: tk.text.medium,
      lineHeight: 22,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
