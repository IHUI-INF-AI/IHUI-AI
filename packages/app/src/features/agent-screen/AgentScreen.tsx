// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Camera } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentScreenProps, AgentScreenItem } from '../../types'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { CategoryInlineBar } from '../../components/category/CategoryInlineBar'
import type { CategoryItem } from '../../components/category/types'
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '../../components/ScreenStates'
import { SearchInput } from '../../components/SearchInput'
import { assertRequiredPort } from '../../host/ports'

/** Agent 列表共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { AgentScreenProps }

function getInitial(name: string): string {
  return name?.trim().charAt(0)?.toUpperCase() || '?'
}

/** 本地分类键(小程序智能体列表页那排分类 chip 的同一套口径,默认落在「推荐」= 不过滤) */
type AgentCategoryKey = 'recommend' | 'office' | 'writing' | 'coding' | 'education' | 'life'

/** chip 展示顺序(「推荐」恒在首位,选它即还原完整列表) */
const AGENT_CATEGORY_KEYS: readonly AgentCategoryKey[] = [
  'recommend',
  'office',
  'writing',
  'coding',
  'education',
  'life',
]

/**
 * chip 标签与分类关键词**都走词包**(不再端内写死中文):关键词要跟着语言走,它匹配的是
 * 当前语言下智能体的名称/描述;切语言后同一批智能体才会被归到同一类。
 * 键名用全小写点分形态 —— 转壳判据按「共享屏 `t()` 实际消费的键」取正文作用域
 * (`scripts/plan-hand-mirror-conversion.mjs` 的 `screenConsumedKeys`),只认这种形状。
 */
const AGENT_CATEGORY_LABEL_KEYS = {
  recommend: 'agents.categories.recommend',
  office: 'agents.categories.office',
  writing: 'agents.categories.writing',
  coding: 'agents.categories.coding',
  education: 'agents.categories.education',
  life: 'agents.categories.life',
} as const satisfies Record<AgentCategoryKey, string>

const AGENT_CATEGORY_KEYWORD_KEYS = {
  office: 'agents.keywords.office',
  writing: 'agents.keywords.writing',
  coding: 'agents.keywords.coding',
  education: 'agents.keywords.education',
  life: 'agents.keywords.life',
} as const satisfies Record<Exclude<AgentCategoryKey, 'recommend'>, string>

/** 词包里的关键词表以逗号分隔(半角/全角/顿号都认),统一小写后再匹配 */
function keywordsOf(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,，、]/)
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean)
}

/** 按关键词把一条智能体归到一个分类(先命中先归,与小程序同序);都不命中返回 null */
function detectCategory(
  item: AgentScreenItem,
  table: ReadonlyArray<{ id: AgentCategoryKey; keywords: string[] }>,
): AgentCategoryKey | null {
  const text = `${item.name ?? ''} ${item.description ?? ''}`.toLowerCase()
  for (const row of table) {
    if (row.keywords.some((kw) => text.includes(kw))) return row.id
  }
  return null
}

/** chip 回传的是 string,这里收窄回联合类型(只认表里那几枚,表外一律回「推荐」) */
function toCategoryKey(id: string): AgentCategoryKey {
  return AGENT_CATEGORY_KEYS.find((key) => key === id) ?? 'recommend'
}

