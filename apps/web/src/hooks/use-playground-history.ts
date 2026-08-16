'use client'

/**
 * Playground 历史记录 hook:localStorage 持久化最近 10 条调用记录。
 * SSR 安全(localStorage 仅在 effect 中读取)。
 */

import * as React from 'react'
import type { PlaygroundHistoryItem } from '@/components/playground/PlaygroundTypes'

const STORAGE_KEY = 'ihui-playground-history'
const MAX_HISTORY = 10

function isHistoryItem(v: unknown): v is PlaygroundHistoryItem {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.timestamp === 'number' && Array.isArray(o.messages)
}

function loadFromStorage(): PlaygroundHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter(isHistoryItem).slice(0, MAX_HISTORY)
    }
  } catch {
    // 损坏的 localStorage 静默忽略
  }
  return []
}

function saveToStorage(items: PlaygroundHistoryItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {
    // 配额超限静默忽略
  }
}

export function usePlaygroundHistory() {
  const [history, setHistory] = React.useState<PlaygroundHistoryItem[]>([])
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    setHistory(loadFromStorage())
    setLoaded(true)
  }, [])

  const addHistory = React.useCallback((item: PlaygroundHistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, MAX_HISTORY)
      saveToStorage(next)
      return next
    })
  }, [])

  const clearHistory = React.useCallback(() => {
    setHistory([])
    saveToStorage([])
  }, [])

  const removeHistory = React.useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id)
      saveToStorage(next)
      return next
    })
  }, [])

  return { history, addHistory, clearHistory, removeHistory, loaded }
}
