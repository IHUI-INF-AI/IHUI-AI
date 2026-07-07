/**
 * AI 动态/资讯聚合 composable
 * 模块级 ref 共享数据(与 useNews.ts 模式一致)
 *
 * 功能:
 *  - 数据源列表(动态 Tab)
 *  - 资讯条目分页加载(无限滚动)
 *  - 多维度筛选(source/category/trend/keyword)
 *  - 趋势图表数据
 *  - 分类/趋势标签映射
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  getAiFeedItems,
  getAiFeedSources,
  getAiFeedStats,
  getAiFeedTopics,
  getAiFeedTrend,
  triggerAiFeedFetch,
  type AiFeedItem,
  type AiFeedListResponse,
  type AiFeedSource,
  type AiFeedTopic,
} from '@/api/ai-feed'

// ---------------------------------------------------------------------------
// 模块级共享状态(首页与 AI 动态页共用)
// ---------------------------------------------------------------------------
const sources = ref<AiFeedSource[]>([])
const items = ref<AiFeedItem[]>([])
const topics = ref<AiFeedTopic[]>([])
const total = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const loadingTopics = ref(false)
const noMore = ref(false)
const error = ref(false)
const stats = ref<AiFeedSource[]>([])
const viewMode = ref<'list' | 'topics'>('list')

// 筛选条件
const activeSource = ref<string>('') // 空字符串 = 全部
const activeCategory = ref<string>('')
const activeTrend = ref<string>('')
const searchKeyword = ref<string>('')

// Tab 排序(持久化到 localStorage)
const TAB_ORDER_KEY = 'ai-feed-tab-order'
const tabOrder = ref<string[]>([])

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// 分类与趋势标签映射(i18n)
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  hotspot: 'categoryHotspot',
  account: 'categoryAccount',
  source: 'categorySource',
  creation: 'categoryCreation',
  analysis: 'categoryAnalysis',
  retrieval: 'categoryRetrieval',
  tool: 'categoryTool',
}

const TREND_MAP: Record<string, string> = {
  rising: 'trendRising',
  stable: 'trendStable',
  cooling: 'trendCooling',
  new: 'trendNew',
}

const TREND_COLORS: Record<string, string> = {
  rising: '#16a34a',
  stable: '#8c8c8c',
  cooling: '#dc2626',
  new: '#2563eb',
}

export function useAiFeed() {
  const { t } = useI18n()

  /** 获取数据源列表 */
  async function loadSources() {
    try {
      const res = await getAiFeedSources(true)
      sources.value = (res?.data ?? res) as AiFeedSource[]
    } catch (e) {
      console.warn('[useAiFeed] loadSources failed:', e)
      sources.value = []
    }
  }

  /** 加载资讯列表(指定页码, 默认第1页) */
  async function loadItems(page = 1) {
    loading.value = true
    error.value = false
    currentPage.value = page
    noMore.value = false
    try {
      const res = await getAiFeedItems({
        source: activeSource.value || undefined,
        category: activeCategory.value || undefined,
        trend: activeTrend.value || undefined,
        keyword: searchKeyword.value || undefined,
        page,
        limit: PAGE_SIZE,
      })
      // 后端返回 { code, data: [...items], total } — data 是数组, total 在顶层
      const resData = res?.data
      items.value = Array.isArray(resData) ? resData : (resData?.items ?? [])
      total.value = res?.total ?? (resData as AiFeedListResponse | undefined)?.total ?? 0
      noMore.value = items.value.length >= total.value
    } catch (e) {
      console.warn('[useAiFeed] loadItems failed:', e)
      error.value = true
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /** 加载更多(无限滚动) */
  async function loadMore() {
    if (loadingMore.value || noMore.value || loading.value) return
    loadingMore.value = true
    try {
      const nextPage = currentPage.value + 1
      const res = await getAiFeedItems({
        source: activeSource.value || undefined,
        category: activeCategory.value || undefined,
        trend: activeTrend.value || undefined,
        keyword: searchKeyword.value || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      })
      // 后端返回 { code, data: [...items], total } — data 是数组, total 在顶层
      const resData = res?.data
      const newItems = Array.isArray(resData) ? resData : (resData?.items ?? [])
      items.value.push(...newItems)
      currentPage.value = nextPage
      noMore.value = items.value.length >= (res?.total ?? total.value) || newItems.length === 0
    } catch (e) {
      console.warn('[useAiFeed] loadMore failed:', e)
    } finally {
      loadingMore.value = false
    }
  }

  /** 获取趋势图表数据 */
  async function loadTrendChart(itemId: number, window = 14) {
    try {
      const res = await getAiFeedTrend(itemId, window)
      return res?.data ?? res
    } catch (e) {
      console.warn('[useAiFeed] loadTrendChart failed:', e)
      return null
    }
  }

  /** 获取采集统计 */
  async function loadStats() {
    try {
      const res = await getAiFeedStats()
      const data = res?.data
      stats.value = data?.sources ?? []
    } catch (e) {
      console.warn('[useAiFeed] loadStats failed:', e)
    }
  }

  /** 加载跨源热点聚合 */
  async function loadTopics() {
    loadingTopics.value = true
    try {
      const res = await getAiFeedTopics({ hours: 48, min_sources: 2, limit: 20 })
      topics.value = (res?.data ?? res) as AiFeedTopic[]
    } catch (e) {
      console.warn('[useAiFeed] loadTopics failed:', e)
      topics.value = []
    } finally {
      loadingTopics.value = false
    }
  }

  /** 切换视图模式(列表 / 话题聚合) */
  function switchViewMode(mode: 'list' | 'topics') {
    viewMode.value = mode
    if (mode === 'topics' && topics.value.length === 0) {
      loadTopics()
    }
  }

  /** 从 localStorage 恢复 Tab 排序 */
  function restoreTabOrder() {
    try {
      const saved = localStorage.getItem(TAB_ORDER_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          tabOrder.value = parsed
        }
      }
    } catch {
      // ignore
    }
  }

  /** 保存 Tab 排序到 localStorage */
  function saveTabOrder(order: string[]) {
    tabOrder.value = order
    try {
      localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order))
    } catch {
      // ignore
    }
  }

  /** 手动刷新(触发后端采集) */
  async function refresh() {
    try {
      await triggerAiFeedFetch()
      await loadItems()
    } catch (e) {
      console.warn('[useAiFeed] refresh failed:', e)
    }
  }

  /** 切换数据源 */
  function selectSource(code: string) {
    activeSource.value = activeSource.value === code ? '' : code
    loadItems()
  }

  /** 切换分类 */
  function selectCategory(cat: string) {
    activeCategory.value = activeCategory.value === cat ? '' : cat
    loadItems()
  }

  /** 切换趋势 */
  function selectTrend(trend: string) {
    activeTrend.value = activeTrend.value === trend ? '' : trend
    loadItems()
  }

  /** 搜索 */
  function search(keyword: string) {
    searchKeyword.value = keyword
    loadItems()
  }

  // i18n 辅助
  const categoryLabel = (cat: string) => {
    const key = CATEGORY_MAP[cat]
    return key ? t(`newsCenter.aggregator.${key}`) : cat
  }
  const trendLabel = (trend: string) => {
    const key = TREND_MAP[trend]
    return key ? t(`newsCenter.aggregator.${key}`) : trend
  }
  const trendColor = (trend: string) => TREND_COLORS[trend] || '#8c8c8c'

  // 按分类分组的数据源
  const sourcesByCategory = computed(() => {
    const groups: Record<string, AiFeedSource[]> = {
      general: [],
      'ai-media': [],
      'ai-paper': [],
      'tech-community': [],
    }
    sources.value.forEach((s) => {
      const cat = s.category || 'general'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(s)
    })
    return groups
  })

  return {
    // 状态
    sources,
    items,
    topics,
    total,
    currentPage,
    loading,
    loadingMore,
    loadingTopics,
    noMore,
    error,
    stats,
    activeSource,
    activeCategory,
    activeTrend,
    searchKeyword,
    viewMode,
    tabOrder,
    // 计算
    sourcesByCategory,
    // 方法
    loadSources,
    loadItems,
    loadMore,
    loadTrendChart,
    loadStats,
    loadTopics,
    refresh,
    selectSource,
    selectCategory,
    selectTrend,
    search,
    switchViewMode,
    restoreTabOrder,
    saveTabOrder,
    // i18n 辅助
    categoryLabel,
    trendLabel,
    trendColor,
  }
}
