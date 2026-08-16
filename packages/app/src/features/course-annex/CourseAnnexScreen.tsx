import { useMemo } from 'react'
import { View, Text, TouchableOpacity, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CourseAnnexItem, CourseAnnexScreenProps } from '../../types'

/** 课程附件共享屏 — props 注入式跨端组件 */
export type { CourseAnnexItem, CourseAnnexScreenProps }

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}

export function CourseAnnexScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onBack,
  colorScheme = 'light',
}: CourseAnnexScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseAnnex.title')}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList<CourseAnnexItem>
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('courseAnnex.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.cardMeta}>
                  {t('courseAnnex.size')}: {fmtSize(item.size)}
                </Text>
                <Text style={styles.cardAction}>{t('courseAnnex.download')}</Text>
              </View>
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
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    error: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    listBody: { padding: 10 },
    separator: { height: 12 },
    card: {
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    cardMeta: { fontSize: 11, color: tk.text.tertiary },
    cardAction: {
      fontSize: 14,
      color: tk.brand.DEFAULT,
      fontWeight: '600',
    },
  })
}
