// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useState, useCallback, useRef, useMemo, useEffect, type RefObject } from 'react'

import { searchMessages } from '@/lib/message-search'

/** 搜索结果项(带摘要预览与时间 —— 这是本 hook 相对既有搜索的唯一增项) */
export interface SearchResult {
  id: string
  preview: string
  createTime: string
}

/**
 * 消息类型(最小约束):id + content 两个字段就是匹配面,时间字段两种书写都收
 * (`createdAt` 毫秒数 = web 端 ChatMessage 的真实字段;`createTime` 是旧架构遗留)。
 */
interface SearchableMessage {
  id: string
  content: string
  createdAt?: string | number | Date
  createTime?: string | number | Date
}

/** useChatSearch 依赖的外部上下文 */
interface UseChatSearchOptions<T extends SearchableMessage> {
  /** 消息列表(用于搜索过滤) */
  messages: T[]
  /** 消息容器引用:既用于判定可见,也用于按 `[data-message-id]` 定位目标消息 */
  messagesContainerRef: RefObject<HTMLElement | null>
  /** 「找不到该消息」的本地化文案(由调用方经 useTranslations 取;**不得**在此硬编码中文) */
  notFoundMessage?: string
  /** 警告提示函数 */
  showWarning?: (msg: string) => void
}

/** 预览摘要截断长度(与原实现同值,不借本票改观感口径) */
const PREVIEW_MAX = 100

/**
 * 可安全拼进 `[data-message-id="…"]` 选择器的 id 字符集。
 * 消息 id 一律是 UUID / 后端雪花串;含引号或方括号的"id"要么是脏数据要么是
 * 选择器注入 —— querySelector 遇非法选择器会抛 SyntaxError(点击即崩),
 * 所以这里宁可直接判"定位不到"走提示分支,也不把外来串拼进选择器。
 */
const SAFE_MESSAGE_ID_RE = /^[A-Za-z0-9_-]+$/

/** 把 ChatMessage 的 createdAt(毫秒)或旧字段 createTime 归一成正文时间字符串 */
function toTimeText(value: string | number | Date | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  return String(value)
}

/**
 * 聊天搜索逻辑 hook —— **结果预览列表**的状态机。
 *
 * 分工(2026-09-27 V3 #62 接线时定,勿再扩):
 *  · 输入框、Ctrl+F/Cmd+F 打开、Esc 关闭、上一个/下一个导航、消息内高亮
 *    —— 全部归 `components/chat/message-list/use-message-list-search.ts`(唯一入口);
 *  · 本 hook 只做「把当前查询投影成可点选的摘要列表 + 点选后滚动定位」这一件事。
 *  两者**共用同一条匹配规则**:都走 `@ihui/shared` 的 `searchMessages`
 *  (大小写不敏感 + 正则元字符转义)。本文件此前自带一份 `toLowerCase().includes()`
 *  的第二实现 —— 那正是"两处算同一件事必然漂移"的形状,已改为委托。
 *
 * 为什么不再自带 `showSearchBar`/`toggleSearch`:搜索条可见态由既有入口拥有,
 * 这里再留一份就是第二个开关(两个真相源),故 2026-09-27 接线时删除。
 * 滚动定位原依赖 `messageRefs: RefObject<Map<string, HTMLElement>>`,而全仓没有任何
 * 组件维护这样一张 Map(该契约结构上无法满足)—— 现按消息流统一口径
 * `[data-message-id="<id>"]` 在容器内取节点(与 use-message-list-search /
 * query-thumb-rail / pendingJump 三处同一机制)。
 */
export function useChatSearch<T extends SearchableMessage>({
  messages,
  messagesContainerRef,
  notFoundMessage,
  showWarning,
}: UseChatSearchOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 2026-08-02 修复 P1 内存泄露 + 陈旧闭包:debouncedSearch 的 timer 提取到 ref,
  // 卸载时清理;原 useMemo 局部 timer 在卸载时无法清理,
  // 且 useMemo 重建时旧 timer 仍运行会用过期的 messages 调用 handleSearch。
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 执行搜索：按共享匹配规则过滤消息内容，生成预览（前 100 字符） */
  const handleSearch = useCallback(
    (query?: string) => {
      const q = (query ?? searchQuery).trim()
      if (!q) {
        setSearchResults([])
        return
      }
      // 命中集合来自**唯一**匹配出口(大小写不敏感 + 正则转义都在那侧),
      // 本处只做"命中 id → 摘要预览"的投影,不再判一次匹配。
      const hitIds = new Set(searchMessages(messages, q))
      const results = messages
        .filter((msg) => hitIds.has(msg.id))
        .map((msg) => ({
          id: msg.id,
          preview: (msg.content ?? '').substring(0, PREVIEW_MAX),
          createTime: toTimeText(msg.createdAt ?? msg.createTime),
        }))
      setSearchResults(results)
    },
    [messages, searchQuery],
  )

  // P1 防抖(2026-07-23):200ms 防抖,避免长对话搜索卡顿
  // 2026-08-02 修复:timer 提取到 debounceTimerRef,卸载时清理
  const debouncedSearch = useMemo(() => {
    return (query?: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => handleSearch(query), 200)
    }
  }, [handleSearch])

  // 2026-08-02 修复 P1 内存泄露:卸载时清理 highlightTimer 和 debounceTimerRef,
  // 避免 2 秒后 setState 在已卸载组件调用。
  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  /** 滚动到指定消息：平滑滚动到消息中心，高亮 2 秒后取消 */
  const scrollToMessage = useCallback(
    (messageId: string) => {
      if (!messageId) return
      const container = messagesContainerRef.current
      // 消息流统一以 [data-message-id] 暴露可定位节点(高亮/跳转/缩略条同一机制),
      // 本处不再要求调用方另维护一张 id→element 的 Map(全仓无人维护那样的 Map)。
      const element =
        container && SAFE_MESSAGE_ID_RE.test(messageId)
          ? container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
          : null
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setSelectedMessageId(messageId)
        if (highlightTimer.current) clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => setSelectedMessageId(null), 2000)
      } else if (notFoundMessage) {
        showWarning?.(notFoundMessage)
      }
    },
    [messagesContainerRef, notFoundMessage, showWarning],
  )

  /** 清空搜索态(搜索条关闭时调用,否则隐藏的列表会留着上一次的命中) */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    setSearchQuery('')
    setSearchResults([])
    setSelectedMessageId(null)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    selectedMessageId,
    handleSearch,
    debouncedSearch,
    scrollToMessage,
    clearSearch,
  }
}
