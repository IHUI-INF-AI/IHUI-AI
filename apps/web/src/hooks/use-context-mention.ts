'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'
import type {
  ContextMention,
  DatabaseSchemaResult,
  MentionType,
  SymbolSearchItem,
} from '@ihui/types'

/** 统一检索响应 */
interface MentionSearchResponse {
  mentions: ContextMention[]
  total: number
}

/** 符号检索响应 */
interface SymbolSearchResponse {
  symbols: SymbolSearchItem[]
  total: number
}

/** 构建 query string(跳过 undefined/null/空值) */
function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, String(value))
    }
  }
  const str = qs.toString()
  return str ? `?${str}` : ''
}

/**
 * 多维 @ 提及检索 Hook(react-query 封装)。
 *
 * - searchMentions: 统一检索(file/database/symbol/folder/web)
 * - listTables: 数据库表清单
 * - getSchema: 指定表列定义
 * - searchSymbols: 符号语义搜索
 *
 * staleTime 60s 与后端 LRU 缓存 TTL 对齐,避免前端频繁重复请求。
 * 注:web 端 fetchApi 包装(@/lib/api)只接受 RequestInit,不支持 params 字段,
 * 故用 buildQuery 手动拼 query string(保留 401 自动弹登录弹窗行为)。
 */

/** 统一检索(按 type 分发) */
export function useSearchMentions(
  query: string,
  type: MentionType,
  workspacePath?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['context-mentions', type, query, workspacePath ?? ''],
    queryFn: async () => {
      const qs = buildQuery({ q: query || undefined, type, workspacePath: workspacePath || undefined, limit: 20 })
      const res = await fetchApi<MentionSearchResponse>(`/api/context/mentions${qs}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

/** 数据库表清单 */
export function useListTables(query: string, enabled = true) {
  return useQuery({
    queryKey: ['context-tables', query],
    queryFn: async () => {
      const qs = buildQuery({ q: query || undefined, limit: 50 })
      const res = await fetchApi<MentionSearchResponse>(`/api/context/database/tables${qs}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

/** 指定表列定义 */
export function useGetSchema(tableName: string | null, enabled = true) {
  return useQuery({
    queryKey: ['context-schema', tableName],
    queryFn: async () => {
      const res = await fetchApi<DatabaseSchemaResult>(
        `/api/context/database/schema/${encodeURIComponent(tableName!)}`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: !!tableName && enabled,
    staleTime: 60_000,
    retry: false,
  })
}

/** 符号语义搜索 */
export function useSearchSymbols(query: string, enabled = true) {
  return useQuery({
    queryKey: ['context-symbols', query],
    queryFn: async () => {
      const qs = buildQuery({ q: query, limit: 20 })
      const res = await fetchApi<SymbolSearchResponse>(`/api/context/symbols${qs}`)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    enabled: query.trim().length > 0 && enabled,
    staleTime: 60_000,
    retry: false,
  })
}
