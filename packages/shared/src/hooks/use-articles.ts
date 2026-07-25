/**
 * useArticles — 跨端文章列表管理业务 Hook
 *
 * 设计原则(参照 usePagination + useAgents):
 * 1. 纯逻辑层:只管 articles 列表 + 分页 + 筛选状态,不绑定具体 transport
 * 2. 依赖注入:fetcher 由各端注入(web 用 fetchApi / miniapp-taro 用 get<T>)
 * 3. 零新依赖:纯 useState + useEffect + useCallback
 * 4. 非破坏性:与各端现有 articles hook 平行存在
 *
 * 各端接入示例:
 * ```ts
 * import { useArticles } from '@ihui/shared/hooks'
 *
 * const {
 *   articles, page, total, categoryId, status, search,
 *   loading, loadingMore, hasNext,
 *   setCategoryId, setStatus, setSearch, setPage,
 *   load, loadMore, refresh,
 * } = useArticles({
 *   fetcher: async (params) => {
 *     const res = await fetchApi('/api/articles/list', { params })
 *     return { list: res.data.list, total: res.data.total }
 *   },
 * })
 * ```
 */
import * as React from 'react'

/**
 * 文章基础类型(各端可扩展)
 */
export interface Article {
  id: string
  title: string
  coverUrl?: string
  summary?: string
  content?: string
  categoryId?: string
  status?: 'draft' | 'published' | 'archived'
  createdAt?: string
  updatedAt?: string
}

/**
 * 文章列表查询参数
 */
export interface ArticleQueryParams {
  page: number
  pageSize: number
  categoryId?: string
  status?: string
  search?: string
}

/**
 * 列表响应结构
 */
export interface ArticleListResponse<T extends Article = Article> {
  list: T[]
  total: number
}

/**
 * useArticles 配置项
 */
export interface UseArticlesOptions<TArticle extends Article = Article> {
  /** 拉取列表(各端注入自己的 transport) */
  fetcher: (params: ArticleQueryParams) => Promise<ArticleListResponse<TArticle>>
  /** 每页大小(默认 10) */
  pageSize?: number
  /** 是否挂载时自动拉取(默认 true) */
  autoLoad?: boolean
  /** 初始 categoryId 筛选(默认 'all') */
  initialCategoryId?: string
  /** 初始 status 筛选(默认 'all') */
  initialStatus?: string
}

/**
 * useArticles 返回值
 */
export interface UseArticlesReturn<TArticle extends Article = Article> {
  articles: TArticle[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  categoryId: string
  status: string
  search: string
  loading: boolean
  loadingMore: boolean
  error: string | null
  load: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  setPage: (page: number) => void
  setCategoryId: (categoryId: string) => void
  setStatus: (status: string) => void
  setSearch: (search: string) => void
  resetFilters: () => void
  setArticles: React.Dispatch<React.SetStateAction<TArticle[]>>
}

/**
 * useArticles — 文章列表管理业务 Hook
 */
export function useArticles<TArticle extends Article = Article>(
  options: UseArticlesOptions<TArticle>,
): UseArticlesReturn<TArticle> {
  const {
    fetcher,
    pageSize: defaultPageSize = 10,
    autoLoad = true,
    initialCategoryId = 'all',
    initialStatus = 'all',
  } = options

  const [articles, setArticles] = React.useState<TArticle[]>([])
  const [page, setPageState] = React.useState(1)
  const [pageSize] = React.useState(defaultPageSize)
  const [total, setTotal] = React.useState(0)
  const [categoryId, setCategoryIdState] = React.useState(initialCategoryId)
  const [status, setStatusState] = React.useState(initialStatus)
  const [search, setSearchState] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasNext = page < totalPages

  const buildParams = React.useCallback(
    (overridePage?: number): ArticleQueryParams => ({
      page: overridePage ?? page,
      pageSize,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      status: status === 'all' ? undefined : status,
      search: search.trim() || undefined,
    }),
    [page, pageSize, categoryId, status, search],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher(buildParams(1))
      setArticles(res.list ?? [])
      setTotal(res.total ?? 0)
      setPageState(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [fetcher, buildParams])

  const loadMore = React.useCallback(async () => {
    if (!hasNext || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const nextPage = page + 1
      const res = await fetcher(buildParams(nextPage))
      setArticles((prev) => [...prev, ...(res.list ?? [])])
      setTotal(res.total ?? 0)
      setPageState(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingMore(false)
    }
  }, [hasNext, loadingMore, page, fetcher, buildParams])

  const refresh = React.useCallback(async () => {
    return load()
  }, [load])

  const setPage = React.useCallback(
    (p: number) => {
      setPageState(Math.min(Math.max(1, p), totalPages))
    },
    [totalPages],
  )

  const setCategoryId = React.useCallback((c: string) => {
    setCategoryIdState(c)
  }, [])

  const setStatus = React.useCallback((s: string) => {
    setStatusState(s)
  }, [])

  const setSearch = React.useCallback((s: string) => {
    setSearchState(s)
  }, [])

  const resetFilters = React.useCallback(() => {
    setCategoryIdState('all')
    setStatusState('all')
    setSearchState('')
  }, [])

  // 挂载时 + categoryId / status 变化时重新加载(重置到第 1 页)
  // 单 effect 避免挂载时重复触发(原两 effect 模式挂载触发 2 次 load,合并后只 1 次)
  React.useEffect(() => {
    if (!autoLoad) return
    void load()
  }, [categoryId, status, autoLoad, load])

  return {
    articles,
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    categoryId,
    status,
    search,
    loading,
    loadingMore,
    error,
    load,
    loadMore,
    refresh,
    setPage,
    setCategoryId,
    setStatus,
    setSearch,
    resetFilters,
    setArticles,
  }
}
