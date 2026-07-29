import { useMemo } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { CertListScreenProps } from '../../types'

/** 证书列表共享屏 — props 注入式跨端组件 */
export type { CertListScreenProps }

export function CertListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: CertListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('certList.title')}</Text>
      </View>
      {error ? <Text style={styles.errorBar}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listBody}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>{t('certList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onPressItem(item.id)}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.label}>
                {t('certList.issuer')}: {item.issuer}
              </Text>
              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('certList.issuedAt')}: {item.issuedAt}
                </Text>
                <Text style={styles.score}>{item.score}</Text>
              </View>
            </TouchableOpacity>
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
    back: { fontSize: 14, color: tk.text.secondary },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    errorBar: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: tk.danger.DEFAULT },
    listBody: { padding: 16 },
    separator: { height: 8 },
    center: { alignItems: 'center', paddingVertical: 48 },
    muted: { fontSize: 12, color: tk.text.secondary },
    card: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: tk.border.light },
    cardTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    label: { marginTop: 4, fontSize: 11, color: tk.text.secondary },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    score: { fontSize: 14, fontWeight: '600', color: tk.brand.DEFAULT },
  })
}
