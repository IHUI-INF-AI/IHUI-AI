'use client'

// 2026-07-28 立:SearchBar 三段式搜索面板的"历史"段数据 hook。
// 2026-08-01 重构:接入 @ihui/shared 的 createUseHistoryStorage 工厂,
//   消除端内重复的 localStorage 读写 + useState/useEffect 同步逻辑(AGENTS.md §3 共享层优先)。
// 封装 localStorage 'searchHistory' 键的读写,带 SSR + quota exceeded 防护,
// 上限 10 条 + 提交去重(最新在前)。
// 用法:
//   const { history, addHistory, clearHistory } = useSearchHistory()
// 仅在客户端运行(SSR 安全 transport),可被任意 SearchBar 消费者独立使用。

import { createHistoryStorage } from '@ihui/shared/utils/storage'
import { createUseHistoryStorage } from '@ihui/shared/hooks/use-storage'
import { createSSRSafeWebTransport } from '@/stores/storage-adapter'

const SEARCH_HISTORY_KEY = 'searchHistory'
const MAX_ITEMS = 10

// 模块级构造 transport + storage + hook 工厂(避免每次渲染重建)
const transport = createSSRSafeWebTransport()
const searchHistoryStorage = createHistoryStorage<string>({
  transport,
  key: SEARCH_HISTORY_KEY,
  maxItems: MAX_ITEMS,
})
const useSearchHistoryStorage = createUseHistoryStorage<string>({ storage: searchHistoryStorage })

export interface UseSearchHistoryResult {
  history: string[]
  addHistory: (item: string) => void
  clearHistory: () => void
}

export function useSearchHistory(): UseSearchHistoryResult {
  const { list, push, clear } = useSearchHistoryStorage()
  return {
    history: list,
    // 保留原 trim 行为(空串/纯空白跳过),fire-and-forget 与原同步语义一致
    addHistory: (item: string) => {
      const trimmed = item.trim()
      if (!trimmed) return
      void push(trimmed)
    },
    clearHistory: () => {
      void clear()
    },
  }
}
