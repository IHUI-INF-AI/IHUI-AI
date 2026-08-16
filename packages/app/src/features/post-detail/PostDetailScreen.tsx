import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { PostDetailScreenProps } from '../../types'

/**
 * 动态详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染返回按钮 + 标题 + 作者/圈子/时间 metaRow
 * + 内容 + 点赞评论 statRow + loading / error 态。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function PostDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: PostDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('postDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        {item.circleName ? (
          <Text style={styles.circle}>#{item.circleName}</Text>
        ) : null}
        <Text style={styles.meta}>{item.createdAt}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      <View style={styles.statRow}>
        <TouchableOpacity style={styles.statBtn}>
          <Text style={styles.statText}>❤ {item.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statBtn}>
          <Text style={styles.statText}>💬 {item.comments}</Text>
        </TouchableOpacity>
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
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    back: { fontSize: 16, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 12 },
    author: { fontSize: 14, color: tk.text.secondary, fontWeight: '500' },
    circle: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    meta: { fontSize: 11, color: tk.text.tertiary },
    content: { fontSize: 16, lineHeight: 22, color: tk.text.medium },
    statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    statText: { fontSize: 12, color: tk.text.medium },
    backBtn: { marginTop: 12 },
  })
}
