import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ArticleDetailItem, ArticleDetailScreenProps } from '../../types'

/** 文章详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { ArticleDetailItem, ArticleDetailScreenProps }

/**
 * 文章详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染返回按钮 + 文章标题 + 作者/发布时间 + 阅读/点赞统计 + 正文。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function ArticleDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: ArticleDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )

  if (error || !item)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('articleDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        <Text style={styles.meta}>{item.publishedAt}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.stat}>{t('articleDetail.views', { count: item.views })}</Text>
        <Text style={styles.stat}>❤ {item.likes}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
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
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
    author: { fontSize: 13, color: tk.success.DEFAULT, fontWeight: '500' },
    meta: { fontSize: 11, color: tk.text.tertiary },
    statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    stat: {
      fontSize: 11,
      color: tk.text.secondary,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    content: { fontSize: 14, lineHeight: 22, color: tk.text.medium },
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
  })
}
