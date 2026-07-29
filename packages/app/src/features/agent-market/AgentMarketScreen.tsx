import { useMemo } from 'react'
import { FlatList, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentMarketScreenProps } from '../../types'

/** Agent 市场共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentMarketScreenProps }

export function AgentMarketScreen({
  t,
  items,
  keyword,
  loading,
  error,
  onKeywordChange,
  onSearch,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: AgentMarketScreenProps) {
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
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('agentMarket.title')}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('agentMarket.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.btnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('agentMarket.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPressItem(item.id)} style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.meta}>
                ★ {item.rating.toFixed(1)} · {item.uses}
                {t('agentMarket.uses')}
              </Text>
              <Text style={styles.price}>
                {item.isFree ? t('agentMarket.free') : t('agentMarket.paid')}
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
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 16,
      paddingTop: 48,
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
    title: { marginTop: 8, marginBottom: 12, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
    },
    searchBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    empty: { paddingVertical: 40, alignItems: 'center' },
    card: {
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    cardDesc: { marginTop: 4, fontSize: 13, color: tk.text.primary },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    category: { marginRight: 8, fontSize: 11, color: tk.brand.DEFAULT },
    meta: { fontSize: 11, color: tk.text.tertiary },
    price: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: tk.brand.DEFAULT },
  })
}
