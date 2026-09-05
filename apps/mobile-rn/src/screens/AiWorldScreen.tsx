// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'
type TabKey = 'tools' | 'apps' | 'news' | 'rankings'

/** 分条目端点 GET /api/ai-world/{tools|apps|news} 的分页响应 */
interface PaginatedItems {
  items: AiWorldEntry[]
  total: number
  limit: number
  offset: number
}

/** 榜单端点 GET /api/ai-world/rankings 响应条目 */
interface AiWorldRanking {
  id: string
  leaderboard: string
  category: string
  rank: number
  modelName: string
  provider: string | null
  score: string | null
  scores: Record<string, unknown> | null
  publishedAt: string | null
  fetchedAt: string | null
}

/** GET /api/ai-world/rankings/leaderboards 响应 */
interface LeaderboardInfo {
  leaderboard: string
  categories: string[]
}

/**
 * AI 世界条目 — 对齐后端 GET /api/ai-world 的 DTO 字段
 * (packages/api-client 旧 AiWorldItem 字段为 name/description/cover,与后端不一致,故端内声明)
 */
interface AiWorldEntry {
  id: string
  kind: ItemKind
  categoryId: string | null
  title: string
  summary: string | null
  url: string | null
  coverImage: string | null
  source: string
  sourceUrl: string | null
  publishedAt: string | null
  fetchedAt: string | null
  metadata: Record<string, unknown> | null
  viewCount: number
  likeCount: number
  trendingScore: number | null
  trendingMetrics: Record<string, unknown> | null
  trendingUpdatedAt: string | null
}

interface AiWorldCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort: number
}

interface AiWorldFeed {
  categories: AiWorldCategory[]
  tools: AiWorldEntry[]
  apps: AiWorldEntry[]
  news: AiWorldEntry[]
}

const TABS: readonly TabKey[] = ['tools', 'apps', 'news', 'rankings']

/** 各条目 Tab 对应的 REST 端点(榜单走独立端点) */
const KIND_ENDPOINT: Record<Exclude<TabKey, 'rankings'>, string> = {
  tools: '/api/ai-world/tools',
  apps: '/api/ai-world/apps',
  news: '/api/ai-world/news',
}

/** 搜索提交去抖(ms) */
const SEARCH_DEBOUNCE_MS = 400

function Chip({
  label,
  active,
  dark,
  onPress,
}: {
  label: string
  active: boolean
  dark: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`mr-2 rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : dark ? 'bg-neutral-800' : 'bg-gray-100'}`}
    >
      <Text className={`text-xs ${active ? 'text-white' : dark ? 'text-neutral-300' : 'text-gray-600'}`} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function SearchInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#9ca3af"
      {...props}
      className={`mr-3 h-9 flex-1 rounded-md border border-gray-200 px-3 text-sm dark:border-neutral-700 dark:text-neutral-100 ${props.className ?? ''}`}
    />
  )
}

