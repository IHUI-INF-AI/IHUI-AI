// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useMemo } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { TFunction } from '../../types'

/** AI 世界 Tab key(工具/应用/资讯/榜单) */
export type AiWorldTab = 'tools' | 'apps' | 'news' | 'rankings'

/** AI 世界条目(卡片流)— 由 wrapper 从 /api/ai-world DTO 映射 */
export interface AiWorldEntry {
  id: string
  kind: 'news' | 'paper' | 'project' | 'tool' | 'app'
  title: string
  summary: string | null
  coverImage: string | null
  source: string
  viewCount: number
}

/** 榜单条目 — 由 wrapper 从 /api/ai-world/rankings DTO 映射(votes 提前自 scores.votes) */
export interface AiWorldRankingItem {
  id: string
  rank: number
  modelName: string
  provider: string | null
  score: string | null
  votes: number | null
}

/** 条目分类 chip(feed.categories) */
export interface AiWorldCategoryOption {
  id: string
  name: string
  slug: string
}

/** 通用横向 chip(榜单 leaderboard / 分类) */
export interface AiWorldChipOption {
  key: string
  label: string
}

/** AiWorldScreen props(wrapper 注入数据+回调) */
export interface AiWorldScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 首屏加载中(loading && !feed) */
  loading: boolean
  /** 条目 pane 下拉刷新中 */
  refreshing: boolean
  /** 搜索/分类过滤请求进行中 */
  filterLoading: boolean
  /** 主 feed 加载错误(非空显示整屏错误+重试) */
  error: string
  tab: AiWorldTab
  onSwitchTab: (tab: AiWorldTab) => void
  onBack: () => void
  /** 收藏/浏览历史入口(占位,接入路由后由 wrapper 注入) */
  onPressFavorites?: () => void
  onPressHistory?: () => void
  /** 条目 pane:搜索词(受控) */
  search: string
  onSearchChange: (v: string) => void
  filterActive: boolean
  onClearFilter: () => void
  categories: AiWorldCategoryOption[]
  activeCategorySlug: string | null
  onSelectCategory: (slug: string | null) => void
  items: AiWorldEntry[]
  onRefresh: () => void
  /** 榜单 pane */
  leaderboards: AiWorldChipOption[]
  activeLeaderboard: string
  onSelectLeaderboard: (key: string) => void
  rankCategories: AiWorldChipOption[]
  activeRankCategory: string
  onSelectRankCategory: (key: string) => void
  rankings: AiWorldRankingItem[]
  rankLoading: boolean
  rankError: string
  onRetryRankings: () => void
  /** 主 feed 重试 */
  onRetry: () => void
}

const TABS: readonly AiWorldTab[] = ['tools', 'apps', 'news', 'rankings']

/** 触控扩展热区(对齐原屏 hitSlop) */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

/**
 * AiWorldScreen AI 世界(共享层)
 *
 * 2026-09-15 承接 mobile-rn AiWorldScreen 1:1 迁移(Web 对应路由 /ai-world*):
 * - 结构:顶栏(返回/标题/收藏+浏览历史入口)→ Tab(工具/应用/资讯/榜单)
 *   → 条目 pane(搜索框 + 分类 chips + FlatList 卡片流)
 *   | 榜单 pane(leaderboard chips + 分类 chips + 排行榜列表)
 * - 平台无关:API(fetchApi /api/ai-world*)、搜索防抖、导航由 wrapper 注入
 * - 样式:getTokens(colorScheme) 语义 token(零 hex)
 * - i18n:沿用 aiWorld.*(mobile-rn i18n 既有 key)
 */
