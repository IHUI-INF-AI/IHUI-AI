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
import type { FavoritesItem, FavoritesScreenProps } from '../../types'

/** 收藏列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { FavoritesItem, FavoritesScreenProps }

/**
 * 收藏列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header + 收藏卡片列表(封面 + 标题 + targetType + 创建时间 + 删除按钮)
 * + 下拉刷新 + 上拉加载更多。
 * 平台特定(导航 / API 调用 / Alert 确认 / 日期格式化)由 wrapper 通过 props 注入。
 */
export function FavoritesScreen({
  t,
  items,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  onDelete,
  onBack,
  colorScheme = 'light',
}: FavoritesScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('favorites.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList<FavoritesItem>
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
              <Text style={styles.emptyText}>{t('favorites.empty')}</Text>
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
    errorBar: { paddingHorizontal: 10, paddingVertical: 8 },
    errorText: { fontSize: 14, color: tk.danger.DEFAULT },
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