export function AiWorldScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [feed, setFeed] = useState<AiWorldFeed | null>(null)
  const [tab, setTab] = useState<TabKey>('tools')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // —— 条目筛选/搜索(tools/apps/news) ——
  const [search, setSearch] = useState('')
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null)
  const [filteredItems, setFilteredItems] = useState<AiWorldEntry[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // —— 榜单 ——
  const [leaderboards, setLeaderboards] = useState<LeaderboardInfo[]>([])
  const [activeLeaderboard, setActiveLeaderboard] = useState('lmsys')
  const [activeRankCategory, setActiveRankCategory] = useState('overall')
  const [rankings, setRankings] = useState<AiWorldRanking[]>([])
  const [rankLoading, setRankLoading] = useState(false)
  const [rankError, setRankError] = useState('')

  const dark = resolvedTheme === 'dark'

  // 无搜索/分类筛选时,按当前 Tab 从一次拉取的 feed 中取条目(切换 Tab 不发请求)
  const feedItems = useMemo<AiWorldEntry[]>(() => {
    if (!feed) return []
    if (tab === 'apps') return feed.apps
    if (tab === 'news') return feed.news
    if (tab === 'tools') return feed.tools
    return []
  }, [feed, tab])

  const items = filteredItems ?? feedItems

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AiWorldFeed>('/api/ai-world')
      if (res.success) setFeed(res.data)
      else setError(res.error || t('aiWorld.loadFailed'))
    } catch {
      setError(t('aiWorld.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // —— 榜单数据:leaderboard/category 变化即拉取 ——
  const loadRankings = useCallback(async (lb: string, cat: string) => {
    setRankLoading(true)
    setRankError('')
    try {
      const res = await fetchApi<{ items: AiWorldRanking[] }>(
        `/api/ai-world/rankings?leaderboard=${encodeURIComponent(lb)}&category=${encodeURIComponent(cat)}&limit=100`,
      )
      if (!res.success) throw new Error(res.error)
      setRankings(res.data.items)
    } catch {
      setRankError(t('aiWorld.rankLoadFailed'))
      setRankings([])
    } finally {
      setRankLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (tab !== 'rankings') return
    void loadRankings(activeLeaderboard, activeRankCategory)
  }, [tab, activeLeaderboard, activeRankCategory, loadRankings])

  // 初次进入榜单 tab 时拉 leaderboards 元数据,并把 category 校正到有效值
  useEffect(() => {
    if (tab !== 'rankings' || leaderboards.length > 0) return
    void (async () => {
      try {
        const res = await fetchApi<{ leaderboards: LeaderboardInfo[] }>(
          '/api/ai-world/rankings/leaderboards',
        )
        if (!res.success) return
        setLeaderboards(res.data.leaderboards)
        const current = res.data.leaderboards.find((l) => l.leaderboard === activeLeaderboard)
        if (current && !current.categories.includes(activeRankCategory)) {
          setActiveRankCategory(current.categories[0] ?? 'overall')
        }
      } catch {
        // 元数据失败不阻塞:rankings 端点仍可用默认 lmsys/overall
      }
    })()
  }, [tab, leaderboards.length, activeLeaderboard, activeRankCategory])

  // —— 搜索/分类:防抖调分条目端点;清空则回到 feed 模式 ——
  useEffect(() => {
    if (tab === 'rankings') return
    if (!search.trim() && !activeCategorySlug) {
      setFilteredItems(null)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const kind = tab as Exclude<TabKey, 'rankings'>
    debounceRef.current = setTimeout(() => {
      setFilterLoading(true)
      void (async () => {
        try {
          const params = new URLSearchParams({ limit: '50' })
          if (search.trim()) params.set('search', search.trim())
          if (activeCategorySlug) params.set('category', activeCategorySlug)
          const res = await fetchApi<PaginatedItems>(`${KIND_ENDPOINT[kind]}?${params.toString()}`)
          if (res.success) setFilteredItems(res.data.items)
          else setFilteredItems([])
        } catch {
          setFilteredItems([])
        } finally {
          setFilterLoading(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, activeCategorySlug, tab])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setSearch('')
    setActiveCategorySlug(null)
    void load()
  }, [load])

  const switchTab = (next: TabKey) => {
    setTab(next)
    setSearch('')
    setActiveCategorySlug(null)
    setFilteredItems(null)
  }

  const activeLbCategories = useMemo(
    () => leaderboards.find((l) => l.leaderboard === activeLeaderboard)?.categories ?? [],
    [leaderboards, activeLeaderboard],
  )

  const renderRanking = ({ item }: { item: AiWorldRanking }) => {
    const votes =
      item.scores && typeof item.scores === 'object' && 'votes' in item.scores
        ? Number((item.scores as Record<string, unknown>).votes)
        : null
    return (
      <View className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800">
        <View
          className={`h-8 w-8 items-center justify-center rounded-md ${
            item.rank <= 3 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-neutral-700'
          }`}
        >
          <Text className={`text-sm font-semibold ${item.rank <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
            {item.rank}
          </Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-medium" numberOfLines={1}>
            {item.modelName}
          </Text>
          {item.provider ? (
            <Text className="mt-0.5 text-xs text-gray-400" numberOfLines={1}>
              {item.provider}
            </Text>
          ) : null}
        </View>
        <View className="ml-2 items-end">
          {item.score ? (
            <Text className="text-sm font-semibold text-blue-600">{Number(item.score).toFixed(1)}</Text>
          ) : null}
          {votes !== null && Number.isFinite(votes) ? (
            <Text className="mt-0.5 text-[11px] text-gray-400">
              {votes.toLocaleString()} {t('aiWorld.votes')}
            </Text>
          ) : null}
        </View>
      </View>
    )
  }

  if (loading && !feed) {
    return (
      <View
        className={`flex-1 items-center justify-center ${dark ? 'bg-neutral-900' : 'bg-white'}`}
      >
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  const filterActive = Boolean(search.trim() || activeCategorySlug)

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* 顶栏:返回 + 标题 + 收藏/浏览历史入口(占位按钮,路由后续接入) */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('aiWorld.title')}</Text>
        <View className="flex-row gap-3">
          <Text className="text-sm text-blue-600">{t('aiWorld.favorites')}</Text>
          <Text className="text-sm text-blue-600">{t('aiWorld.history')}</Text>
        </View>
      </View>

      {/* Tab:工具 / 应用 / 资讯 / 榜单 */}
      <View className="flex-row gap-2 px-4 pb-2">
        {TABS.map((key) => {
          const active = key === tab
          return (
            <TouchableOpacity
              key={key}
              onPress={() => switchTab(key)}
              className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : ''}`}
            >
              <Text className={`text-sm ${active ? 'text-white' : 'text-gray-500'}`}>
                {t(`aiWorld.${key}`)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-sm text-gray-500">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true)
              void load()
            }}
            className="rounded-md bg-gray-200 px-4 py-2"
          >
            <Text className="text-sm">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'rankings' ? (
        <View className="flex-1">
          {/* leaderboard 横向 chips */}
          <View className="px-4 pb-2">
            <View className="flex-row">
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={leaderboards.length > 0 ? leaderboards : [{ leaderboard: 'lmsys', categories: [] }]}
                keyExtractor={(item) => item.leaderboard}
                renderItem={({ item }) => (
                  <Chip
                    label={item.leaderboard}
                    active={item.leaderboard === activeLeaderboard}
                    dark={dark}
                    onPress={() => {
                      setActiveLeaderboard(item.leaderboard)
                      const cats = item.categories
                      if (cats.length > 0 && !cats.includes(activeRankCategory)) {
                        setActiveRankCategory(cats[0] ?? 'overall')
                      }
                    }}
                  />
                )}
              />
            </View>
            {activeLbCategories.length > 0 ? (
              <View className="mt-2 flex-row">
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={activeLbCategories}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <Chip
                      label={item}
                      active={item === activeRankCategory}
                      dark={dark}
                      onPress={() => setActiveRankCategory(item)}
                    />
                  )}
                />
              </View>
            ) : null}
          </View>
          {rankError ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="mb-3 text-center text-sm text-gray-500">{rankError}</Text>
              <TouchableOpacity
                onPress={() => void loadRankings(activeLeaderboard, activeRankCategory)}
                className="rounded-md bg-gray-200 px-4 py-2"
              >
                <Text className="text-sm">{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={rankings}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={rankLoading}
                  onRefresh={() => void loadRankings(activeLeaderboard, activeRankCategory)}
                  tintColor={dark ? tokens.text.tertiary : tokens.text.secondary}
                />
              }
              ListEmptyComponent={
                rankLoading ? null : (
                  <View className="items-center py-16">
                    <Text className="text-sm text-gray-500">{t('aiWorld.rankEmpty')}</Text>
                  </View>
                )
              }
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderRanking}
            />
          )}
        </View>
      ) : (
        <View className="flex-1">
          {/* 搜索 + 分类 chips(仅条目 Tab) */}
          <View className="px-4 pb-2">
            <View className="flex-row items-center">
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('aiWorld.searchPlaceholder')}
                returnKeyType="search"
              />
              {filterActive || filterLoading ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearch('')
                    setActiveCategorySlug(null)
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-sm text-gray-500">{t('common.cancel')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {feed && feed.categories.length > 0 ? (
              <View className="mt-2 flex-row">
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={[{ id: '__all__', name: t('aiWorld.categoryAll'), slug: '' }, ...feed.categories]}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Chip
                      label={item.name}
                      active={item.slug === (activeCategorySlug ?? '')}
                      dark={dark}
                      onPress={() => setActiveCategorySlug(item.slug || null)}
                    />
                  )}
                />
              </View>
            ) : null}
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing || filterLoading}
                onRefresh={onRefresh}
                tintColor={dark ? tokens.text.tertiary : tokens.text.secondary}
              />
            }
            ListEmptyComponent={
              filterLoading ? null : (
                <View className="items-center py-16">
                  <Text className="text-sm text-gray-500">{t('aiWorld.empty')}</Text>
                  <Text className="mt-1 text-xs text-gray-400">{t('aiWorld.emptyHint')}</Text>
                </View>
              )
            }
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
                <View className="flex-row">
                  {item.coverImage ? (
                    <Image
                      source={{ uri: item.coverImage }}
                      style={{ width: 64, height: 64, borderRadius: 8 }}
                    />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded-md bg-gray-100 dark:bg-neutral-700">
                      <Text className="text-xs text-gray-400">{t('aiWorld.kindLabel')}</Text>
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-medium" numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text className="mt-1 text-xs text-gray-500" numberOfLines={2}>
                        {item.summary}
                      </Text>
                    ) : null}
                    <View className="mt-2 flex-row items-center gap-3">
                      <Text className="text-xs text-gray-400">
                        {item.viewCount} {t('aiWorld.viewCount')}
                      </Text>
                      {item.source ? (
                        <Text className="text-xs text-gray-400">@{item.source}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
