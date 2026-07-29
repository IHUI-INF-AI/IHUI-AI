import { useMemo } from 'react'
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AiAssistantScreenProps } from '../../types'

/** AI 助手共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AiAssistantScreenProps }

function formatNum(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`
}

export function AiAssistantScreen({
  t,
  items,
  categories,
  category,
  keyword,
  loading,
  refreshing,
  error,
  onCategoryChange,
  onKeywordChange,
  onRefresh,
  onPressItem,
  onBack,
  colorScheme = 'light',
}: AiAssistantScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('aiAssistant.title')}</Text>
        <Text style={styles.headerSub}>{t('aiAssistant.subtitle')}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder={t('aiAssistant.searchPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {categories.map((c) => {
          const active = category === c.id
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.catItem, active && styles.catItemActive]}
              onPress={() => onCategoryChange(c.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.catText, active && styles.catTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('aiAssistant.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onPressItem(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            </View>
            <View style={styles.tagRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            <View style={styles.cardFoot}>
              <Text style={styles.metaText}>
                {t('aiAssistant.useCount', { count: formatNum(item.useCount) })}
              </Text>
              <Text style={styles.metaText}>
                {t('aiAssistant.favoriteCount', { count: formatNum(item.favoriteCount) })}
              </Text>
              <View style={styles.ctaBtn}>
                <Text style={styles.ctaText}>{t('aiAssistant.startChat')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    backBtn: { paddingHorizontal: 16, paddingTop: 12 },
    back: { fontSize: 14, color: tk.text.secondary },
    header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    headerSub: { marginTop: 4, fontSize: 12, color: tk.text.secondary },
    searchRow: { paddingHorizontal: 16, marginTop: 4 },
    searchInput: {
      height: 38,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: tk.text.primary,
      backgroundColor: tk.surface.muted,
    },
    catScroll: { marginTop: 12, maxHeight: 40 },
    catScrollContent: { paddingHorizontal: 16, gap: 8 },
    catItem: {
      paddingHorizontal: 14,
      height: 32,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catItemActive: { backgroundColor: tk.purple.DEFAULT },
    catText: { fontSize: 13, color: tk.text.secondary },
    catTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: tk.danger.light },
    errorText: { fontSize: 12, color: tk.danger.DEFAULT },
    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 13, color: tk.text.tertiary },
    card: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardHead: { flexDirection: 'row' },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: tk.purple.light,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    avatarText: { fontSize: 18, fontWeight: '600', color: tk.purple.DEFAULT },
    cardMain: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    desc: { marginTop: 4, fontSize: 12, color: tk.text.secondary, lineHeight: 18 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: 11, color: tk.text.secondary },
    cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    metaText: { fontSize: 11, color: tk.text.tertiary },
    ctaBtn: {
      marginLeft: 'auto',
      paddingHorizontal: 14,
      height: 30,
      borderRadius: 8,
      backgroundColor: tk.purple.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontSize: 12, fontWeight: '600', color: tk.surface.light },
  })
}
