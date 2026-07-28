'use client'

// 2026-07-28 立:SearchBar 三段式搜索面板的"历史"段数据 hook。
// 封装 localStorage 'searchHistory' 键的读写,带 SSR + quota exceeded 防护,
// 上限 10 条 + 提交去重(最新在前)。
// 用法:
//   const { history, addHistory, clearHistory } = useSearchHistory()
// 仅在客户端运行(window 守卫),可被任意 SearchBar 消费者独立使用。

import * as React from 'react'

const STORAGE_KEY = 'searchHistory'
const MAX_ITEMS = 10

function readFromStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

function writeToStorage(next: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota exceeded or storage unavailable — 静默降级 */
  }
}

function clearStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export interface UseSearchHistoryResult {
  history: string[]
  addHistory: (item: string) => void
  clearHistory: () => void
}

export function useSearchHistory(): UseSearchHistoryResult {
  const [history, setHistory] = React.useState<string[]>([])

  // 挂载后从 localStorage 读取(避免 SSR 时访问 window)
  React.useEffect(() => {
    setHistory(readFromStorage())
  }, [])

  const addHistory = React.useCallback((item: string) => {
    const trimmed = item.trim()
    if (!trimmed) return
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, MAX_ITEMS)
      writeToStorage(next)
      return next
    })
  }, [])

  const clearHistory = React.useCallback(() => {
    setHistory([])
    clearStorage()
  }, [])

  return { history, addHistory, clearHistory }
}