export function AiWorldScreen({
  t,
  colorScheme = 'light',
  loading,
  refreshing,
  filterLoading,
  error,
  tab,
  onSwitchTab,
  onBack,
  onPressFavorites,
  onPressHistory,
  search,
  onSearchChange,
  filterActive,
  onClearFilter,
  categories,
  activeCategorySlug,
  onSelectCategory,
  items,
  onRefresh,
  leaderboards,
  activeLeaderboard,
  onSelectLeaderboard,
  rankCategories,
  activeRankCategory,
  onSelectRankCategory,
  rankings,
  rankLoading,
  rankError,
  onRetryRankings,
  onRetry,
}: AiWorldScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>{t('common.loading')}</Text>
      </View>
    )
  }

  // 分类 chips:「全部」+ feed.categories(原屏在共享层内组装)
  const categoryChips: AiWorldCategoryOption[] = [
    { id: '__all__', name: t('aiWorld.categoryAll'), slug: '' },
    ...categories,
  ]

  return (
    <View style={styles.container}>
      {/* 顶栏:返回 + 标题 + 收藏/浏览历史入口 */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} hitSlop={HIT_SLOP}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('aiWorld.title')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onPressFavorites} hitSlop={HIT_SLOP}>
            <Text style={styles.headerActionText}>{t('aiWorld.favorites')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPressHistory} hitSlop={HIT_SLOP}>
            <Text style={styles.headerActionText}>{t('aiWorld.history')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab:工具 / 应用 / 资讯 / 榜单 */}
      <View style={styles.tabRow}>
        {TABS.map((key) => {
          const active = key === tab
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tabChip, active ? styles.tabChipActive : null]}
              onPress={() => onSwitchTab(key)}
            >
              <Text style={active ? styles.tabTextActive : styles.tabText}>
                {t(`aiWorld.${key}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'rankings' ? (
        <View style={styles.pane}>
          {/* leaderboard 横向 chips */}
          <View style={styles.filterSection}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipList}
              contentContainerStyle={styles.chipRow}
              data={leaderboards}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <Chip
                  label={item.label}
                  active={item.key === activeLeaderboard}
                  styles={styles}
                  onPress={() => onSelectLeaderboard(item.key)}
                />
              )}
            />
            {rankCategories.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipListSpaced}
                contentContainerStyle={styles.chipRow}
                data={rankCategories}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                  <Chip
                    label={item.label}
                    active={item.key === activeRankCategory}
                    styles={styles}
                    onPress={() => onSelectRankCategory(item.key)}
                  />
                )}
              />
            ) : null}
          </View>
          {rankError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{rankError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRetryRankings}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={rankings}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={rankLoading}
                  onRefresh={onRetryRankings}
                  tintColor={colorScheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
                />
              }
              ListEmptyComponent={
                rankLoading ? null : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>{t('aiWorld.rankEmpty')}</Text>
                  </View>
                )
              }
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <RankingRow item={item} t={t} styles={styles} />}
            />
          )}
        </View>
      ) : (
        <View style={styles.pane}>
          {/* 搜索 + 分类 chips(仅条目 Tab) */}
          <View style={styles.filterSection}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={onSearchChange}
                placeholder={t('aiWorld.searchPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                returnKeyType="search"
              />
              {filterActive || filterLoading ? (
                <TouchableOpacity onPress={onClearFilter} hitSlop={HIT_SLOP}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {categories.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipListSpaced}
                contentContainerStyle={styles.chipRow}
                data={categoryChips}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Chip
                    label={item.name}
                    active={item.slug === (activeCategorySlug ?? '')}
                    styles={styles}
                    onPress={() => onSelectCategory(item.slug || null)}
                  />
                )}
              />
            ) : null}
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || filterLoading}
                onRefresh={onRefresh}
                tintColor={colorScheme === 'dark' ? tk.text.tertiary : tk.text.secondary}
              />
            }
            ListEmptyComponent={
              filterLoading ? null : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{t('aiWorld.empty')}</Text>
                  <Text style={styles.emptyHint}>{t('aiWorld.emptyHint')}</Text>
                </View>
              )
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <EntryCard item={item} t={t} styles={styles} />}
          />
        </View>
      )}
    </View>
  )
}

// ── 私有子组件 ──

type AiWorldStyles = ReturnType<typeof createStyles>

/** 通用横向 chip(分类/榜单) */
function Chip({
  label,
  active,
  styles,
  onPress,
}: {
  label: string
  active: boolean
  styles: AiWorldStyles
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? styles.chipActive : null]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={active ? styles.chipTextActive : styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

/** 条目卡片:封面(64dp)+ 标题/摘要/浏览数+来源 */
function EntryCard({
  item,
  t,
  styles,
}: {
  item: AiWorldEntry
  t: TFunction
  styles: AiWorldStyles
}) {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryRow}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={styles.entryCover} />
        ) : (
          <View style={[styles.entryCoverFallback, styles.entryCoverBg]}>
            <Text style={styles.coverFallbackText}>{t('aiWorld.kindLabel')}</Text>
          </View>
        )}
        <View style={styles.entryBody}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.summary ? (
            <Text style={styles.entrySummary} numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.entryMetaRow}>
            <Text style={styles.entryMeta}>
              {item.viewCount} {t('aiWorld.viewCount')}
            </Text>
            {item.source ? <Text style={styles.entryMeta}>@{item.source}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  )
}

/** 榜单行:排名徽章(前 3 金色高亮)+ 模型/厂商 + 分数/票数 */
function RankingRow({
  item,
  t,
  styles,
}: {
  item: AiWorldRankingItem
  t: TFunction
  styles: AiWorldStyles
}) {
  const top3 = item.rank <= 3
  return (
    <View style={styles.rankCard}>
      <View style={[styles.rankBadge, top3 ? styles.rankBadgeTop3 : styles.rankBadgeNormal]}>
        <Text style={top3 ? styles.rankTextTop3 : styles.rankTextNormal}>{item.rank}</Text>
      </View>
      <View style={styles.rankBody}>
        <Text style={styles.rankModel} numberOfLines={1}>
          {item.modelName}
        </Text>
        {item.provider ? (
          <Text style={styles.rankProvider} numberOfLines={1}>
            {item.provider}
          </Text>
        ) : null}
      </View>
      <View style={styles.rankScoreCol}>
        {item.score ? <Text style={styles.rankScore}>{Number(item.score).toFixed(1)}</Text> : null}
        {item.votes !== null && Number.isFinite(item.votes) ? (
          <Text style={styles.rankVotes}>
            {item.votes.toLocaleString()} {t('aiWorld.votes')}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/**
 * 样式:对齐原屏 NativeWind 尺寸(xxx-2 → dp,py-1.5 → 6 等),全部颜色走
 * AppThemeTokens 语义 token,零 hex。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    pane: {
      flex: 1,
    },
    /* 顶栏 */
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
      flexShrink: 1,
      marginHorizontal: 8,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    headerActionText: {
      fontSize: 14,
      color: tk.brand.DEFAULT,
    },
    /* Tab 行 */
    tabRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    tabChip: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    tabChipActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    tabText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    tabTextActive: {
      fontSize: 14,
      color: tk.surface.light,
    },
    /* 过滤区(搜索/分类/榜单 chips) */
    filterSection: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    searchInput: {
      height: 36,
      flex: 1,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.light,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    cancelText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    chipList: {
      flexGrow: 0,
    },
    chipListSpaced: {
      flexGrow: 0,
      marginTop: 8,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chip: {
      borderRadius: rnRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: tk.surface.muted,
    },
    chipActive: {
      backgroundColor: tk.brand.DEFAULT,
    },
    chipText: {
      fontSize: 12,
      color: tk.text.secondary,
    },
    chipTextActive: {
      fontSize: 12,
      color: tk.surface.light,
    },
    /* 列表 */
    listContent: {
      padding: 16,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      fontSize: 14,
      color: tk.text.secondary,
    },
    emptyHint: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 条目卡片 */
    entryCard: {
      marginBottom: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      padding: 12,
    },
    entryRow: {
      flexDirection: 'row',
    },
    entryCover: {
      width: 64,
      height: 64,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
    },
    entryCoverFallback: {
      width: 64,
      height: 64,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryCoverBg: {
      backgroundColor: tk.surface.muted,
    },
    coverFallbackText: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    entryBody: {
      marginLeft: 12,
      flex: 1,
    },
    entryTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: tk.text.primary,
    },
    entrySummary: {
      marginTop: 4,
      fontSize: 12,
      color: tk.text.secondary,
    },
    entryMetaRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    entryMeta: {
      fontSize: 12,
      color: tk.text.tertiary,
    },
    /* 榜单行 */
    rankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: rnRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankBadgeTop3: {
      backgroundColor: tk.warning.amberLight,
    },
    rankBadgeNormal: {
      backgroundColor: tk.surface.muted,
    },
    rankTextTop3: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.warning.amber,
    },
    rankTextNormal: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.secondary,
    },
    rankBody: {
      marginLeft: 12,
      flex: 1,
    },
    rankModel: {
      fontSize: 14,
      fontWeight: '500',
      color: tk.text.primary,
    },
    rankProvider: {
      marginTop: 2,
      fontSize: 12,
      color: tk.text.tertiary,
    },
    rankScoreCol: {
      marginLeft: 8,
      alignItems: 'flex-end',
    },
    rankScore: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.warning.DEFAULT,
    },
    rankVotes: {
      marginTop: 2,
      fontSize: 11,
      color: tk.text.tertiary,
    },
    /* 错误/重试 */
    errorWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      marginBottom: 12,
      textAlign: 'center',
      fontSize: 14,
      color: tk.text.secondary,
    },
    retryBtn: {
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    retryText: {
      fontSize: 14,
      color: tk.text.primary,
    },
  } satisfies Record<string, ViewStyle | TextStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
