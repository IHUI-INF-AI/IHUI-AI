/**
 * AI HOT 资讯组合式函数
 *
 * 提供 AI 资讯的响应式状态:
 *   - 每日精选列表 + 今日热点 + 分类筛选 + 加载更多 + 信源统计
 *   - 每日日报 (5 版块 + 快讯) + 日报归档列表
 *   - 关键词搜索
 *   - 信源筛选
 *   - IndexedDB 离线降级
 *
 * 状态在组件间共享 (模块级单例), 首次使用时自动加载.
 */
import { ref, computed } from 'vue'
import {
  fetchAiHotItems,
  fetchMoreItems,
  fetchAiHotDaily,
  fetchAiHotDailies,
  fetchAiHotDailyByDate,
  clearAiHotCache,
  getItemsCacheTs,
  countSources,
  loadFromIndexedDB,
  type AiHotNewsItem,
  type AiHotDaily,
  type AiHotDailyArchiveItem,
  type SourceStat,
} from '@/services/aihot-news'

// 模块级单例状态
const items = ref<AiHotNewsItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<number>(0)
let initialized = false

// 分类筛选
const activeCategory = ref<string>('')

// 信源筛选
const activeSource = ref<string>('')

// 关键词搜索
const searchQuery = ref<string>('')
const searchResults = ref<AiHotNewsItem[] | null>(null)
const searching = ref(false)

// 分页
const nextCursor = ref<string | null>(null)
const hasNext = ref(false)

// 日报
const daily = ref<AiHotDaily | null>(null)
const dailyLoading = ref(false)
const dailyExpanded = ref(false)

// 日报归档
const dailies = ref<AiHotDailyArchiveItem[]>([])
const archiveDaily = ref<AiHotDaily | null>(null)
const archiveLoading = ref(false)

