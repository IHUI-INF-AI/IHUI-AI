import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AskDetailScreenProps } from '../../types'

/** 问答详情共享屏 — props 注入式跨端组件 */
export type { AskDetailScreenProps }

export function AskDetailScreen({
  t,
  item,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: AskDetailScreenProps) {
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
        <Text style={styles.error}>{error || t('askDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{item.title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{item.author}</Text>
        <Text style={styles.meta}>
          {t('askDetail.views', { count: item.views })} · {item.createdAt}
        </Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
      <Text style={styles.sectionTitle}>
        {t('askDetail.answers', { count: item.answers.length })}
      </Text>
      {item.answers.length === 0 ? (
        <Text style={styles.muted}>{t('askDetail.empty')}</Text>
      ) : (
        item.answers.map((a) => (
          <View key={a.id} style={[styles.answer, a.isAccepted && styles.accepted]}>
            <View style={styles.answerHead}>
              <Text style={styles.author}>{a.author}</Text>
              {a.isAccepted ? (
                <Text style={styles.acceptedTag}>✓ {t('askDetail.accepted')}</Text>
              ) : null}
            </View>
            <Text style={styles.answerContent}>{a.content}</Text>
            <Text style={styles.meta}>{a.createdAt}</Text>
          </View>
        ))
      )}
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
    btn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      marginBottom: 12,
    },
    author: { fontSize: 13, color: tk.success.DEFAULT, fontWeight: '500' },
    meta: { fontSize: 11, color: tk.text.tertiary },
    content: { fontSize: 14, lineHeight: 22, color: tk.text.medium, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    answer: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      marginBottom: 8,
    },
    accepted: { borderColor: tk.success.DEFAULT, backgroundColor: tk.success.light },
    answerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    acceptedTag: { fontSize: 11, color: tk.success.DEFAULT, fontWeight: '600' },
    answerContent: { marginTop: 6, fontSize: 13, color: tk.text.medium },
  })
}
