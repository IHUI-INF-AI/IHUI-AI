// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/shared/hooks - vitest mock
// Provides realistic hook implementations used by integration tests.

import { useEffect, useState, useRef, useCallback } from 'react'

// ─── useAuth ────────────────────────────────────────────────────────────────

export interface TokenStore {
  getToken(): string | null
  getRefreshToken(): string | null
  setToken(token: string | null): void
  setRefreshToken(token: string | null): void
  clearAll(): void
}

export interface UseAuthOptions<U = unknown> {
  store: TokenStore
  bindTransport?: (store: TokenStore) => void
  fetchProfile?: () => Promise<{ success: boolean; data?: U; error?: string }>
  logoutApi?: (refreshToken: string) => Promise<void>
  autoBind?: boolean
}

export interface UseAuthReturn<U = unknown> {
  ready: boolean
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  user: U | null
  login: (token: string, refreshToken?: string, newUser?: U) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<boolean>
  setUser: (user: U | null) => void
}

export function useAuth<U = unknown>(opts: UseAuthOptions<U>): UseAuthReturn<U> {
  const { store, bindTransport, fetchProfile, logoutApi, autoBind = true } = opts
  const [token, setToken] = useState<string | null>(store.getToken())
  const [refreshToken, setRefreshToken] = useState<string | null>(store.getRefreshToken())
  const [user, setUser] = useState<U | null>(null)
  const [ready, setReady] = useState(false)

  // Simulate async ready state
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (autoBind && bindTransport) {
      bindTransport(store)
    }
  }, [])

  const login = useCallback(
    async (t: string, rt?: string, newUser?: U) => {
      setToken(t)
      store.setToken(t)
      if (rt !== undefined) {
        setRefreshToken(rt ?? null)
        store.setRefreshToken(rt ?? null)
      }
      if (newUser !== undefined) {
        setUser(newUser)
      } else if (fetchProfile) {
        const res = await fetchProfile()
        if (res.success && res.data) setUser(res.data)
      }
    },
    [store, fetchProfile],
  )

  const logout = useCallback(async () => {
    if (logoutApi && refreshToken) {
      try {
        await logoutApi(refreshToken)
      } catch {
        // ignore
      }
    }
    store.clearAll()
    setToken(null)
    setRefreshToken(null)
    setUser(null)
  }, [logoutApi, refreshToken, store])

  const refresh = useCallback(async () => false, [])

  return {
    ready,
    token,
    refreshToken,
    isAuthenticated: !!token,
    user,
    login,
    logout,
    refresh,
    setUser,
  }
}

// ─── useChat ────────────────────────────────────────────────────────────────

export interface ApiChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  meta?: Record<string, unknown>
}

/** 对齐真实 useChat:API 消息只含 role/content(无 id/meta) */
export type ApiWireMessage = Pick<ApiChatMessage, 'role' | 'content'>

export interface StreamRunnerParams {
  callbacks: {
    onDelta: (delta: string) => void
    onDone: () => void
    onError: (error: string) => void
  }
  signal?: AbortSignal
  apiMessages?: ApiWireMessage[]
}

export interface UseChatOptions {
  streamRunner: (params: StreamRunnerParams) => Promise<void>
  clearAssistantOnError?: boolean
  formatError?: (err: unknown) => string
  systemPrompt?: string
}

export interface UseChatReturn {
  isStreaming: boolean
  messages: ApiChatMessage[]
  error: string | null
  sendMessage: (opts: {
    model: string
    text: string
    systemPrompt?: string
    meta?: Record<string, unknown>
  }) => Promise<void>
  clearMessages: () => void
  setError: (err: string | null) => void
  setMessages: ((msgs: ApiChatMessage[]) => void) | ((prev: ApiChatMessage[]) => ApiChatMessage[])
  stopStreaming: () => void
}

