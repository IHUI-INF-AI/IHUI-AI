/**
 * 用户记忆服务（合并版）
 *
 * 合并自旧架构 services/user-memory.ts。
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export type MemoryScope = 'user' | 'session' | 'global'
export type MemoryType = 'preference' | 'fact' | 'event' | 'skill' | 'relationship' | 'context'

export interface UserMemory {
  id: string
  userId: string
  scope: MemoryScope
  type: MemoryType
  key: string
  value: unknown
  confidence: number
  source: 'explicit' | 'inferred' | 'system'
  tags: string[]
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
  accessCount: number
}

export interface MemoryQuery {
  page?: number
  pageSize?: number
  userId?: string
  scope?: MemoryScope
  type?: MemoryType
  keyword?: string
  tags?: string[]
  startDate?: string
  endDate?: string
}

export interface MemoryInput {
  scope: MemoryScope
  type: MemoryType
  key: string
  value: unknown
  confidence?: number
  source?: UserMemory['source']
  tags?: string[]
  expiresAt?: string | null
}

export interface MemoryConsolidation {
  totalMemories: number
  consolidated: number
  conflicts: number
  removed: number
  ranAt: string
}

/* ------------------------------------------------------------------ */
/* 本地缓存（session 级别，便于离线快速访问）                          */
/* ------------------------------------------------------------------ */

const localCache = new Map<string, UserMemory>()

function cacheKey(userId: string, scope: MemoryScope, key: string): string {
  return `${userId}:${scope}:${key}`
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function createMemory(
  userId: string,
  input: MemoryInput,
): Promise<ApiResult<UserMemory>> {
  const r = await fetchApi<UserMemory>('/user-memory', {
    method: 'POST',
    body: JSON.stringify({ userId, ...input }),
  })
  if (r.success) {
    localCache.set(cacheKey(userId, input.scope, input.key), r.data)
  }
  return r
}

export async function getMemory(id: string): Promise<ApiResult<UserMemory>> {
  return fetchApi<UserMemory>(`/user-memory/${encodeURIComponent(id)}`)
}

export async function listMemories(
  query: MemoryQuery = {},
): Promise<ApiResult<PageData<UserMemory>>> {
  return fetchApi<PageData<UserMemory>>(`/user-memory${buildQs(query)}`)
}

export async function updateMemory(
  id: string,
  input: Partial<Pick<UserMemory, 'value' | 'confidence' | 'tags' | 'expiresAt'>>,
): Promise<ApiResult<UserMemory>> {
  return fetchApi<UserMemory>(`/user-memory/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteMemory(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/user-memory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------ */
/* 按键检索                                                            */
/* ------------------------------------------------------------------ */

export async function findMemory(
  userId: string,
  scope: MemoryScope,
  key: string,
): Promise<ApiResult<UserMemory | null>> {
  // 先查本地缓存
  const cached = localCache.get(cacheKey(userId, scope, key))
  if (cached) return { success: true, data: cached }
  // 远程查找
  const r = await fetchApi<UserMemory | null>(`/user-memory/find${buildQs({ userId, scope, key })}`)
  if (r.success && r.data) {
    localCache.set(cacheKey(userId, scope, key), r.data)
  }
  return r
}

export async function batchFindMemory(
  userId: string,
  keys: Array<{ scope: MemoryScope; key: string }>,
): Promise<ApiResult<UserMemory[]>> {
  return fetchApi<UserMemory[]>('/user-memory/batch-find', {
    method: 'POST',
    body: JSON.stringify({ userId, keys }),
  })
}

/* ------------------------------------------------------------------ */
/* 记忆强化 / 衰减                                                     */
/* ------------------------------------------------------------------ */

export async function reinforceMemory(
  id: string,
  delta = 0.1,
): Promise<ApiResult<{ confidence: number }>> {
  const r = await fetchApi<{ confidence: number }>(
    `/user-memory/${encodeURIComponent(id)}/reinforce`,
    { method: 'POST', body: JSON.stringify({ delta }) },
  )
  if (r.success) {
    for (const [k, v] of localCache) {
      if (v.id === id) {
        localCache.set(k, { ...v, confidence: r.data.confidence })
        break
      }
    }
  }
  return r
}

export async function decayMemories(
  userId: string,
  factor = 0.95,
): Promise<ApiResult<{ decayed: number; removed: number }>> {
  return fetchApi<{ decayed: number; removed: number }>('/user-memory/decay', {
    method: 'POST',
    body: JSON.stringify({ userId, factor }),
  })
}

/* ------------------------------------------------------------------ */
/* 记忆整合                                                            */
/* ------------------------------------------------------------------ */

export async function consolidateMemories(userId: string): Promise<ApiResult<MemoryConsolidation>> {
  const r = await fetchApi<MemoryConsolidation>('/user-memory/consolidate', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  // 整合后清空本地缓存以便重新拉取
  if (r.success) {
    for (const [k] of localCache) {
      if (k.startsWith(`${userId}:`)) localCache.delete(k)
    }
  }
  return r
}

/* ------------------------------------------------------------------ */
/* 导出 / 清除                                                        */
/* ------------------------------------------------------------------ */

export async function exportMemories(userId: string): Promise<ApiResult<UserMemory[]>> {
  return fetchApi<UserMemory[]>(`/user-memory/export${buildQs({ userId })}`)
}

export async function clearAllMemories(
  userId: string,
  scope?: MemoryScope,
): Promise<ApiResult<{ cleared: number }>> {
  const r = await fetchApi<{ cleared: number }>('/user-memory/clear', {
    method: 'POST',
    body: JSON.stringify({ userId, scope }),
  })
  if (r.success) {
    for (const [k] of localCache) {
      if (k.startsWith(`${userId}:`) && (!scope || k.includes(`:${scope}:`))) {
        localCache.delete(k)
      }
    }
  }
  return r
}
