import { useMemo } from 'react'
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SearchScreenItem, SearchScreenProps } from '../../types'

/** 搜索共享屏 — props 注入式跨端组件 */
export type { SearchScreenItem, SearchScreenProps }

const SEARCH_TYPE_KEYS: Record<SearchScreenItem['type'], string> = {
  course: 'search.type.course',
  article: 'search.type.article',
  post: 'search.type.post',
  note: 'search.type.note',
  agent: 'search.type.agent',
}

export function SearchScreen({
  t,
  keyword,
  results,
  loading,
  error,
  searched,
  onKeywordChange,
  onSearch,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: SearchScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('search.title')}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('search.placeholder')}
          placeholderTextColor={tk.text.tertiary}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>{t('search.empty')}</Text>
        </View>
      ) : null}

      <FlatList<SearchScreenItem>
        data={results}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onPressItem(item)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <View style={styles.cardHead}>
              <Text style={styles.typeBadge}>{t(SEARCH_TYPE_KEYS[item.type])}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardSummary} numberOfLines={2}>
              {item.summary}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    back: { fontSize: 14, color: tk.text.secondary },
    title: { flex: 1, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    input: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      fontSize: 14,
      color: tk.text.primary,
    },
    searchBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.success.DEFAULT,
    },
    searchText: { color: tk.surface.light, fontSize: 14 },
    muted: { fontSize: 13, color: tk.text.secondary },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8 },
    empty: { paddingVertical: 40, alignItems: 'center' },
    separator: { height: 8 },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    cardHead: { flexDirection: 'row', marginBottom: 4 },
    typeBadge: {
      fontSize: 10,
      color: tk.success.DEFAULT,
      backgroundColor: tk.success.light,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    cardTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    cardSummary: { marginTop: 4, fontSize: 13, color: tk.text.medium },
  })
}
