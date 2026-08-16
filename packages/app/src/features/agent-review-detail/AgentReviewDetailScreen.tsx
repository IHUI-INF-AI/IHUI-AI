import { useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentReviewDetailItem, AgentReviewDetailScreenProps } from '../../types'

/** Agent 评价详情共享屏 — props 注入式跨端组件 */
export type { AgentReviewDetailItem, AgentReviewDetailScreenProps }

export function AgentReviewDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: AgentReviewDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('agentReviewDetail.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error || !item) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('agentReviewDetail.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{error || t('agentReviewDetail.empty')}</Text>
          <TouchableOpacity onPress={onBack} style={styles.retryBtn}>
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const stars = '\u2605'.repeat(Math.max(1, Math.min(5, item.rating || 0)))

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('agentReviewDetail.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.agentName}>{item.agentName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.author}>
            {t('agentReviewDetail.author')}: {item.author}
          </Text>
          <Text style={styles.rating}>{stars}</Text>
        </View>
        <Text style={styles.content}>{item.content}</Text>
        <Text style={styles.createdAt}>{item.createdAt}</Text>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 16,
    },
    muted: { fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: { marginTop: 12 },
    body: { padding: 14 },
    agentName: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    author: { fontSize: 14, color: tk.text.secondary },
    rating: { fontSize: 14, color: tk.warning.amber },
    content: { marginTop: 12, fontSize: 16, lineHeight: 22, color: tk.text.primary },
    createdAt: { marginTop: 12, fontSize: 11, color: tk.text.tertiary },
  })
}
