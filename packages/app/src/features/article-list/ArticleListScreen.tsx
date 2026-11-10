// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { ArticleListItem, ArticleListScreenProps } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { scrollJumpInsetPx } from '@ihui/shared/ui/scroll-jump-spec'
import { BackChevron } from '../../components/BackChevron'
import { CategoryInlineBar } from '../../components/category/CategoryInlineBar'
import {
  ScreenSkeleton,
  EmptyState,
  ErrorState,
  PressableCard,
} from '../../components/ScreenStates'
import { ScrollJumpButton } from '../../components/ScrollJumpButton'
import { SearchInput } from '../../components/SearchInput'
import { assertRequiredPort } from '../../host/ports'

/** 文章列表/Props 类型 re-export(单一来源 @ihui/types) */
export type { ArticleListItem, ArticleListScreenProps }

/** 骨架屏卡片数量(模拟首屏可见区域的文章卡片数) */
const SKELETON_COUNT = 5

/**
 * 文章列表共享屏 — props 注入式跨端组件
 *
 * 平台无关:负责渲染 header(返回 + 标题)+ 加载态(骨架屏)+ 错误态(重试)
 * + 文章卡片列表(title + author + views + publishedAt)
 * + 下拉刷新 + 空态(引导文字 + 刷新按钮)。
 * 平台特定(导航 / API 调用)由 wrapper 通过 props 注入。
 *
 * 2026-09-23 修复:
 * - P1:首次加载改为骨架屏(共享 ScreenSkeleton),保持 header 框架可见,不再全灰屏
 * - P2:空状态使用共享 EmptyState(引导文字 + 刷新按钮)
 * - P3:错误状态使用共享 ErrorState(错误文字 + 重试按钮),框架保持可见
 */
