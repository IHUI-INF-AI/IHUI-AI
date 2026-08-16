import { useMemo } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AskListScreenProps } from '../../types'

/** 问答列表共享屏 — props 注入式跨端组件 */
export type { AskListScreenProps }

export function AskListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onCreate,
  onBack,
  colorScheme = 'light',
}: AskListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error && items.length === 0) {
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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('askList.title')}</Text>
        <TouchableOpacity onPress={onCreate}>
          <Text style={styles.action}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('askList.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPressItem(item.id)} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.row}>
              <Text style={styles.author}>{item.author}</Text>
              <Text style={styles.meta}>
                {t('askList.answers', { count: item.answerCount })} ·{' '}
                {t('askList.views', { count: item.views })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 10, paddingTop: 48 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
    },
    btnText: { color: tk.surface.light, fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    back: { fontSize: 16, color: tk.text.secondary },
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    action: { fontSize: 24, color: tk.brand.DEFAULT, fontWeight: '600' },
    empty: { paddingVertical: 40, alignItems: 'center' },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    author: { fontSize: 11, color: tk.text.tertiary },
    meta: { fontSize: 11, color: tk.text.tertiary },
  })
}
