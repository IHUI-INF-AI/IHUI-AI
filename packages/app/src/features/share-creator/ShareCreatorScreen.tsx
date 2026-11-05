// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { useMemo } from 'react'
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import type { ArticleItem, CategoryItem } from '@ihui/types'
import { rnSpacing, rnType } from '@ihui/design-tokens'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { SquareScreen } from '../square/SquareScreen'
import type { ShareCreatorItem, ShareCreatorScreenProps } from './types'

/**
 * 分享创作流共享屏。
 *
 * 本期只把「已有一端真实现、且能在共享层单源」的段收进来:
 * - B2 分类横条 / B4 信息流(含空/加载/错误/返回顶部): 复用 `SquareScreen` 单一源,
 *   不再复制第三份列表渲染;
 * - B8 返回: 端口透传(页面无自带 NavBar 时才渲染自带 header)。
 *
 * 未收段(B1 顶部 tab / B3 搜索 / B5 排行榜 / B6 兴趣赛道弹窗 / B7 分享卡 canvas)
 * 在 web 与 RN 都找不到对应实现,按裁决点 1/5 判缺段、留在小程序页内,不在此处加
 * 只有小程序传的 props/插槽。
 */
export function ShareCreatorScreen({
  t,
  colorScheme = 'light',
  items,
  loading = false,
  refreshing = false,
  error = '',
  onRefresh,
  onLoadMore,
  onRetry,
  onPressItem,
  categories = [],
  activeCategory = '',
  onSelectCategory,
  showBackTop = true,
  onBackToTop,
  onListRef,
  onBack,
  contentBottomPadding = 12,
}: ShareCreatorScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  // 共享层只做字段搬运(不补假值):缺 viewCount/sourceName 时由 SquareScreen 按原规则降级。
  const articleItems = useMemo<ArticleItem[]>(
    () =>
      items.map((item: ShareCreatorItem) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        coverUri: item.coverUri,
        authorName: item.authorName,
        likeCount: item.likeCount,
        createdAt: item.createdAt,
      })),
    [items],
  )

  const withHeader = Boolean(onBack)

  return (
    <View style={styles.container}>
      {withHeader ? (
        <View style={styles.header}>
          <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
          <Text style={styles.navTitle} numberOfLines={1}>
            {t('news.title') || '资讯'}
          </Text>
        </View>
      ) : null}
      <SquareScreen
        t={t}
        colorScheme={colorScheme}
        items={articleItems}
        loading={loading}
        refreshing={refreshing}
        error={error}
        categories={categories as CategoryItem[]}
        selectedCategory={activeCategory ?? ''}
        onSelectCategory={onSelectCategory ?? noopSelectCategory}
        onRefresh={onRefresh}
        onEndReached={onLoadMore ?? noop}
        onItemClick={onPressItem}
        showBackTop={showBackTop}
        onBackToTop={onBackToTop ?? noop}
        onListRef={onListRef}
        onRetry={onRetry}
        hideHeader
        contentBottomPadding={contentBottomPadding}
      />
    </View>
  )
}

const noop = () => {}
const noopSelectCategory = (_id: string) => {}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    } as ViewStyle,
    navTitle: {
      fontSize: rnType.heading.size,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
  })
}
