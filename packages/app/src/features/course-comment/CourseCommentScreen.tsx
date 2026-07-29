import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseCommentScreenProps } from '../../types'

/** 课程评论共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { CourseCommentScreenProps }

export function CourseCommentScreen({
  t,
  items,
  loading,
  error,
  onBack,
  colorScheme = 'light',
}: CourseCommentScreenProps) {
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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={onBack}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('courseComment.title')}</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('courseComment.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.user}>{item.user}</Text>
              <Text style={styles.rating}>★ {item.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.content}>{item.content}</Text>
            <Text style={styles.meta}>{item.createdAt}</Text>
          </View>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
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
      backgroundColor: tk.success.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 14 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    empty: { paddingVertical: 40, alignItems: 'center' },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    user: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    rating: { fontSize: 12, color: tk.success.DEFAULT },
    content: { marginTop: 6, fontSize: 13, color: tk.text.medium },
    meta: { marginTop: 4, fontSize: 11, color: tk.text.tertiary },
  })
}
