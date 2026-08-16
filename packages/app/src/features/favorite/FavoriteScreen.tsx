import { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { FavoriteFilterTab, FavoriteItemRow, FavoriteScreenProps } from '@ihui/types'

/** 收藏列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { FavoriteFilterTab, FavoriteItemRow, FavoriteScreenProps }

const TABS: FavoriteFilterTab[] = ['all', 'course', 'live', 'article']

/**
 * 收藏列表共享屏 — props 注入式跨端组件(批次 15,带 tab 筛选)
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ tabs(all/course/live/article)
 * + 收藏卡片列表(cover[Image 或 emoji 占位] + title + tab 标签 · createdAt + 删除按钮)
 * + 下拉刷新 + 上拉加载更多。
 * 平台特定(导航 / API 调用 / Alert 确认)由 wrapper 通过 props 注入。
 */
export function FavoriteScreen({
  t,
  items,
  activeTab,
  onSelectTab,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onDelete,
  onBack,
  colorScheme = 'light',
}: FavoriteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const tabLabel = (tab: FavoriteFilterTab) => {
    switch (tab) {
      case 'all':
        return t('favorite.tabAll')
      case 'course':
        return t('favorite.tabCourse')
      case 'live':
        return t('favorite.tabLive')
      case 'article':
        return t('favorite.tabArticle')
      default:
        return t('favorite.tabAll')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('favorite.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const active = tab === activeTab
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onSelectTab(tab)}
              style={[styles.tab, active && styles.tabActive]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel(tab)}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList<FavoriteItemRow>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('favorite.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.cover ? (
              <Image source={{ uri: item.cover }} style={styles.coverImg} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverEmoji}>⭐</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {item.targetType} · {item.createdAt}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
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
      paddingTop: 48,
      paddingBottom: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '600', color: tk.text.primary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 8,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.DEFAULT },
    tabText: { fontSize: 14, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    errorText: { paddingHorizontal: 10, fontSize: 14, color: tk.danger.DEFAULT },
    listBody: { padding: 10, paddingBottom: 32 },
    separator: { height: 12 },
    center: { alignItems: 'center', paddingVertical: 48 },
    emptyText: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
    footer: { alignItems: 'center', paddingVertical: 16 },
    footerText: { fontSize: 11, color: tk.text.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    coverImg: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: tk.surface.muted,
    },
    coverPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    coverEmoji: { fontSize: 24 },
    cardInfo: { flex: 1, marginLeft: 12 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: 8, fontSize: 11, color: tk.text.secondary },
    deleteBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    deleteBtnText: { fontSize: 14, color: tk.text.primary },
  })
}