export function useAiHotNews() {
  /** 今日热点: 前 3 条 */
  const hotItems = computed(() => items.value.slice(0, 3))

  /** 头条大卡 */
  const heroItem = computed(() => items.value[0] || null)

  /** 侧边栏: 第 2、3 条 */
  const sidebarItems = computed(() => items.value.slice(1, 3))

  /** 按分类+信源筛选后的条目 */
  const filteredItems = computed(() => {
    let result = items.value
    if (activeCategory.value) {
      result = result.filter(item => item.category === activeCategory.value)
    }
    if (activeSource.value) {
      result = result.filter(item => item.source === activeSource.value)
    }
    return result
  })

  /** 用于展示的全部条目 (搜索时用搜索结果) */
  const allItems = computed(() => {
    if (searchResults.value) return searchResults.value
    return items.value
  })

  /** 用于 hero/sidebar 的展示条目 (兼容搜索+筛选) */
  const displayItems = computed(() => {
    if (searchResults.value) return searchResults.value
    return filteredItems.value
  })

  /** 底部列表: 第 4 条之后全部 */
  const listItems = computed(() => displayItems.value.slice(3))

  /** 信源统计 */
  const sourceStats = computed<SourceStat[]>(() => countSources(items.value))

  /** 信源总数 */
  const sourceCount = computed(() => sourceStats.value.length)

  /** 总条目数 */
  const totalCount = computed(() => items.value.length)

  /** 数据新鲜度文案 */
  const freshnessLabel = computed(() => {
    const ts = lastUpdated.value || getItemsCacheTs()
    if (!ts) return ''
    const diff = Math.max(0, Date.now() - ts)
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚更新'
    if (min < 60) return `${min}分钟前更新`
    const hr = Math.floor(min / 60)
    return `${hr}小时前更新`
  })

  /** 各分类条目数统计 */
  const categoryCounts = computed(() => {
    const map = new Map<string, number>()
    for (const item of items.value) {
      const cat = item.category || 'other'
      map.set(cat, (map.get(cat) || 0) + 1)
    }
    return map
  })

  /** 前 8 个高频信源 (快捷标签) */
  const topSources = computed(() => sourceStats.value.slice(0, 8))

  /** 加载 AI 资讯数据 */
  async function load(force = false) {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      if (force) clearAiHotCache()
      const res = await fetchAiHotItems({ force, take: 50, days: 7 })
      items.value = res.items
      nextCursor.value = res.nextCursor
      hasNext.value = res.hasNext
      lastUpdated.value = Date.now()
      initialized = true

      // 并行加载日报 (不阻塞主数据)
      if (!daily.value && !dailyLoading.value) {
        dailyLoading.value = true
        fetchAiHotDaily(force)
          .then(d => { daily.value = d })
          .catch(() => {})
          .finally(() => { dailyLoading.value = false })
      }

      // 并行加载日报归档
      if (dailies.value.length === 0) {
        fetchAiHotDailies(14, force)
          .then(d => { dailies.value = d })
          .catch(() => {})
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败'
      error.value = msg
      // 加载失败时尝试从 IndexedDB 恢复
      if (items.value.length === 0) {
        const cached = await loadFromIndexedDB().catch(() => null)
        if (cached && cached.length > 0) {
          items.value = cached
        }
      }
    } finally {
      loading.value = false
    }
  }

  /** 加载更多 (cursor 翻页) */
  async function loadMore() {
    if (loadingMore.value || !hasNext.value || !nextCursor.value) return
    loadingMore.value = true
    try {
      const res = await fetchMoreItems(nextCursor.value, {
        category: activeCategory.value || undefined,
      })
      items.value = [...items.value, ...res.items]
      nextCursor.value = res.nextCursor
      hasNext.value = res.hasNext
    } catch {
      // 翻页失败不影响已有数据
    } finally {
      loadingMore.value = false
    }
  }

  /** 切换分类 */
  async function setCategory(cat: string) {
    if (activeCategory.value === cat) return
    activeCategory.value = cat
    // 有全量数据时前端筛选即可
    if (!cat) return
    const filtered = items.value.filter(item => item.category === cat)
    if (filtered.length < 5 && hasNext.value) {
      await loadMore()
    }
  }

  /** 切换信源 */
  function setSource(source: string) {
    activeSource.value = activeSource.value === source ? '' : source
  }

  /** 关键词搜索 (服务端搜索, 覆盖全池) */
  async function search(q: string) {
    if (!q || q.trim().length < 2) {
      searchResults.value = null
      searchQuery.value = ''
      return
    }
    searchQuery.value = q.trim()
    searching.value = true
    try {
      const res = await fetchAiHotItems({ q: q.trim(), take: 30, days: 7, force: true })
      searchResults.value = res.items
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }

  /** 清除搜索 */
  function clearSearch() {
    searchResults.value = null
    searchQuery.value = ''
  }

  /** 强制刷新 */
  async function refresh() {
    activeCategory.value = ''
    activeSource.value = ''
    searchResults.value = null
    searchQuery.value = ''
    await load(true)
  }

  /** 展开/收起日报 */
  function toggleDaily() {
    dailyExpanded.value = !dailyExpanded.value
  }

  /** 查看指定日期日报 */
  async function viewArchiveDaily(date: string) {
    if (!date) return
    archiveLoading.value = true
    try {
      archiveDaily.value = await fetchAiHotDailyByDate(date)
    } catch {
      archiveDaily.value = null
    } finally {
      archiveLoading.value = false
    }
  }

  /** 关闭归档日报 */
  function closeArchiveDaily() {
    archiveDaily.value = null
  }

  /** 首次自动加载 */
  function ensureLoaded() {
    if (!initialized && !loading.value) {
      load()
    }
  }

  return {
    // 状态
    items,
    loading,
    loadingMore,
    error,
    lastUpdated,
    activeCategory,
    activeSource,
    searchQuery,
    searchResults,
    searching,
    hasNext,
    daily,
    dailyLoading,
    dailyExpanded,
    dailies,
    archiveDaily,
    archiveLoading,
    // 计算属性
    hotItems,
    heroItem,
    sidebarItems,
    listItems,
    filteredItems,
    allItems,
    displayItems,
    freshnessLabel,
    sourceStats,
    sourceCount,
    totalCount,
    categoryCounts,
    topSources,
    // 方法
    load,
    loadMore,
    setCategory,
    setSource,
    search,
    clearSearch,
    refresh,
    toggleDaily,
    viewArchiveDaily,
    closeArchiveDaily,
    ensureLoaded,
  }
}
