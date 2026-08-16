import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { NoteDetailItem, NoteDetailScreenProps } from '../../types'

/** 笔记详情/Props 类型 re-export(单一来源 @ihui/types) */
export type { NoteDetailItem, NoteDetailScreenProps }

/**
 * 笔记详情共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 loading 态 + 错误态(含返回按钮)+ 正常态
 * (返回按钮 + 标题 + 作者/浏览量/时间 + 标签徽章 + 正文 + 点赞统计)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 */
export function NoteDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: NoteDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('noteDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
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
        <Text style={styles.meta}>
          {t('noteDetail.views', { count: item.views })} · {item.createdAt}
        </Text>
      </View>
      {item.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Text key={tag} style={styles.tag}>
              #{tag}
            </Text>
          ))}
        </View>
      ) : null}
      <Text style={styles.content}>{item.content}</Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>❤ {item.likes}</Text>
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
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
    author: { fontSize: 14, color: tk.text.secondary, fontWeight: '500' },
    meta: { fontSize: 11, color: tk.text.tertiary },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tag: {
      fontSize: 11,
      color: tk.success.DEFAULT,
      backgroundColor: tk.success.light,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    content: { fontSize: 16, lineHeight: 22, color: tk.text.medium },
    statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    stat: {
      fontSize: 12,
      color: tk.text.medium,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    btn: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 16 },
  })
}
