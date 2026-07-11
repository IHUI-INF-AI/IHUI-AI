'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface UseApiCacheReturn {
  /** 缓存数据 */
  data: unknown
  /** 是否正在加载（含首次与刷新） */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 首次加载是否已完成 */
  ready: boolean
  /** 主动刷新（绕过缓存） */
  refresh: () => Promise<void>
  /** 手动写入缓存 */
  setData: (data: unknown) => void
}

interface CacheEntry {
  data: unknown
  ts: number
}

const cacheMap = new Map<string, CacheEntry>()

const MAX_CACHE_SIZE = 100

function setCacheEntry(key: string, data: unknown) {
  if (cacheMap.size >= MAX_CACHE_SIZE) {
    const firstKey = cacheMap.keys().next().value
    if (firstKey) cacheMap.delete(firstKey)
  }
  cacheMap.set(key, { data, ts: Date.now() })
}

/**
 * API 缓存 Hook
 *
 * 以 url 为 key 在模块级 Map 中缓存成功结果，ttl 内直接返回缓存，
 * 超时或调用 refresh 时重新拉取。多组件共享同一 key 时复用缓存。
 */
export function useApiCache(
  url: string,
  options: { ttl?: number; enabled?: boolean } = {},
): UseApiCacheReturn {
  const { ttl = 60_000, enabled = true } = options
  const [data, setDataState] = React.useState<unknown>(cacheMap.get(url)?.data ?? null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  const fetchData = React.useCallback(
    async (force = false) => {
      if (!url) return
      const cached = cacheMap.get(url)
      if (!force && cached && Date.now() - cached.ts < ttl) {
        setDataState(cached.data)
        setReady(true)
        return
      }
      setLoading(true)
      setError(null)
      const res = await fetchApi<unknown>(url)
      if (res.success) {
        setCacheEntry(url, res.data)
        setDataState(res.data)
      } else {
        setError(res.error)
      }
      setLoading(false)
      setReady(true)
    },
    [url, ttl],
  )

  React.useEffect(() => {
    if (!enabled) return
    fetchData(false)
  }, [enabled, fetchData])

  const refresh = React.useCallback(async () => fetchData(true), [fetchData])
  const setData = React.useCallback(
    (d: unknown) => {
      setCacheEntry(url, d)
      setDataState(d)
    },
    [url],
  )

  return { data, loading, error, ready, refresh, setData }
}

/** 类型化版本，便于调用方获得具体类型 */
export function useApiCacheTyped<T>(
  url: string,
  options?: { ttl?: number; enabled?: boolean },
): {
  data: T | null
  loading: boolean
  error: string | null
  ready: boolean
  refresh: () => Promise<void>
} {
  const result = useApiCache(url, options)
  return { ...result, data: (result.data as T | null) ?? null }
}