export function ArticleListScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  onEndReached,
  loadingMore = false,
  onRetry,
  colorScheme = 'light',
  onToast,
  keyword = '',
  searchPlaceholder,
  onKeywordChange,
  onSearch,
  categories,
  selectedCategory,
  onSelectCategory,
  pinnedItem = null,
  readIds,
  hideHeader = false,
  onListRef,
  showBackTop = false,
  onBackToTop,
  contentBottomPadding = 12,
  noMore = false,
}: ArticleListScreenProps) {
  assertRequiredPort('onToast', onToast)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 首次加载(无数据时的 loading 态)→ 骨架屏 */
  const showSkeleton = loading && items.length === 0
  /** 错误态(无数据时的 error)→ 居中错误提示 + 重试 */
  const showError = !loading && error.length > 0 && items.length === 0

  /** 已读集合(显式 props 注入,屏内不碰任何平台存储) */
  const readSet = useMemo(() => new Set(readIds ?? []), [readIds])
  /** 置顶条目:列表里剔除同 id,避免置顶重复出现 */
  const pinned = pinnedItem && pinnedItem.id ? pinnedItem : null
  const listData = useMemo(
    () => (pinned ? items.filter((i) => i.id !== pinned.id) : items),
    [items, pinned],
  )
  const [showTopBtn, setShowTopBtn] = useState(false)
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // RN 事件走 nativeEvent.contentOffset;小程序 Taro 事件只有 detail.scrollTop
    // (rn-compat 的 ScrollView 原样透传 Taro 事件),两种形态都认,否则小程序端回顶永不出现
    const detail = (e as unknown as { detail?: { scrollTop?: number } }).detail
    const y = e.nativeEvent?.contentOffset?.y ?? detail?.scrollTop ?? 0
    setShowTopBtn(y > 200)
  }

  return (
    <View style={styles.container}>
      {/* header 始终渲染 — 保持页面框架可见(修复 P1 全灰屏连导航消失);宿主已有导航栏时隐藏 */}
      {hideHeader ? null : (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.title}>{t('articleList.title')}</Text>
        </View>
      )}

      {/* 搜索栏:显式 props 控制,不传 onKeywordChange 则整段不存在 */}
      {onKeywordChange ? (
        <View style={styles.searchWrap}>
          <SearchInput
            value={keyword}
            onChangeText={onKeywordChange}
            onSubmit={onSearch}
            placeholder={searchPlaceholder}
            colorScheme={colorScheme}
          />
        </View>
      ) : null}

      {/* 分类栏:与广场屏复用同一份 CategoryInlineBar,不重复实现 */}
      {categories && categories.length > 0 && onSelectCategory ? (
        <CategoryInlineBar
          items={categories}
          selectedId={selectedCategory ?? null}
          onSelect={onSelectCategory}
          colorScheme={colorScheme}
          contentPaddingHorizontal={10}
          itemGap={8}
        />
      ) : null}

      {/* 内容区:根据状态条件渲染,header 框架始终可见 */}
      {showSkeleton ? (
        /* P1 修复:骨架屏替代纯文字"加载中...",模拟文章卡片占位 */
        <ScreenSkeleton variant="card" count={SKELETON_COUNT} colorScheme={colorScheme} />
      ) : showError ? (
        /* P3 修复:错误态居中显示图标 + 错误文字 + 重试按钮 */
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList<ArticleListItem>
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listBody, { paddingBottom: contentBottomPadding }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ref={(ref: unknown) => onListRef?.(ref)}
          ListHeaderComponent={
            pinned ? (
              <PressableCard
                style={styles.pinnedCard}
                onPress={() => onPressItem(pinned)}
                colorScheme={colorScheme}
              >
                <View style={styles.pinnedBadge}>
                  <Text style={styles.pinnedBadgeText}>{t('news.pinned')}</Text>
                </View>
                <Text style={styles.pinnedTitle} numberOfLines={2}>
                  {pinned.title}
                </Text>
                {pinned.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {pinned.summary}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.author}>{pinned.author}</Text>
                  <Text style={styles.meta}>
                    {t('articleList.views', { count: pinned.views })} · {pinned.publishedAt}
                  </Text>
                </View>
              </PressableCard>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={tk.brand.DEFAULT} />
                <Text style={styles.footerText}>{t('common.loading')}</Text>
              </View>
            ) : noMore && listData.length > 0 ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('common.noMore')}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            /* P2 修复:空状态添加引导文字 + 刷新按钮 */
            <EmptyState
              title={t('articleList.empty')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
              colorScheme={colorScheme}
            />
          }
          renderItem={({ item }) => {
            const isRead = readSet.has(item.id)
            return (
              <PressableCard
                style={[styles.card, isRead ? styles.cardRead : null]}
                onPress={() => onPressItem(item)}
                colorScheme={colorScheme}
              >
                <View style={styles.titleRow}>
                  {isRead ? null : <View style={styles.unreadDot} />}
                  <Text
                    style={[styles.cardTitle, isRead ? styles.cardTitleRead : null]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                </View>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}
                {item.category ? <Text style={styles.categoryText}>{item.category}</Text> : null}
                <View style={styles.metaRow}>
                  <Text style={styles.author}>{item.author}</Text>
                  <Text style={styles.meta}>
                    {t('articleList.views', { count: item.views })} · {item.publishedAt}
                  </Text>
                </View>
                {item.source ? <Text style={styles.sourceText}>{item.source}</Text> : null}
              </PressableCard>
            )
          }}
        />
      )}

      {/* 返回顶部:外观/几何由共享 ScrollJumpButton 单一源给出 */}
      {showBackTop && onBackToTop && showTopBtn ? (
        <ScrollJumpButton
          direction="top"
          onPress={onBackToTop}
          label={t('common.backToTop') === 'common.backToTop' ? '返回顶部' : t('common.backToTop')}
          colorScheme={colorScheme}
          style={{ position: 'absolute', right: scrollJumpInsetPx(), bottom: scrollJumpInsetPx() }}
        />
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { flex: 1, fontSize: rnType.heading.size, fontWeight: '700', color: tk.text.primary },
    listBody: { padding: rnSpacing['sm-loose'] },
    separator: { height: 12 },
    searchWrap: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingBottom: rnSpacing.sm,
    },
    pinnedCard: {
      padding: rnSpacing['md-loose'],
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    pinnedBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.bg,
      marginBottom: rnSpacing.sm,
    },
    pinnedBadgeText: { fontSize: rnType.caption.size, color: tk.brand.DEFAULT, fontWeight: '600' },
    pinnedTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: tk.brand.DEFAULT,
    },
    cardRead: { opacity: 0.55 },
    cardTitleRead: { color: tk.text.secondary },
    summary: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    categoryText: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.brand.DEFAULT,
    },
    sourceText: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    card: {
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    cardTitle: { fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: rnSpacing.sm,
    },
    author: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.md,
    },
    footerText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
