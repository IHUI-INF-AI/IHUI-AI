// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Eye, Newspaper, Pin } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { NewsCategoryArticle, NewsCategoryScreenProps } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

/** 条目 / props 类型 re-export(单一来源 @ihui/types,同 KnowledgeEntryReadingScreen 口径) */
export type { NewsCategoryArticle, NewsCategoryScreenProps }

/**
 * ISO → `YYYY-MM-DD`。web 侧走 `formatDateOnly`(apps/web/src/lib/date-utils),
 * RN 侧统一短日期,与 KnowledgeEntryReadingScreen 的 formatDate 同口径,避免再引日期库。
 */
function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * NewsCategoryScreen 资讯分类列表(共享层唯一功能源)
 *
 * 2026-10-28 补屏立,承载 web `/news/category/[id]`
 * (apps/web/app/(main)/news/category/[id]/PageClient.tsx):
 * - 结构:顶栏(返回 / 分类名)→ 副标题 → 文章卡列表(封面 + 置顶徽标 + 标题 + 摘要
 *   + 作者 / 发布时间 / 阅读数)→ 页脚「共 N 篇」
 * - 分页:web 是 `?page=` 翻页;RN 无地址栏,改上拉触底追加,`total` 仍按后端真值展示
 * - 分类缺失(id 不在 `/news/categories` 里):整屏「资讯不存在」+ 返回入口,对齐 web 的
 *   `!category` 分支;分类接口自身失败时**不**判缺失,只退化成通用标题继续渲染列表
 * - 平台无关:取数 / id→name 解析 / 导航全由 wrapper 注入,本屏零 fetch、零 navigation
 * - 样式:getTokens(colorScheme) 语义 token,零 hex,间距走 rnSpacing/rnType/rnRadius
 * - i18n:`news.category*`(新增,与资讯详情屏的 `news.*` 键名不重叠)+ `common.retry`
 */
export function NewsCategoryScreen({
  t,
  categoryName,
  items,
  total,
  loading,
  refreshing = false,
  loadingMore = false,
  hasMore = false,
  error,
  onBack,
  onRefresh,
  onRetry,
  onLoadMore,
  onSelect,
  colorScheme = 'light',
}: NewsCategoryScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const showSkeleton = loading && items.length === 0
  const showError = !loading && error.length > 0 && items.length === 0
  /** 分类已解析出来却查无此项 ⇒ 与 web 的 notFound 分支一致(接口失败不算「不存在」) */
  const showNotFound = !loading && !showError && !categoryName && items.length === 0

  const header = (
    <View style={styles.header}>
      <BackChevron
        onPress={onBack}
        label={t('news.categoryBackToList')}
        colorScheme={colorScheme}
      />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {categoryName || t('news.title')}
      </Text>
      {/* 右侧占位:与左侧返回键等宽,标题才是真居中而不是被按钮挤偏 */}
      <View style={styles.headerSpacer} />
    </View>
  )

  if (showSkeleton) {
    return (
      <View style={styles.container}>
        {header}
        <ScreenSkeleton variant="card" count={3} colorScheme={colorScheme} />
      </View>
    )
  }

  if (showError) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={onRetry ?? onRefresh}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  if (showNotFound) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          glyph="◍"
          title={t('news.categoryNotFound')}
          actionLabel={t('news.categoryBackToList')}
          onAction={onBack}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList<NewsCategoryArticle>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listBody}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={<Text style={styles.subtitle}>{t('news.categorySubtitle')}</Text>}
        ListEmptyComponent={
          <EmptyState
            glyph="◍"
            title={t('news.categoryEmpty')}
            actionLabel={t('common.retry')}
            onAction={onRefresh}
            colorScheme={colorScheme}
          />
        }
        ListFooterComponent={
          loadingMore || total > 0 ? (
            <View style={styles.footer}>
              {loadingMore ? <ActivityIndicator color={tk.brand.DEFAULT} /> : null}
              {total > 0 ? (
                <Text style={styles.footerText}>{t('news.categoryTotal', { total })}</Text>
              ) : null}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.brand.DEFAULT}
          />
        }
        /* 触底追加:只在「还有下一页 + 宿主接线 + 不在加载中」时才挂,避免空转重复请求 */
        onEndReached={hasMore && onLoadMore && !loadingMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <PressableCard
            style={styles.card}
            onPress={() => onSelect(item.id)}
            colorScheme={colorScheme}
          >
            <View style={styles.cardRow}>
              {item.coverImage ? (
                <Image source={{ uri: item.coverImage }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Newspaper size={22} color={tk.text.tertiary} strokeWidth={2} />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  {item.isPinned ? (
                    <View style={styles.pinBadge}>
                      <Pin size={10} color={tk.brand.DEFAULT} strokeWidth={2.4} />
                      <Text style={styles.pinText}>{t('news.categoryPinned')}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.authorName ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.authorName}
                    </Text>
                  ) : null}
                  <Text style={styles.meta}>
                    {t('news.categoryPublishedAt', { date: formatDate(item.publishedAt) })}
                  </Text>
                  <View style={styles.metaInline}>
                    <Eye size={12} color={tk.text.tertiary} strokeWidth={2} />
                    <Text style={styles.meta}>
                      {t('news.categoryViewCount', { count: item.viewCount ?? 0 })}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </PressableCard>
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
    },
    /* 顶部导航行 */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: rnType.title.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    /* 列表 */
    listBody: {
      paddingHorizontal: rnSpacing.lg,
      paddingBottom: rnSpacing['3xl'],
    },
    subtitle: {
      marginBottom: rnSpacing.sm,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    separator: {
      height: rnSpacing.sm,
    },
    card: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    cardRow: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
    },
    /* web 是 h-24 w-40(约 96×160dp),RN 收窄成 96×68 保住标题两行的高度 */
    cover: {
      width: 96,
      height: 68,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    coverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: {
      flex: 1,
      flexShrink: 1,
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    pinBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.light,
    },
    pinText: {
      fontSize: rnType.caption.size,
      color: tk.brand.DEFAULT,
    },
    cardTitle: {
      flexShrink: 1,
      fontSize: rnType.body.size,
      fontWeight: '500',
      color: tk.text.primary,
    },
    summary: {
      marginTop: 2,
      fontSize: rnType.caption.size,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    metaRow: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    metaInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    meta: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    footer: {
      paddingVertical: rnSpacing.lg,
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    footerText: {
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
