'use client'

import { useState, useCallback, useRef, useMemo, type RefObject } from 'react'

/** 搜索结果项 */
export interface SearchResult {
  id: string
  preview: string
  createTime: string
}

/** 消息类型（最小约束，兼容各种 ChatMessage 结构） */
interface SearchableMessage {
  id: string
  content: string
  createTime?: string | number | Date
}

/** useChatSearch 依赖的外部上下文 */
interface UseChatSearchOptions<T extends SearchableMessage> {
  /** 消息列表（用于搜索过滤） */
  messages: T[]
  /** 消息元素引用 Map（用于滚动定位） */
  messageRefs: RefObject<Map<string, HTMLElement>>
  /** 消息容器引用（用于判断可见性） */
  messagesContainerRef: RefObject<HTMLElement | null>
  /** 警告提示函数 */
  showWarning?: (msg: string) => void
}

/**
 * 聊天搜索逻辑 hook
 *
 * 从旧架构 client/src/components/ai/composables/useChatSearch.ts 迁移至 React hook。
 * - showSearchBar: 搜索栏显示/隐藏
 * - searchQuery: 搜索关键词
 * - searchResults: 搜索结果列表
 * - selectedMessageId: 当前选中的消息 ID（滚动定位高亮）
 * - toggleSearch: 切换搜索栏显示
 * - handleSearch: 执行搜索
 * - scrollToMessage: 滚动到指定消息
 */
export function useChatSearch<T extends SearchableMessage>({
  messages,
  messageRefs,
  messagesContainerRef,
  showWarning,
}: UseChatSearchOptions<T>) {
  const [showSearchBar, setShowSearchBar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 切换搜索栏显示状态：关闭时清空关键词与结果 */
  const toggleSearch = useCallback(() => {
    setShowSearchBar((prev) => {
      const next = !prev
      if (!next) {
        setSearchQuery('')
        setSearchResults([])
      }
      return next
    })
  }, [])

  /** 执行搜索：按关键词过滤消息内容，生成预览（前 100 字符） */
  const handleSearch = useCallback(
    (query?: string) => {
      const q = (query ?? searchQuery).trim()
      if (!q) {
        setSearchResults([])
        return
      }
      const lower = q.toLowerCase()
      const results = messages
        .filter((msg) => msg.content?.toLowerCase().includes(lower))
        .map((msg) => ({
          id: msg.id,
          preview: msg.content.substring(0, 100),
          createTime: String(msg.createTime ?? ''),
        }))
      setSearchResults(results)
    },
    [messages, searchQuery],
  )

  // P1 防抖(2026-07-23):200ms 防抖,避免长对话搜索卡顿
  const debouncedSearch = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (query?: string) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => handleSearch(query), 200)
    }
  }, [handleSearch])

  /** 滚动到指定消息：平滑滚动到消息中心，高亮 2 秒后取消 */
  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!messageId) return
      const element = messageRefs.current?.get(messageId)
      if (element && messagesContainerRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setSelectedMessageId(messageId)
        if (highlightTimer.current) clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => setSelectedMessageId(null), 2000)
      } else {
        showWarning?.('消息未找到')
      }
    },
    [messageRefs, messagesContainerRef, showWarning],
  )

  return {
    showSearchBar,
    searchQuery,
    searchResults,
    selectedMessageId,
    toggleSearch,
    debouncedSearch,
    scrollToMessage,
    setSearchQuery,
  }
}
