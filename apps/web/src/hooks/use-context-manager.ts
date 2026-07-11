'use client'

import * as React from 'react'

export interface ContextEntry {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tokens?: number
  createdAt: number
}

export interface UseContextManagerReturn {
  entries: ContextEntry[]
  totalTokens: number
  maxTokens: number
  addEntry: (entry: Omit<ContextEntry, 'id' | 'createdAt'>) => void
  removeEntry: (id: string) => void
  updateEntry: (id: string, content: string) => void
  clear: () => void
  /** 超出 maxTokens 时自动截断旧条目，返回被移除数量 */
  truncate: (maxTokens: number) => number
}

let entrySeq = 0

/** 上下文管理 Hook，维护对话历史与 token 估算，支持截断 */
export function useContextManager(maxTokens = 8000): UseContextManagerReturn {
  const [entries, setEntries] = React.useState<ContextEntry[]>([])

  const totalTokens = React.useMemo(
    () => entries.reduce((sum, e) => sum + (e.tokens ?? estimateTokens(e.content)), 0),
    [entries],
  )

  const addEntry = React.useCallback((entry: Omit<ContextEntry, 'id' | 'createdAt'>) => {
    const id = `ctx-${++entrySeq}`
    setEntries((prev) => [
      ...prev,
      {
        ...entry,
        id,
        createdAt: Date.now(),
        tokens: entry.tokens ?? estimateTokens(entry.content),
      },
    ])
  }, [])

  const removeEntry = React.useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateEntry = React.useCallback((id: string, content: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, content, tokens: estimateTokens(content) } : e)),
    )
  }, [])

  const clear = React.useCallback(() => setEntries([]), [])

  const truncate = React.useCallback((limit: number) => {
    let removed = 0
    setEntries((prev) => {
      let tokens = prev.reduce((sum, e) => sum + (e.tokens ?? 0), 0)
      const next = [...prev]
      while (tokens > limit && next.length > 1) {
        const dropped = next.shift()
        tokens -= dropped?.tokens ?? 0
        removed++
      }
      return next
    })
    return removed
  }, [])

  return {
    entries,
    totalTokens,
    maxTokens,
    addEntry,
    removeEntry,
    updateEntry,
    clear,
    truncate,
  }
}

/** 简易 token 估算：英文 ~4 字符/token，中文 ~1.5 字符/token */
function estimateTokens(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  const other = text.length - cjk
  return Math.ceil(cjk / 1.5 + other / 4)
}
