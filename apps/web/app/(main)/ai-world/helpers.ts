import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type {
  AiWorldData,
  AiCategory,
  PaginatedItems,
  PaginatedRankings,
  LeaderboardInfo,
  LeaderboardId,
  ItemKind,
} from './types'

async function api<T>(url: string): Promise<T> {
  const res = await fetchApi<T>(url)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export async function fetchAiWorld(): Promise<AiWorldData> {
  return api<AiWorldData>('/api/ai-world')
}

export async function fetchAiWorldCategories(): Promise<AiCategory[]> {
  return api<AiCategory[]>('/api/ai-world/categories')
}

export interface FetchItemsParams {
  kind: ItemKind
  category?: string
  limit?: number
  offset?: number
  search?: string
  order?: 'latest' | 'hot' | 'published' | 'trending'
}

export async function fetchAiWorldItems(params: FetchItemsParams): Promise<PaginatedItems> {
  const qs = new URLSearchParams()
  if (params.category) qs.set('category', params.category)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  if (params.search) qs.set('search', params.search)
  if (params.order) qs.set('order', params.order)
  const suffix = qs.toString()
  return api<PaginatedItems>(`/api/ai-world/${params.kind}s${suffix ? `?${suffix}` : ''}`)
}

export interface FetchRankingsParams {
  leaderboard?: LeaderboardId
  category?: string
  limit?: number
  offset?: number
}

export async function fetchAiWorldRankings(params: FetchRankingsParams): Promise<PaginatedRankings> {
  const qs = new URLSearchParams()
  if (params.leaderboard) qs.set('leaderboard', params.leaderboard)
  if (params.category) qs.set('category', params.category)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const suffix = qs.toString()
  return api<PaginatedRankings>(`/api/ai-world/rankings${suffix ? `?${suffix}` : ''}`)
}

export async function fetchLeaderboards(): Promise<LeaderboardInfo[]> {
  return api<LeaderboardInfo[]>('/api/ai-world/rankings/leaderboards')
}

export interface FetchTrendingParams {
  kind?: ItemKind
  limit?: number
  offset?: number
}

export async function fetchTrendingItems(params: FetchTrendingParams): Promise<PaginatedItems> {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  const suffix = qs.toString()
  return api<PaginatedItems>(`/api/ai-world/trending${suffix ? `?${suffix}` : ''}`)
}

/**
 * SSE 流式对话事件回调。
 * onDelta 收到增量文本片段,onError 收到错误消息(连接/解析/上游错误)。
 * 返回 AbortController 用于外部中断流式请求。
 */
export interface StreamChatCallbacks {
  onDelta: (delta: string) => void
  onError: (message: string) => void
  onDone?: () => void
}

/**
 * 调用 /api/llm/complete/stream,逐 token 回调 onDelta。
 * 不做会话持久化(ai-world 页面是 demo 入口)。
 */
export function streamAiChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  callbacks: StreamChatCallbacks,
  options?: { model?: string },
): AbortController {
  const controller = new AbortController()
  const { token, user } = useAuthStore.getState()
  const userId = user?.id ?? ''

  void (async () => {
    try {
      const res = await fetch('/api/llm/complete/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages,
          stream: true,
          ...(options?.model ? { model: options.model } : {}),
          metadata: { userId, source: 'ai-world' },
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '')
        callbacks.onError(errText || `请求失败(${res.status})`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          // AI service SSE 格式:event: chunk \n data: {"content":"..."}
          // 仅处理 data: 行;event:/空行/注释自动跳过
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).replace(/^\s/, '')
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload) as {
              type?: string
              message?: string
              content?: string
              error?: string
            }
            if (json.type === 'error' || json.error) {
              callbacks.onError(json.message ?? json.error ?? '上游错误')
              return
            }
            if (typeof json.content === 'string' && json.content) {
              callbacks.onDelta(json.content)
            }
          } catch {
            /* 忽略非 JSON 行 */
          }
        }
      }
      callbacks.onDone?.()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      callbacks.onError(e instanceof Error ? e.message : '网络异常')
    }
  })()

  return controller
}