let _chatMsgId = 0
function uid(prefix: string) {
  return `${prefix}-${++_chatMsgId}`
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { streamRunner, clearAssistantOnError = false, formatError, systemPrompt } = options
  const [messages, setMessages] = useState<ApiChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    setIsStreaming(false)
    streamingRef.current = false
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const sendMessage = useCallback(
    async ({
      model: _model,
      text,
      systemPrompt,
      meta,
    }: {
      model: string
      text: string
      systemPrompt?: string
      meta?: Record<string, unknown>
    }) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (streamingRef.current) return
      streamingRef.current = true
      setIsStreaming(true)

      // Abort any previous stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      const userMsg: ApiChatMessage = { id: uid('u'), role: 'user', content: trimmed, meta }
      const assistantPlaceholder: ApiChatMessage = {
        id: uid('a'),
        role: 'assistant',
        content: '',
      }

      // 对齐真实 useChat:apiMessages 为 { role, content } 映射(无 id/meta),
      // 可选 systemPrompt(来自 sendMessage 参数)注入到开头
      const apiMessages: ApiWireMessage[] = []
      if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt })
      }
      apiMessages.push({ role: userMsg.role, content: userMsg.content })

      setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
      setError(null)

      try {
        await streamRunner({
          callbacks: {
            onDelta: (delta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantPlaceholder.id ? { ...m, content: m.content + delta } : m,
                ),
              )
            },
            onDone: () => {
              setIsStreaming(false)
              streamingRef.current = false
            },
            onError: (err) => {
              const msg = formatError ? formatError(err) : String(err)
              setError(msg)
              if (clearAssistantOnError) {
                setMessages((prev) => prev.filter((m) => m.id !== assistantPlaceholder.id))
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantPlaceholder.id ? { ...m, content: `⚠ ${msg}` } : m,
                  ),
                )
              }
              setIsStreaming(false)
              streamingRef.current = false
            },
          },
          signal: controller.signal,
          apiMessages,
        })
      } catch (e) {
        const msg = formatError ? formatError(e) : String(e)
        setError(msg)
        if (clearAssistantOnError) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantPlaceholder.id))
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantPlaceholder.id ? { ...m, content: `⚠ ${msg}` } : m)),
          )
        }
        setIsStreaming(false)
        streamingRef.current = false
      }
    },
    [streamRunner, clearAssistantOnError, formatError, systemPrompt],
  )

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    clearMessages: () => {
      stopStreaming()
      setMessages([])
      setError(null)
    },
    setError,
    setMessages,
    stopStreaming,
  }
}

// ─── useAgents ──────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name: string
  avatar?: string
  description?: string
  systemPrompt?: string
}

export interface AgentListResponse<T extends Agent = Agent> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface UseAgentsOptions<T extends Agent = Agent> {
  fetchList: () => Promise<AgentListResponse<T>>
  fetchDetail?: (id: string) => Promise<T>
  autoLoad?: boolean
}

export interface UseAgentsReturn<T extends Agent = Agent> {
  agents: T[]
  loading: boolean
  error: string | null
  currentAgent: T | null
  load: () => Promise<void>
  refresh: () => Promise<void>
  selectById: (id: string) => Promise<void>
  clearSelection: () => void
  findById: (id: string) => T | undefined
  setAgents: ((agents: T[]) => void) | ((prev: T[]) => T[])
}

export function useAgents<T extends Agent = Agent>(opts: UseAgentsOptions<T>): UseAgentsReturn<T> {
  const { fetchList, fetchDetail, autoLoad = true } = opts
  const [agents, setAgents] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAgent, setCurrentAgent] = useState<T | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchList()
      setAgents(res.list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [fetchList])

  useEffect(() => {
    if (autoLoad) void load()
  }, [])

  const refresh = useCallback(async () => {
    await load()
  }, [load])

  const selectById = useCallback(
    async (id: string) => {
      const existing = agents.find((a) => a.id === id)
      if (existing) {
        setCurrentAgent(existing)
        return
      }
      if (fetchDetail) {
        try {
          const detail = await fetchDetail(id)
          setCurrentAgent(detail)
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      } else {
        setError(`${id}: no fetchDetail provided`)
      }
    },
    [agents, fetchDetail],
  )

  const clearSelection = useCallback(() => setCurrentAgent(null), [])
  const findById = useCallback((id: string) => agents.find((a) => a.id === id), [agents])

  return {
    agents,
    loading,
    error,
    currentAgent,
    load,
    refresh,
    selectById,
    clearSelection,
    findById,
    setAgents,
  }
}

// ─── usePaginatedList ────────────────────────────────────────────────────────

export type Fetcher<T> = (query: {
  page: number
  pageSize: number
}) => Promise<
  { success: true; data: { list: T[]; total: number } } | { success: false; error?: string }
>

