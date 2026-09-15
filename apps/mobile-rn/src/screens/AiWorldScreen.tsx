// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AiWorldScreen AI 世界页(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app AiWorldScreen
 * (Web 对应路由 /ai-world*),本 wrapper 仅保留平台特定职责:
 * - 数据:fetchApi(/api/ai-world、/api/ai-world/{tools|apps|news}、/api/ai-world/rankings*)
 * - 搜索/分类:防抖调分条目端点,清空回 feed 模式(切 Tab 不发请求)
 * - 榜单:leaderboard/category 变化即拉取,初次进入拉 leaderboards 元数据并校正 category
 * - 导航 goBack;主题色 / i18n 注入
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  AiWorldScreen as SharedAiWorldScreen,
  type AiWorldEntry,
  type AiWorldRankingItem,
  type AiWorldTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 分条目端点 GET /api/ai-world/{tools|apps|news} 的分页响应 */
interface PaginatedItems {
  items: AiWorldEntryDto[]
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
interface AiWorldEntryDto {
  id: string
  kind: AiWorldEntry['kind']
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
  tools: AiWorldEntryDto[]
  apps: AiWorldEntryDto[]
  news: AiWorldEntryDto[]
}

/** 各条目 Tab 对应的 REST 端点(榜单走独立端点) */
const KIND_ENDPOINT: Record<Exclude<AiWorldTab, 'rankings'>, string> = {
  tools: '/api/ai-world/tools',
  apps: '/api/ai-world/apps',
  news: '/api/ai-world/news',
}

/** 搜索提交去抖(ms) */
const SEARCH_DEBOUNCE_MS = 400

/** AiWorldRanking DTO → 共享层 AiWorldRankingItem(votes 提前自 scores.votes 提取) */
function toRanking(r: AiWorldRanking): AiWorldRankingItem {
  return {
    id: r.id,
    rank: r.rank,
    modelName: r.modelName,
    provider: r.provider,
    score: r.score,
    votes:
      r.scores && typeof r.scores === 'object' && 'votes' in r.scores
        ? Number((r.scores as Record<string, unknown>).votes)
        : null,
  }
}

/** AiWorldEntryDto → 共享层 AiWorldEntry(仅保留展示字段) */
function toEntry(e: AiWorldEntryDto): AiWorldEntry {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    coverImage: e.coverImage,
    source: e.source,
    viewCount: e.viewCount,
  }
}

export function AiWorldScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [feed, setFeed] = useState<AiWorldFeed | null>(null)
  const [tab, setTab] = useState<AiWorldTab>('tools')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // —— 条目筛选/搜索(tools/apps/news) ——
  const [search, setSearch] = useState('')
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null)
  const [filteredItems, setFilteredItems] = useState<AiWorldEntryDto[] | null>(null)
  const [filterLoading, setFilterLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // —— 榜单 ——
  const [leaderboards, setLeaderboards] = useState<LeaderboardInfo[]>([])
  const [activeLeaderboard, setActiveLeaderboard] = useState('lmsys')
  const [activeRankCategory, setActiveRankCategory] = useState('overall')
  const [rankings, setRankings] = useState<AiWorldRanking[]>([])
  const [rankLoading, setRankLoading] = useState(false)
  const [rankError, setRankError] = useState('')

  // 无搜索/分类筛选时,按当前 Tab 从一次拉取的 feed 中取条目(切换 Tab 不发请求)
  const feedItems = useMemo<AiWorldEntryDto[]>(() => {
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
  const loadRankings = useCallback(
    async (lb: string, cat: string) => {
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
    },
    [t],
  )

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
    const kind = tab as Exclude<AiWorldTab, 'rankings'>
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

  const switchTab = (next: AiWorldTab) => {
    setTab(next)
    setSearch('')
    setActiveCategorySlug(null)
    setFilteredItems(null)
  }

  const activeLbCategories = useMemo(
    () => leaderboards.find((l) => l.leaderboard === activeLeaderboard)?.categories ?? [],
    [leaderboards, activeLeaderboard],
  )

  const filterActive = Boolean(search.trim() || activeCategorySlug)

  return (
    <SharedAiWorldScreen
      t={t}
      colorScheme={resolvedTheme}
      loading={loading && feed === null}
      refreshing={refreshing}
      filterLoading={filterLoading}
      error={error}
      tab={tab}
      onSwitchTab={switchTab}
      onBack={() => navigation.goBack()}
      search={search}
      onSearchChange={setSearch}
      filterActive={filterActive}
      onClearFilter={() => {
        setSearch('')
        setActiveCategorySlug(null)
      }}
      categories={feed?.categories ?? []}
      activeCategorySlug={activeCategorySlug}
      onSelectCategory={setActiveCategorySlug}
      items={items.map(toEntry)}
      onRefresh={onRefresh}
      leaderboards={
        leaderboards.length > 0
          ? leaderboards.map((l) => ({ key: l.leaderboard, label: l.leaderboard }))
          : [{ key: 'lmsys', label: 'lmsys' }]
      }
      activeLeaderboard={activeLeaderboard}
      onSelectLeaderboard={(key) => {
        setActiveLeaderboard(key)
        const cats = leaderboards.find((l) => l.leaderboard === key)?.categories ?? []
        if (cats.length > 0 && !cats.includes(activeRankCategory)) {
          setActiveRankCategory(cats[0] ?? 'overall')
        }
      }}
      rankCategories={activeLbCategories.map((c) => ({ key: c, label: c }))}
      activeRankCategory={activeRankCategory}
      onSelectRankCategory={setActiveRankCategory}
      rankings={rankings.map(toRanking)}
      rankLoading={rankLoading}
      rankError={rankError}
      onRetryRankings={() => void loadRankings(activeLeaderboard, activeRankCategory)}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
