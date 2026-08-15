import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  type ListRenderItem,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

export interface CategoryDetailScreenProps {
  t: TFunction
  items: { id: string; name: string; description?: string; cover?: string }[]
  activeTab: string
  loading: boolean
  hasMore: boolean
  error: string
  onTabChange: (tab: string) => void
  onLoadMore: () => void
  onAgentPress: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

const TABS = ['推荐', '热门', '最新'] as const

export function CategoryDetailScreen({
  items,
  activeTab,
  loading,
  hasMore,
  error,
  onTabChange,
  onLoadMore,
  onAgentPress,
  onBack,
  colorScheme = 'light',
}: CategoryDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const renderItem: ListRenderItem<(typeof items)[number]> = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => onAgentPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.itemDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.itemArrow}>{'›'}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>分类详情</Text>
      </View>
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => onTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onLoadMore}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>暂无数据</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoading}>
                <Text style={styles.footerText}>加载更多...</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 14, color: tk.text.medium },
    title: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    tabsRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: tk.surface.card,
    },
    tabActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    tabText: {
      fontSize: 13,
      color: tk.text.secondary,
    },
    tabTextActive: {
      color: tk.surface.light,
      fontWeight: '600',
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
      marginBottom: 8,
      gap: 12,
    },
    itemBody: { flex: 1, minWidth: 0 },
    itemName: { fontSize: 15, fontWeight: '600', color: tk.text.primary },
    itemDesc: { fontSize: 12, color: tk.text.secondary, marginTop: 4 },
    itemArrow: { fontSize: 20, color: tk.text.tertiary },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    loadingText: { fontSize: 14, color: tk.text.secondary },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
    },
    retryText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
    emptyText: { fontSize: 14, color: tk.text.secondary },
    footerLoading: { paddingVertical: 12, alignItems: 'center' },
    footerText: { fontSize: 12, color: tk.text.secondary },
  })
}
