// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { CategoryInlineBar } from '../../components/category/CategoryInlineBar'
import type { TFunction } from '../../types'

import { rnRadius } from '@ihui/design-tokens'

/** 文章卡片(共享层简化类型,保留 UI 渲染所需字段) */
export interface ArticleItem {
  id: string
  title: string
  summary?: string
  authorName?: string
  createdAt?: string
  viewCount?: number
  category?: string
  sourceName?: string
  [key: string]: unknown
}

/** 分类项 */
export interface CategoryItem {
  id: string
  label: string
}

export interface SquareScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  items: ArticleItem[]
  loading: boolean
  refreshing: boolean
  error: string
  categories: CategoryItem[]
  selectedCategory: string
  onSelectCategory: (id: string) => void
  onRefresh: () => void
  onEndReached: () => void
  onItemClick: (id: string) => void
  showBackTop: boolean
  onBackToTop: () => void
  onListRef?: (ref: unknown) => void
  onBack?: () => void
  /** 隐藏自带 header(调用方已有 NavBar 时用,防双标题;默认 false 保持原行为) */
  hideHeader?: boolean
}

export function SquareScreen({
  t,
  colorScheme = 'light',
  items,
  loading,
  refreshing,
  error,
  categories,
  selectedCategory,
  onSelectCategory,
  onRefresh,
  onEndReached,
  onItemClick,
  showBackTop,
  onBackToTop,
  onListRef,
  onBack,
  hideHeader = false,
}: SquareScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  /** 返回顶部按钮可见性:滚动超过阈值显示(对齐 Uniapp share/index.vue showToodown scrollTop>200) */
  const [showTopBtn, setShowTopBtn] = useState(false)

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowTopBtn(e.nativeEvent.contentOffset.y > 200)
  }

  const renderItem = ({ item }: { item: ArticleItem }) => {
    const author = item.authorName || '佚名'
    const time = item.createdAt ? formatRelativeTime(item.createdAt) : ''
    const views = item.viewCount ?? 0
    const source = item.sourceName
    const sourceText = source && source !== 'Not_Support' ? `来源:${source}` : '来源:网络'

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
        onPress={() => onItemClick(item.id)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.content}>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1} allowFontScaling={false}>
                {item.category}
              </Text>
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.authorBadge}>
              <Text style={styles.authorText} numberOfLines={1} allowFontScaling={false}>
                {author}
              </Text>
            </View>
            {time ? (
              <Text style={styles.metaText} allowFontScaling={false}>
                {time}
              </Text>
            ) : null}
            <Text style={styles.metaText} allowFontScaling={false}>
              {`${views} 阅读`}
            </Text>
          </View>
          <Text style={styles.sourceText} allowFontScaling={false}>
            {sourceText}
          </Text>
        </View>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      {hideHeader ? null : (
        <View style={styles.header}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.navTitle}>{t('square.title') || '广场'}</Text>
        </View>
      )}
      <CategoryInlineBar
        items={categories}
        selectedId={selectedCategory}
        onSelect={onSelectCategory}
        colorScheme={colorScheme}
        contentPaddingHorizontal={10}
        itemGap={8}
      />
      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          ListEmptyComponent={
            !loading && items.length === 0 ? (
              <View style={styles.centerWrap}>
                <Text style={styles.emptyText}>暂无文章</Text>
              </View>
            ) : undefined
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ref={(ref) => onListRef?.(ref)}
        />
      )}
      {/* 返回顶部按钮 */}
      {showBackTop && showTopBtn ? (
        <Pressable
          style={styles.backToTop}
          onPress={onBackToTop}
          accessibilityRole="button"
          accessibilityLabel="返回顶部"
        >
          <Text style={styles.backToTopIcon}>{'↑'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    } as ViewStyle,
    backText: {
      fontSize: 16,
      color: tk.text.medium,
    } as TextStyle,
    navTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    } as ViewStyle,
    loadingText: {
      fontSize: 16,
      color: tk.text.secondary,
    } as TextStyle,
    errorText: {
      fontSize: 16,
      color: tk.text.primary,
      marginBottom: 12,
      textAlign: 'center',
    } as TextStyle,
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.brand.cta,
    } as ViewStyle,
    retryText: {
      // retryButton 底色用 brand.DEFAULT(深色=白),文字必须用 brand.foreground(深色=黑),
      // 不得用 surface.light(两态皆白 → 深色白底白字不可见)
      color: tk.brand.ctaForeground,
      fontSize: 16,
      fontWeight: '600',
    } as TextStyle,
    listContent: {
      paddingHorizontal: 10,
      paddingVertical: 12,
    } as ViewStyle,
    itemGap: {
      height: 12,
    } as ViewStyle,

    // 卡片
    card: {
      borderRadius: rnRadius.xl,
      padding: 12,
      backgroundColor: tk.surface.light,
      borderWidth: 1,
      borderColor: tk.border.light,
    } as ViewStyle,
    cardPressed: {
      backgroundColor: tk.surface.muted,
    } as ViewStyle,
    content: {
      gap: 6,
    } as ViewStyle,
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: rnRadius.lg,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
    } as ViewStyle,
    categoryText: {
      fontSize: 12,
      lineHeight: 14,
      color: tk.text.primary,
      fontWeight: '600',
    } as TextStyle,
    title: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    summary: {
      fontSize: 14,
      lineHeight: 20,
      color: tk.text.secondary,
    } as TextStyle,
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
    } as ViewStyle,
    authorBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: rnRadius.lg,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
    } as ViewStyle,
    authorText: {
      fontSize: 12,
      lineHeight: 14,
      color: tk.text.primary,
      fontWeight: '600',
    } as TextStyle,
    metaText: {
      fontSize: 12,
      lineHeight: 14,
      color: tk.text.tertiary,
    } as TextStyle,
    sourceText: {
      fontSize: 12,
      lineHeight: 14,
      color: tk.text.tertiary,
      marginTop: 4,
    } as TextStyle,
    emptyText: {
      fontSize: 16,
      color: tk.text.secondary,
    } as TextStyle,

    // 返回顶部按钮
    backToTop: {
      position: 'absolute',
      left: '50%',
      marginLeft: -17,
      bottom: 44,
      width: 34,
      height: 34,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brandAccent.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: tk.gray[900],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    } as ViewStyle,
    backToTopIcon: {
      fontSize: 20,
      color: tk.brandAccent.foreground,
      fontWeight: '600',
      includeFontPadding: false,
    } as TextStyle,
  })
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
