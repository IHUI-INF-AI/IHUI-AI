// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { Star } from 'lucide-react-native'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState, ScreenSkeleton } from '../../components/ScreenStates'

/** 收藏列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { FavoriteFilterTab, FavoriteItemRow, FavoriteScreenProps }

const TABS: FavoriteFilterTab[] = ['all', 'course', 'live', 'post', 'aigc', 'news']

/**
 * 收藏列表共享屏 — props 注入式跨端组件(批次 15,带 tab 筛选)
 *
 * 平台无关:负责渲染 header(返回 + 标题 + 「已收藏 N 项」统计)
 * + tabs(all/course/live/post/aigc/news,与小程序收藏页同一套分类)
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
  hasMore,
  error,
  onRefresh,
  onLoadMore,
  onDelete,
  onBack,
  onGoDiscover,
  colorScheme = 'light',
}: FavoriteScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const tabLabel = (tab: FavoriteFilterTab) => {
    switch (tab) {
      case 'all':
        return t('favorite.tab_all')
      case 'course':
        return t('favorite.tab_course')
      case 'live':
        return t('favorite.tab_live')
      case 'post':
        return t('favorite.tab_post')
      case 'aigc':
        return t('favorite.tab_aigc')
      case 'news':
        return t('favorite.tab_news')
      default:
        return t('favorite.tab_all')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('favorite.title')}</Text>
        <Text style={styles.statsText}>
          {t('favorite.total')} {items.length} {t('favorite.items_unit')}
        </Text>
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

      {error ? (
        <ErrorState
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : null}

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
            <ScreenSkeleton variant="list" count={4} colorScheme={colorScheme} />
          ) : (
            <EmptyState
              title={t('favorite.empty')}
              actionLabel={onGoDiscover ? t('favorite.go_discover') : undefined}
              onAction={onGoDiscover}
              colorScheme={colorScheme}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('favorite.loading_more')}</Text>
            </View>
          ) : hasMore === false && items.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('favorite.no_more')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.cover ? (
              <Image source={{ uri: item.cover }} style={styles.coverImg} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Star size={24} color={tk.text.medium} />
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta}>
                {item.targetType} · {t('favorite.collected_at')} {item.createdAt}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.deleteBtnText}>{t('favorite.cancel')}</Text>
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
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.primary },
    statsText: { marginLeft: 'auto', fontSize: rnType.caption.size, color: tk.text.secondary },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingVertical: rnSpacing.sm,
      gap: rnSpacing.sm,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.card,
    },
    tabActive: { backgroundColor: tk.brand.cta },
    tabText: { fontSize: rnType.body.size, color: tk.text.secondary },
    tabTextActive: { color: tk.surface.light, fontWeight: '600' },
    listBody: { padding: 10, paddingBottom: rnSpacing['3xl'] },
    separator: { height: 12 },
    footer: { alignItems: 'center', paddingVertical: rnSpacing.lg },
    footerText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    coverImg: {
      width: 64,
      height: 64,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
    },
    coverPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: rnRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.muted,
    },
    coverEmoji: { fontSize: rnType.display.size },
    cardInfo: { flex: 1, marginLeft: rnSpacing.md },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    cardMeta: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.secondary },
    deleteBtn: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: 6,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    deleteBtnText: { fontSize: rnType.body.size, color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
