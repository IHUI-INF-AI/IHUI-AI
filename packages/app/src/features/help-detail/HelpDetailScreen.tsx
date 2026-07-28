import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { HelpDetailItem, HelpDetailScreenProps } from '../../types'

export type { HelpDetailItem, HelpDetailScreenProps }

/**
 * HelpDetailScreen — 跨端共享「帮助详情」页。
 * 平台无关:用 react-native primitives 编写,web 端 react-native-web 渲染,RN 端原生渲染。
 * i18n 通过 `t` 注入,导航通过 `onBack` 注入(由调用方提供)。
 * 数据(item/loading/error)由调用方注入,本组件只负责展示。
 * 配色:由 colorScheme prop('light' | 'dark',默认 'light')经 getTokens 解析为明/暗 token 集。
 */
export function HelpDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: HelpDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('helpDetail.empty')}</Text>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('helpDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.categoryRow}>
          <Text style={styles.categoryBadge}>{item.category}</Text>
        </View>
        <Text style={styles.question}>{item.question}</Text>
        <Text style={styles.answerTitle}>{t('helpDetail.answer')}</Text>
        <Text style={styles.answer}>{item.answer}</Text>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 16 },
    back: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    categoryRow: { flexDirection: 'row', marginBottom: 8 },
    categoryBadge: {
      fontSize: 11,
      color: tk.surface.light,
      backgroundColor: tk.success.DEFAULT,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    question: { fontSize: 17, fontWeight: '600', color: tk.text.primary },
    answerTitle: { marginTop: 16, fontSize: 13, fontWeight: '600', color: tk.text.secondary },
    answer: { marginTop: 6, fontSize: 14, color: tk.text.medium, lineHeight: 22 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
    muted: { fontSize: 12, color: tk.text.secondary, marginTop: 8 },
    error: { fontSize: 13, color: tk.danger.DEFAULT, textAlign: 'center' },
    backBtn: { marginTop: 12 },
  })
}
