// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import type { ChatMessage } from '@/stores/chat'
import { searchMessages } from '@/lib/message-search'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'

/** 层栈 id(见 @/lib/overlay-stack):消息列表页内搜索条(仅搜索条可见时占一层) */
const MESSAGE_LIST_SEARCH_OVERLAY_ID = 'message-list-search-bar'

export interface MessageListSearchOptions {
  messages: ChatMessage[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface MessageListSearchResult {
  searchBarVisible: boolean
  searchResultIds: string[]
  searchCurrentIndex: number
  searchResultSet: Set<string>
  searchCurrentId: string | null
  handleSearch: (query: string) => void
  handleSearchNavigate: (direction: 'prev' | 'next') => void
  handleSearchClose: () => void
  openSearch: () => void
}

/** Phase 23 消息搜索(2026-07-29 立):右键菜单"搜索消息" + Ctrl+F 快捷键
 *  → 弹出搜索栏 → 高亮匹配 + 滚动到第一个匹配。查询文本由 MessageSearchBar 内部 state 管理,
 *  本 hook 只追踪结果 ID 列表 + 当前定位索引 + 全局快捷键。 */
export function useMessageListSearch({
  messages,
  containerRef,
}: MessageListSearchOptions): MessageListSearchResult {
  const [searchResultIds, setSearchResultIds] = React.useState<string[]>([])
  const [searchCurrentIndex, setSearchCurrentIndex] = React.useState(0)
  const [searchBarVisible, setSearchBarVisible] = React.useState(false)
  // searchResultIds 的 Set 镜像,用于 O(1) 判断某消息是否匹配(避免每条消息 includes O(n))
  const searchResultSet = React.useMemo<Set<string>>(
    () => new Set(searchResultIds),
    [searchResultIds],
  )
  // 当前匹配的消息 ID(用于 MessageItem 的 isSearchCurrent prop)
  const searchCurrentId = searchResultIds[searchCurrentIndex] ?? null

  // 搜索输入回调:执行搜索 + 重置索引 + 滚动到第一个匹配
  const handleSearch = React.useCallback(
    (query: string) => {
      const ids = searchMessages(messages, query)
      setSearchResultIds(ids)
      setSearchCurrentIndex(0)
      // 第一个匹配自动滚动到视野
      if (ids.length > 0 && ids[0]) {
        const firstId = ids[0]
        requestAnimationFrame(() => {
          const el = containerRef.current?.querySelector(
            `[data-message-id="${firstId}"]`,
          ) as HTMLElement | null
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
    },
    [messages, containerRef],
  )

  // 上一个/下一个导航:切换 currentIndex + 滚动到对应消息
  const handleSearchNavigate = React.useCallback(
    (direction: 'prev' | 'next') => {
      setSearchResultIds((currentIds) => {
        if (currentIds.length === 0) return currentIds
        setSearchCurrentIndex((prevIdx) => {
          let nextIdx: number
          if (direction === 'next') {
            nextIdx = (prevIdx + 1) % currentIds.length
          } else {
            nextIdx = (prevIdx - 1 + currentIds.length) % currentIds.length
          }
          const targetId = currentIds[nextIdx]
          if (targetId) {
            requestAnimationFrame(() => {
              const el = containerRef.current?.querySelector(
                `[data-message-id="${targetId}"]`,
              ) as HTMLElement | null
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
          }
          return nextIdx
        })
        return currentIds
      })
    },
    [containerRef],
  )

  // 关闭搜索栏:清空所有搜索状态
  const handleSearchClose = React.useCallback(() => {
    setSearchBarVisible(false)
    setSearchResultIds([])
    setSearchCurrentIndex(0)
  }, [])

  // 打开搜索栏(Ctrl+F / 右键菜单"搜索"动作调用)
  const openSearch = React.useCallback(() => {
    setSearchBarVisible(true)
  }, [])

  // 全局快捷键:Ctrl+F 打开搜索栏 / Esc 关闭搜索栏
  // 注:与已有键盘导航监听器共存 —— 已有监听器对 Ctrl/Meta 修饰键 return,不拦截 Ctrl+F
  React.useEffect(() => {
    // 层栈:搜索条只在"可见"这一档占一层。不可见时必须出栈 —— 否则本层会压在
    // 已打开的弹层之上,而它的 Escape 分支因 searchBarVisible 为 false 什么都不做,
    // 结果是"按 Esc 谁都不退"的假死。
    if (searchBarVisible) pushOverlay(MESSAGE_LIST_SEARCH_OVERLAY_ID)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F / Cmd+F → 打开搜索栏(阻止浏览器原生 find)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchBarVisible(true)
        return
      }
      // Esc → 关闭搜索栏(搜索栏可见时)
      if (e.key === 'Escape' && searchBarVisible) {
        if (!isTopOverlay(MESSAGE_LIST_SEARCH_OVERLAY_ID)) return
        e.preventDefault()
        setSearchBarVisible(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      if (searchBarVisible) popOverlay(MESSAGE_LIST_SEARCH_OVERLAY_ID)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [searchBarVisible])

  return {
    searchBarVisible,
    searchResultIds,
    searchCurrentIndex,
    searchResultSet,
    searchCurrentId,
    handleSearch,
    handleSearchNavigate,
    handleSearchClose,
    openSearch,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