export function AgentScreen({
  t,
  items,
  loading,
  refreshing,
  error,
  onRefresh,
  onPressItem,
  onBack,
  onRetry,
  colorScheme = 'light',
  nestedInScrollView = false,
  onNavigate,
  onEndReached,
  loadingMore,
  hasMore,
  emptyText,
  loadingText,
  loadingMoreText,
  noMoreText,
  categories,
  activeCategory,
  onSelectCategory,
  showCategoryBar = true,
  keyword,
  onKeywordChange,
  searchPlaceholder,
  onRequestPayment,
  onChooseImages,
  renderHeader,
  renderBanner,
  renderSearch,
  renderRecent,
  renderMine,
  renderListHeader,
  renderDrawer,
  renderPayModal,
  renderOverlay,
  renderFooter,
}: AgentScreenProps & { onRetry?: () => void }) {
  assertRequiredPort('onNavigate', onNavigate)

  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  /** 分类 chip 选中态(上移自小程序智能体列表页:点选只做**本地过滤**,不重新请求)。
   *  与宿主自己的「赛道 / 主分类」弹层不是同一件事:那一层是服务端分类参数(改请求),
   *  这一排是端内按关键词推断的展示分类(纯本地),两者互不覆盖,不要合并成一个状态。
   *  宿主用 `categories` 注入服务端分类时,chip 与过滤权整体交回宿主,屏内不再本地过滤。 */
  const [category, setCategory] = useState<AgentCategoryKey>('recommend')
  const categoryChips = useMemo<CategoryItem[]>(
    () =>
      categories
        ? categories.map((item) => ({ id: item.id, label: item.label }))
        : AGENT_CATEGORY_KEYS.map((id) => ({ id, label: t(AGENT_CATEGORY_LABEL_KEYS[id]) })),
    [categories, t],
  )
  const categoryKeywords = useMemo(() => {
    const rows: Array<{ id: AgentCategoryKey; keywords: string[] }> = []
    for (const id of AGENT_CATEGORY_KEYS) {
      if (id === 'recommend') continue
      rows.push({ id, keywords: keywordsOf(t(AGENT_CATEGORY_KEYWORD_KEYS[id])) })
    }
    return rows
  }, [t])
  const visibleItems = useMemo(
    () =>
      categories || category === 'recommend'
        ? items
        : items.filter((item) => detectCategory(item, categoryKeywords) === category),
    [categories, items, category, categoryKeywords],
  )
  const selectedCategory = categories ? (activeCategory ?? null) : category
  const categoryBar = showCategoryBar ? (
    <CategoryInlineBar
      items={categoryChips}
      selectedId={selectedCategory}
      onSelect={(id) => {
        if (categories) {
          onSelectCategory?.(id)
          return
        }
        setCategory(toCategoryKey(id))
      }}
      colorScheme={colorScheme}
      contentPaddingHorizontal={rnSpacing.lg}
      itemGap={rnSpacing.sm}
      style={styles.categoryBar}
      testID="agent-category-bar"
    />
  ) : null

  /** 内置搜索框(仅宿主给了受控 keyword + onKeywordChange 时渲染;过滤由宿主完成)。
   *  有 `renderSearch` 插槽时让位给宿主自有搜索区。 */
  const builtinSearch =
    renderSearch || keyword === undefined || !onKeywordChange ? null : (
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <SearchInput
            value={keyword}
            onChangeText={onKeywordChange}
            placeholder={searchPlaceholder ?? t('common.search')}
            colorScheme={colorScheme}
            voiceEnabled={false}
          />
        </View>
        {onChooseImages ? (
          <Pressable
            onPress={() => {
              void Promise.resolve(onChooseImages(1)).catch(() => undefined)
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.search')}
            style={styles.imagePickBtn}
          >
            <Camera size={18} color={tk.text.secondary} />
          </Pressable>
        ) : null}
      </View>
    )

  /** 列表底部:追加加载指示 / 到底文案 / 宿主追加内容;三样都没给时整体不渲染(旧行为不变) */
  const footer =
    !loadingMore && hasMore !== false && !renderFooter ? null : (
      <View>
        {loadingMore ? (
          <View style={styles.footerBox}>
            <Text style={styles.footerText}>{loadingMoreText ?? t('common.loadingShort')}</Text>
          </View>
        ) : null}
        {!loadingMore && hasMore === false && visibleItems.length > 0 ? (
          <View style={styles.footerBox}>
            <Text style={styles.footerText}>{noMoreText ?? t('common.noMore')}</Text>
          </View>
        ) : null}
        {renderFooter}
      </View>
    )

  /** 宿主页形态:嵌套滚动 + 至少一个宿主区块插槽。此形态下首屏加载/错误/空态
   *  必须和宿主 banner/最近/我的 并列出现在列表位,不能被整屏早退顶掉;
   *  无插槽(web / RN 现有用法)则保持原早退分支,行为零变化。 */
  const hostPageMode =
    nestedInScrollView &&
    Boolean(
      renderHeader ||
        renderBanner ||
        renderSearch ||
        renderRecent ||
        renderMine ||
        renderListHeader ||
        renderDrawer ||
        renderPayModal ||
        renderOverlay ||
        renderFooter,
    )

  if (!hostPageMode && loading && items.length === 0) {
    return (
      <View style={styles.container}>
        {loadingText ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{loadingText}</Text>
          </View>
        ) : (
          <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
        )}
      </View>
    )
  }
  if (!hostPageMode && error && items.length === 0) {
    return (
      <View style={styles.container}>
        {/* 错误态仍保留返回入口(原错误分支的返回钮语义不变) */}
        <BackChevron
          onPress={onBack}
          label={t('common.back')}
          colorScheme={colorScheme}
          style={styles.backBtn}
        />
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      </View>
    )
  }

  /** 单张 Agent 卡片(nestedInScrollView 与 FlatList renderItem 共用,样式一致) */
  const renderCard = (item: AgentScreenItem, index?: number) => (
    <PressableCard
      key={item.id ?? `idx-${index ?? 0}`}
      onPress={() => {
        // 内购条目走宿主支付端口;其余仍是点击进详情
        if (item.isPurchasable === true && onRequestPayment) {
          void onRequestPayment(item)
          return
        }
        onPressItem(item.id)
      }}
      colorScheme={colorScheme}
      style={styles.card}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
        </View>
      )}
      <View style={styles.cardMain}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isVipExclusive ? (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          ) : item.badgeText ? (
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{item.badgeText}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
        {item.useCount !== undefined || item.rating !== undefined ? (
          <Text style={styles.meta}>
            {item.useCount !== undefined
              ? `${t('agentScreen.useCount', { count: item.useCount })}`
              : ''}
            {item.useCount !== undefined && item.rating !== undefined ? ' · ' : ''}
            {item.rating !== undefined
              ? `${t('agentScreen.rating', { score: item.rating.toFixed(1) })}`
              : ''}
          </Text>
        ) : null}
      </View>
    </PressableCard>
  )

  // 嵌套模式:宿主外层已是 ScrollView,FlatList 再嵌套会触发
  // "VirtualizedLists should never be nested inside plain ScrollViews" 硬错误,
  // 改普通 View + map(带 key)平铺;数量级为单分类智能体列表,无虚拟化需求。
  // 宿主专属区块由插槽进来,本屏只负责容器与顺序:抽屉 → 顶栏 → 轮播 → 搜索 →
  // 最近 → 我的 → 分类 → 列表标题 → 列表 → 浮层 → 支付弹窗。
  if (nestedInScrollView) {
    const stateNode =
      error && visibleItems.length === 0 ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          retryLabel={t('common.retry')}
          colorScheme={colorScheme}
        />
      ) : loading && visibleItems.length === 0 ? (
        loadingText ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{loadingText}</Text>
          </View>
        ) : (
          <ScreenSkeleton variant="card" count={4} colorScheme={colorScheme} />
        )
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={emptyText ?? t('common.empty')}
          colorScheme={colorScheme}
        />
      ) : null

    return (
      <View style={styles.container}>
        {renderDrawer}
        {renderHeader}
        {renderBanner}
        {renderSearch}
        {builtinSearch}
        {renderRecent}
        {renderMine}
        {categoryBar}
        {renderListHeader}
        <View style={styles.nestedList}>
          {visibleItems.map((item, index) => renderCard(item, index))}
          {stateNode}
          {footer}
        </View>
        {renderOverlay}
        {renderPayModal}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BackChevron
        onPress={onBack}
        label={t('common.back')}
        colorScheme={colorScheme}
        style={styles.backBtn}
      />
      <Text style={styles.title}>{t('agentScreen.title')}</Text>
      {categoryBar}
      {builtinSearch}
      <FlatList
        data={visibleItems}
        keyExtractor={(item, index) => item.id ?? `idx-${index}`}
        contentContainerStyle={{ padding: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReached ? 0.5 : undefined}
        ListEmptyComponent={
          <EmptyState
            title={emptyText ?? t('common.empty')}
            colorScheme={colorScheme}
          />
        }
        ListFooterComponent={footer}
        renderItem={({ item }) => renderCard(item)}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    // nestedInScrollView 模式:对齐 FlatList 模式的 contentContainerStyle
    // (padding:rnSpacing.lg/paddingBottom:rnSpacing['3xl'])+ ItemSeparator 高度 12(用 gap 实现)
    nestedList: { gap: rnSpacing.md, padding: rnSpacing.lg, paddingBottom: rnSpacing['3xl'] },
    /** 分类 chip 条:左右留白由组件 contentPaddingHorizontal 注入(与卡片同一档),这里只管纵向 */
    categoryBar: { paddingTop: rnSpacing.sm, paddingBottom: rnSpacing.xs },
    backBtn: { paddingHorizontal: rnSpacing['sm-loose'], paddingTop: rnSpacing.md },
    title: {
      paddingHorizontal: rnSpacing['sm-loose'],
      paddingTop: rnSpacing.sm,
      paddingBottom: rnSpacing.sm,
      fontSize: rnType.heading.size,
      fontWeight: '700',
      color: tk.text.primary,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rnSpacing['md-loose'],
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    avatar: { width: 48, height: 48, borderRadius: rnRadius.xl, backgroundColor: tk.surface.muted },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: rnRadius.xl,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: rnType.heading.size, fontWeight: '600', color: tk.text.secondary },
    cardMain: { flex: 1, marginLeft: rnSpacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['xs-loose'] },
    name: { flex: 1, fontSize: rnType.title.size, fontWeight: '600', color: tk.text.primary },
    vipBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.warning.DEFAULT,
    },
    vipText: { fontSize: rnType.badge.size, fontWeight: '600', color: tk.surface.light },
    /** 通用小标签(分类名等;与 VIP 徽标同位,样式取中性档) */
    tagBadge: {
      paddingHorizontal: rnSpacing['xs-loose'],
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    tagText: { fontSize: rnType.badge.size, fontWeight: '600', color: tk.text.secondary },
    desc: {
      marginTop: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.secondary,
      lineHeight: 18,
    },
    meta: { marginTop: rnSpacing.sm, fontSize: rnType.caption.size, color: tk.text.tertiary },
    /** 内置搜索行(仅宿主注入受控 keyword 时出现) */
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      paddingHorizontal: rnSpacing.lg,
      paddingTop: rnSpacing.sm,
    },
    searchField: { flex: 1 },
    imagePickBtn: { padding: rnSpacing.sm },
    /** 首屏加载文字态(宿主给 loadingText 时替代骨架屏) */
    stateBox: { alignItems: 'center', paddingVertical: rnSpacing['3xl'] },
    stateText: { fontSize: rnType.body.size, color: tk.text.tertiary },
    /** 分页底部(追加加载 / 到底文案) */
    footerBox: { alignItems: 'center', paddingVertical: rnSpacing.md },
    footerText: { fontSize: rnType.caption.size, color: tk.text.tertiary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