export interface PaginatedListResult<T> {
  items: T[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  page: number
  total: number
  refresh: () => void
  loadMore: () => void
  removeItem: (predicate: (item: T) => boolean) => void
}

export function usePaginatedList<T>(fetcher: Fetcher<T>, pageSize = 20): PaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(
    async (nextPage: number, isRefresh: boolean) => {
      if (nextPage === 1) {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError('')
      const res = await fetcher({ page: nextPage, pageSize })
      if (res.success) {
        setItems((prev) => (nextPage === 1 ? res.data.list : [...prev, ...res.data.list]))
        setTotal(res.data.total)
        setPage(nextPage)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    },
    [fetcher, pageSize],
  )

  useEffect(() => {
    void fetch(1, false)
  }, [fetch])

  const refresh = useCallback(() => {
    void fetch(1, true)
  }, [fetch])

  const loadMore = useCallback(() => {
    if (loadingMore || items.length >= total) return
    void fetch(page + 1, false)
  }, [fetch, loadingMore, items.length, total, page])

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setItems((prev) => prev.filter((item) => !predicate(item)))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    page,
    total,
    refresh,
    loadMore,
    removeItem,
  }
}

export interface Article {
  id: string
  title: string
  categoryId: string
  status: string
}

export interface ArticlesFetchParams {
  page: number
  pageSize?: number
  categoryId?: string
  status?: string
  search?: string
}

export interface ArticlesFetchResult {
  list: Article[]
  total: number
}

export type ArticlesFetcher = (params: ArticlesFetchParams) => Promise<ArticlesFetchResult>

export interface UseArticlesOptions {
  fetcher: ArticlesFetcher
  autoLoad?: boolean
  pageSize?: number
  initialCategoryId?: string
  initialStatus?: string
}

export interface UseArticlesReturn {
  articles: Article[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  total: number
  page: number
  totalPages: number
  hasNext: boolean
  categoryId: string
  status: string
  search: string
  load: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  setCategoryId: (v: string) => void
  setStatus: (v: string) => void
  setSearch: (v: string) => void
  resetFilters: () => void
  setPage: (v: number) => void
  setArticles: ((articles: Article[]) => void) | ((prev: Article[]) => Article[])
}

export function useArticles(opts: UseArticlesOptions): UseArticlesReturn {
  const {
    fetcher,
    autoLoad = true,
    pageSize: pageSizeOpt = 20,
    initialCategoryId = 'all',
    initialStatus = 'all',
  } = opts
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [categoryId, setCategoryIdState] = useState(initialCategoryId)
  const [status, setStatusState] = useState(initialStatus)
  const [search, setSearchState] = useState('')

  const runLoad = useCallback(
    async (p: number, append = false) => {
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setError(null)
      }
      try {
        const res = await fetcher({
          page: p,
          pageSize: pageSizeOpt,
          categoryId: categoryId === 'all' ? undefined : categoryId,
          status: status === 'all' ? undefined : status,
          search,
        })
        if (append) {
          setArticles((prev) => [...prev, ...res.list])
        } else {
          setArticles(res.list)
        }
        setTotal(res.total)
        setPageState(p)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [fetcher, categoryId, status, search, pageSizeOpt],
  )

  // 对齐真实 useArticles:单 effect 承载「挂载 + categoryId/status 变化」,
  // search 变化不自动触发(下次 load() 才生效)。runLoad 经 ref 稳定化,
  // 避免 search 变化导致 effect 依赖漂移重复触发。
  const runLoadRef = useRef(runLoad)
  runLoadRef.current = runLoad

  useEffect(() => {
    if (!autoLoad) return
    void runLoadRef.current(1)
  }, [categoryId, status, autoLoad])

  const totalPages = Math.max(1, Math.ceil(total / pageSizeOpt))

  const load = useCallback(() => runLoad(1), [runLoad])
  const refresh = useCallback(() => runLoad(1), [runLoad])

  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    if (nextPage > totalPages || loadingMore) return
    await runLoad(nextPage, true)
  }, [page, totalPages, loadingMore, runLoad])

  const setPage = useCallback(
    (v: number) => setPageState(Math.max(1, Math.min(totalPages, v))),
    [totalPages],
  )
  const setStatus = useCallback((v: string) => setStatusState(v), [])
  const setSearch = useCallback((v: string) => setSearchState(v), [])
  const setCategoryId = useCallback((v: string) => setCategoryIdState(v), [])
  const resetFilters = useCallback(() => {
    setCategoryIdState('all')
    setStatusState('all')
    setSearchState('')
  }, [])

  return {
    articles,
    loading,
    loadingMore,
    error,
    total,
    page,
    totalPages,
    hasNext: page < totalPages,
    categoryId,
    status,
    search,
    load,
    loadMore,
    refresh,
    setCategoryId,
    setStatus,
    setSearch,
    resetFilters,
    setPage,
    setArticles,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
