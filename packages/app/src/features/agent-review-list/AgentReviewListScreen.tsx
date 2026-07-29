import { useMemo } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentReviewListScreenProps } from '../../types'

/** Agent 评价列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentReviewListScreenProps }

export function AgentReviewListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: AgentReviewListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('agentReviewList.title')}</Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.muted}>{t('agentReviewList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.agentName} numberOfLines={1}>
                  {item.agentName}
                </Text>
                <Text style={styles.stars}>
                  {'★'.repeat(Math.max(1, Math.min(5, item.rating || 0)))}
                </Text>
              </View>
              <Text style={styles.content} numberOfLines={2}>
                {item.content}
              </Text>
              <Text style={styles.author}>
                {t('agentReviewList.author')}: {item.author} · {item.createdAt}
              </Text>
            </View>
          )}
        />
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
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    back: { fontSize: 14, color: tk.text.primary },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorText: { paddingHorizontal: 16, fontSize: 12, color: tk.danger.DEFAULT },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    muted: { marginTop: 8, fontSize: 12, color: tk.text.secondary },
    listContent: { padding: 16 },
    separator: { height: 8 },
    empty: { paddingVertical: 48, alignItems: 'center' },
    card: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    agentName: {
      flex: 1,
      marginRight: 8,
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.primary,
    },
    stars: { fontSize: 12, color: tk.warning.amber },
    content: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    author: { marginTop: 6, fontSize: 11, color: tk.text.tertiary },
  })
}
