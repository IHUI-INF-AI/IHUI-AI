// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Search } from 'lucide-react-native'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import type {
  KnowledgeBaseCategoryItem,
  KnowledgeBaseListItem,
  KnowledgeBaseListScreenProps,
} from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'

export type { KnowledgeBaseCategoryItem, KnowledgeBaseListItem, KnowledgeBaseListScreenProps }

/** 首屏骨架卡数量(同 LecturerListScreen 的观感口径) */
const SKELETON_COUNT = 4
/** 搜索去抖(与 web PageClient 的 300ms 同口径,避免每敲一字发一次请求) */
const SEARCH_DEBOUNCE_MS = 300

/**
 * KnowledgeBaseListScreen 知识库文章列表(共享层)。
 *
 * 承载 web `/knowledge-base`(apps/web/app/(main)/knowledge-base/PageClient.tsx):
 * - 结构:顶部导航行(返回 + 标题)→ 搜索框 + 分类横排(含「全部」)→ 文章卡列表 → 加载更多
 * - 取数全在宿主:`GET /api/knowledge-base?page&pageSize&categoryId&search` 与
 *   `GET /api/knowledge-base/categories`;本屏只做呈现 + 回调(分类 id 原样回吐,含 'all' 哨兵)
 * - 三态:首屏骨架(header 常驻)→ 错误态(重试)→ 空态(刷新);下拉刷新与上拉加载更多并存
 * - 样式:getTokens(colorScheme) 语义 token(零 hex),间距走 rnSpacing/rnType/rnRadius
 * - i18n:knowledgeBase.*(与 web 同键)+ common.search / common.retry / common.back
 *
 * ⚠️ 域边界:本屏读 `knowledge_base` 表(带分类/作者/更新时间),与 RAG 文档列表
 * (`apps/mobile-rn/src/screens/KnowledgeBaseScreen.tsx` → `/api/knowledge/docs`)是两个域;
 * 那个屏的 id 传到这里会取不到条目,别把两者当同一物的两种形态。
 */
export function KnowledgeBaseListScreen({
  t,
  items,
  categories,
  activeCategoryId,
  search,
  total,
  loading,
  refreshing,
  loadingMore,
  hasMore,
  error,
  onBack,
  onSelect,
  onCategoryChange,
  onSearchChange,
  onRefresh,
  onRetry,
  onLoadMore,
  colorScheme = 'light',
}: KnowledgeBaseListScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 输入框即时值:去抖后才回调宿主(回吐的生效值变了也要同步回输入框,如宿主清空筛选) */
  const [keyword, setKeyword] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncedRef = useRef(search)

  useEffect(() => {
    if (search === syncedRef.current) return
    syncedRef.current = search
    setKeyword(search)
  }, [search])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const onKeywordChange = (text: string) => {
    setKeyword(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      syncedRef.current = text
      onSearchChange(text)
    }, SEARCH_DEBOUNCE_MS)
  }

  /** 首屏骨架:只在「首次加载且一行都没有」时占屏,已加载过的刷新不闪骨架 */
  const showSkeleton = loading && items.length === 0
  /** 错误态:手里有旧数据时保留旧列表,不把用户已读内容抖掉 */
  const showError = !loading && error.length > 0 && items.length === 0

  const chips: { id: string; name: string; count?: number }[] = [
    { id: 'all', name: t('knowledgeBase.allCategories'), count: total },
    ...categories,
  ]

  return (
    <View style={styles.container}>
      {/* header 常驻:加载/错误也不连导航一起消失 */}
      <View style={styles.headerBar}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('knowledgeBase.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {showSkeleton ? (
        <ScreenSkeleton variant="card" count={SKELETON_COUNT} colorScheme={colorScheme} />
      ) : showError ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : (
        <FlatList<KnowledgeBaseListItem>
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listBody}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tk.text.secondary}
            />
          }
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (hasMore && !loadingMore && !loading) onLoadMore()
          }}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.searchWrap}>
                <Search size={16} color={tk.text.tertiary} strokeWidth={2} />
                <TextField
                  colorScheme={colorScheme}
                  style={styles.searchInput}
                  value={keyword}
                  onChangeText={onKeywordChange}
                  placeholder={t('common.searchPlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  returnKeyType="search"
                  accessibilityLabel={t('common.search')}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {chips.map((chip) => {
                  const active = chip.id === activeCategoryId
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      onPress={() => onCategoryChange(chip.id)}
                      accessibilityRole="button"
                      accessibilityLabel={chip.name}
                    >
                      <Text
                        style={[styles.chipText, active ? styles.chipTextActive : null]}
                        numberOfLines={1}
                      >
                        {typeof chip.count === 'number' ? `${chip.name} ${chip.count}` : chip.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              glyph="◎"
              title={t('knowledgeBase.empty')}
              actionLabel={t('common.retry')}
              onAction={onRefresh}
              colorScheme={colorScheme}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={tk.text.tertiary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PressableCard
              style={styles.card}
              onPress={() => onSelect(item)}
              colorScheme={colorScheme}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.summary ? (
                <Text style={styles.cardSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <View style={styles.cardMeta}>
                  {item.categoryName ? (
                    <Text style={styles.categoryBadge} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                  ) : null}
                  {item.authorName ? (
                    <Text style={styles.metaText} numberOfLines={1}>
                      {item.authorName}
                    </Text>
                  ) : null}
                </View>
                {item.updatedAt ? (
                  <Text style={styles.metaText}>{fitDate(item.updatedAt)}</Text>
                ) : null}
              </View>
            </PressableCard>
          )}
        />
      )}
    </View>
  )
}

/** ISO → `YYYY-MM-DD`(与本包其它屏的短日期口径一致;解析不了就原样回,不造 '-' 假值) */
function fitDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${String(d.getFullYear())}-${mm}-${dd}`
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    /* 顶部导航行 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: rnSpacing.md,
      paddingTop: rnSpacing.md,
      paddingBottom: rnSpacing.sm,
    },
    headerTitle: {
      flexShrink: 1,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    headerSpacer: {
      width: 32,
    },
    /* 列表头(搜索 + 分类横排) */
    listBody: {
      paddingHorizontal: rnSpacing.md,
      paddingBottom: rnSpacing['3xl'],
    },
    listHeader: {
      paddingTop: rnSpacing.xs,
      paddingBottom: rnSpacing.md,
      gap: rnSpacing.sm,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.md,
      height: 36,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    searchInput: {
      flex: 1,
      padding: 0,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    chipRow: {
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
    },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      flexShrink: 0,
    },
    chipActive: {
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.brandAccent.light,
    },
    chipText: {
      fontSize: rnType.label.size,
      color: tk.text.secondary,
    },
    chipTextActive: {
      color: tk.brandAccent.foreground,
      fontWeight: '600',
    },
    /* 文章卡 */
    card: {
      padding: rnSpacing.md,
      marginBottom: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.xs,
    },
    cardTitle: {
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    cardSummary: {
      fontSize: rnType.label.size,
      lineHeight: 18,
      color: tk.text.secondary,
    },
    cardFooter: {
      marginTop: rnSpacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      flexShrink: 1,
    },
    categoryBadge: {
      flexShrink: 0,
      paddingHorizontal: rnSpacing.xs,
      paddingVertical: 1,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.caption.size,
      color: tk.text.secondary,
    },
    metaText: {
      flexShrink: 0,
      fontSize: rnType.caption.size,
      color: tk.text.tertiary,
    },
    footer: {
      paddingVertical: rnSpacing.md,
      alignItems: 'center',
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
