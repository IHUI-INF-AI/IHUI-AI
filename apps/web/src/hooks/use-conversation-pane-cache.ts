// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 票60 步序六(2026-10-21 立):会话切换缓存 + 向上翻页态的**窗格化唯一出口**。
 *
 * **为什么必须有**:切换会话的 LRU(#11,2026-07-25 立)此前只住在 AISidePanel 根主体里,
 * 键 = conversationId。多窗格后同一条 conversationId 可以同时被根窗格与非根窗格承载 ⇒
 * ①非根窗格写不进缓存(ChatPaneBody 原本零缓存,每次切换全量重取、闪一次空列表);
 * ②两窗格读写同一只桶,一方切回时拿对方那份快照把自己顶掉(快照彼此不可区分,谁后写谁赢)。
 * 持久层早已按 `ihui-chat-pane-<paneId>` 分家(chat-panes.ts),内存层没跟上,本文件补这一格。
 *
 * **身份来源只有一个**:桶键的窗格半边取 `useOptionalPaneId()`(chat-pane-context.tsx),
 * 与 `usePaneChatStore()` 选中 store 实例用的是同一个值 —— 再开第三套身份来源(比如把
 * paneId prop 传进键里)就会让"缓存桶"与"store 实例"两本账分叉。根窗格不挂 Provider,
 * 该 hook 返回 null,按 ROOT_PANE_ID 归档。
 *
 * 桶存在模块级(与 chat-panes.ts 的实例注册表同形):按组件实例存一份 Map 的话,
 * 窗格这一维在键里也不会有人来踩,反证用例复现不出"顶掉"这一型 ⇒ 存续面必须共享。
 * 淘汰上限按**每个窗格各 5 份**计(一根窗格的翻页不该把某非根窗格的快照挤掉)。
 */

import * as React from 'react'

import { ROOT_PANE_ID } from '@ihui/shared/chat/multi-pane'
import { useOptionalPaneId } from '@/stores/chat-pane-context'
import type { ChatMessage } from '@/stores/chat'

/** 每个窗格最多留几份会话快照(沿用 #11 的档;超限按插入序淘汰该窗格最早使用的) */
export const CONVERSATION_CACHE_LIMIT = 5

/** 一次会话切换要记住的东西:消息 + 向上翻页的 keyset 游标与"还有更早"判定 */
export interface ConversationCacheEntry {
  messages: ChatMessage[]
  hasMore: boolean
  oldestCursor: string | null
}

const KEY_SEPARATOR = '::'

/** 窗格半边:根窗格(无 Provider)统一归档到 ROOT_PANE_ID,不给它再造一个"null 桶" */
function paneBucketOf(paneId: string | null): string {
  return paneId ?? ROOT_PANE_ID
}

/**
 * 缓存桶身份 = 窗格 + 会话**二元**身份。
 * 只按 conversationId 建键 ⇒ 两窗格同承载一条会话时互相顶掉快照(缺陷本体)。
 * 分隔符 `::`:会话 id 是库内数字/uuid、窗格 id 是 `pane-*`,两者都不含该串。
 */
export function conversationCacheKey(paneId: string | null, conversationId: string): string {
  return `${paneBucketOf(paneId)}${KEY_SEPARATOR}${conversationId}`
}

function paneKeyPrefix(paneId: string | null): string {
  return `${paneBucketOf(paneId)}${KEY_SEPARATOR}`
}

/** 全部窗格共用的快照表(插入序即 LRU 序;delete + set 完成"最近使用"提升) */
const cacheEntries = new Map<string, ConversationCacheEntry>()

/**
 * 快照落盘键(G-935 缺口B):内存 Map 此前随 reload 清零 ⇒ 窗格历史基线(含半截流孤儿)
 * 只能靠窗格 chat store 的 recentMessages 单腿恢复;这里补第二腿,切回/reload 后同步命中缓存。
 */
export const CONVERSATION_PANE_CACHE_PERSIST_KEY = 'ihui-conversation-pane-cache'

let hydrated = false
let persistTimer: ReturnType<typeof setTimeout> | null = null

function isValidCacheEntry(value: unknown): value is ConversationCacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    Array.isArray(entry.messages) &&
    typeof entry.hasMore === 'boolean' &&
    (entry.oldestCursor === null || typeof entry.oldestCursor === 'string')
  )
}

/**
 * 惰性装载(首个读写触点才碰 storage,SSR/无 storage 静默跳过 —— 与 pane-split.ts 同一挂载后纪律)。
 * 坏 blob ⇒ 清键回落空表;单条不合法只丢该条,不牵连整表(键是 `pane-*::conv-*` 自拼,可信面按条判)。
 */
function ensureHydrated(): void {
  if (hydrated) return
  hydrated = true
  if (typeof window === 'undefined') return
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(CONVERSATION_PANE_CACHE_PERSIST_KEY)
  } catch {
    return
  }
  if (raw === null) return
  let entries: unknown
  try {
    const blob = JSON.parse(raw) as { entries?: unknown }
    entries = blob.entries
  } catch {
    entries = undefined
  }
  if (!Array.isArray(entries)) {
    try {
      window.localStorage.removeItem(CONVERSATION_PANE_CACHE_PERSIST_KEY)
    } catch {
      /* storage 不可用:内存表已保持为空,清键失败只影响下次启动 */
    }
    return
  }
  for (const item of entries) {
    if (!Array.isArray(item) || item.length !== 2) continue
    const [key, entry] = item as [unknown, unknown]
    if (typeof key !== 'string' || !isValidCacheEntry(entry)) continue
    cacheEntries.set(key, entry)
  }
}

/** 落盘(200ms 合批:流式增量下 patch 高频,整表 stringify 不能跟着每帧跑) */
function persistCache(): void {
  if (typeof window === 'undefined') return
  if (persistTimer !== null) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    try {
      window.localStorage.setItem(
        CONVERSATION_PANE_CACHE_PERSIST_KEY,
        JSON.stringify({ entries: [...cacheEntries.entries()] }),
      )
    } catch {
      /* 配额满/隐私模式:内存快照仍是唯一真相面,落盘尽力而为 */
    }
  }, 200)
}

/** 读快照;命中即提为最近使用(LRU)。未命中返回 null = 该窗格需要自己拉取 */
export function readConversationCache(
  paneId: string | null,
  conversationId: string,
): ConversationCacheEntry | null {
  ensureHydrated()
  const key = conversationCacheKey(paneId, conversationId)
  const entry = cacheEntries.get(key) ?? null
  if (entry) {
    cacheEntries.delete(key)
    cacheEntries.set(key, entry)
  }
  return entry
}

/** 写快照,并把该窗格的快照数裁到上限(只裁自己前缀,不碰别的窗格) */
export function writeConversationCache(
  paneId: string | null,
  conversationId: string,
  entry: ConversationCacheEntry,
): void {
  ensureHydrated()
  const key = conversationCacheKey(paneId, conversationId)
  cacheEntries.delete(key)
  cacheEntries.set(key, entry)
  const prefix = paneKeyPrefix(paneId)
  let aliveInPane = 0
  for (const cachedKey of cacheEntries.keys()) {
    if (cachedKey.startsWith(prefix)) aliveInPane += 1
  }
  while (aliveInPane > CONVERSATION_CACHE_LIMIT) {
    for (const cachedKey of cacheEntries.keys()) {
      if (!cachedKey.startsWith(prefix)) continue
      cacheEntries.delete(cachedKey)
      break
    }
    aliveInPane -= 1
  }
  persistCache()
}

/**
 * 就地回写某桶的消息引用(引用没变则整段跳过,避免无变化时重复写入)。
 * 分页态由调用方在结算时一并传入 —— 组件实例里的 hasMore state 更新是异步的,
 * 所以出口用 ref 镜像把"刚翻页那一刻"的现值带过来,不能等到下次渲染才写。
 */
export function patchConversationCache(
  paneId: string | null,
  conversationId: string,
  messages: ChatMessage[],
  pager: { hasMore: boolean; oldestCursor: string | null },
): void {
  ensureHydrated()
  const entry = cacheEntries.get(conversationCacheKey(paneId, conversationId))
  if (!entry || entry.messages === messages) return
  entry.messages = messages
  entry.hasMore = pager.hasMore
  entry.oldestCursor = pager.oldestCursor
  persistCache()
}

/** 摘除某窗格的全部快照(窗格关闭/主体卸载;不摘 = 长会话内存只增不减) */
function dropConversationCacheForPane(paneId: string | null): void {
  ensureHydrated()
  const prefix = paneKeyPrefix(paneId)
  let dropped = false
  for (const key of [...cacheEntries.keys()]) {
    if (key.startsWith(prefix)) {
      cacheEntries.delete(key)
      dropped = true
    }
  }
  if (dropped) persistCache()
}

/** 测试/宿主重置:清空全部快照(落盘键一并清掉,否则下次装载又灌回来) */
export function resetConversationCache(): void {
  cacheEntries.clear()
  hydrated = false
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CONVERSATION_PANE_CACHE_PERSIST_KEY)
  } catch {
    /* storage 不可用:内存已清空即达目的 */
  }
}

/** 某窗格现存快照数(省略 paneId = 全部窗格合计);只给用例与取证用,不进生产判定 */
function conversationCacheSize(paneId?: string | null): number {
  ensureHydrated()
  if (paneId === undefined) return cacheEntries.size
  const prefix = paneKeyPrefix(paneId)
  let count = 0
  for (const key of cacheEntries.keys()) {
    if (key.startsWith(prefix)) count += 1
  }
  return count
}

export interface ConversationPaneCache {
  /** 当前窗格身份(null = 根窗格/单例) */
  readonly paneId: string | null
  /** 该窗格内某会话的桶键(取证用;读写一律走 read/write,不必手拼) */
  readonly cacheKeyOf: (conversationId: string) => string
  readonly read: (conversationId: string) => ConversationCacheEntry | null
  readonly write: (conversationId: string, entry: ConversationCacheEntry) => void
  /** 回写当前会话的消息引用,分页态取本窗格现值 */
  readonly patch: (conversationId: string, messages: ChatMessage[]) => void
  readonly size: () => number
  /** 是否还有更早的历史(每窗格各一份) */
  hasMoreHistory: boolean
  setHasMoreHistory: (value: boolean) => void
  /** 翻页请求在途(防滚动重复触发) */
  loadingMoreHistory: boolean
  setLoadingMoreHistory: (value: boolean) => void
  /** 下一页 keyset 复合游标;null = 没有可翻的更早页 */
  oldestCursorRef: React.RefObject<string | null>
  /** 一次性换装游标 + hasMore(切会话/缓存命中时用,不留两次 setState 的中间态) */
  resetPager: (oldestCursor: string | null, hasMore: boolean) => void
}

export function useConversationPaneCache(): ConversationPaneCache {
  const paneId = useOptionalPaneId()
  const oldestCursorRef = React.useRef<string | null>(null)
  const [hasMoreHistory, setHasMoreHistoryState] = React.useState(false)
  const [loadingMoreHistory, setLoadingMoreHistoryState] = React.useState(false)
  // hasMore 的同步镜像:patch 要在"翻页刚结算"的那一刻读现值
  const hasMoreRef = React.useRef(false)

  const setHasMoreHistory = React.useCallback((value: boolean) => {
    hasMoreRef.current = value
    setHasMoreHistoryState(value)
  }, [])

  const setLoadingMoreHistory = React.useCallback(
    (value: boolean) => setLoadingMoreHistoryState(value),
    [],
  )

  const resetPager = React.useCallback(
    (oldestCursor: string | null, hasMore: boolean) => {
      oldestCursorRef.current = oldestCursor
      setHasMoreHistory(hasMore)
    },
    [setHasMoreHistory],
  )

  const cacheKeyOf = React.useCallback(
    (conversationId: string) => conversationCacheKey(paneId, conversationId),
    [paneId],
  )

  const read = React.useCallback(
    (conversationId: string): ConversationCacheEntry | null =>
      readConversationCache(paneId, conversationId),
    [paneId],
  )

  const write = React.useCallback(
    (conversationId: string, entry: ConversationCacheEntry): void => {
      writeConversationCache(paneId, conversationId, entry)
    },
    [paneId],
  )

  const patch = React.useCallback(
    (conversationId: string, messages: ChatMessage[]): void => {
      patchConversationCache(paneId, conversationId, messages, {
        hasMore: hasMoreRef.current,
        oldestCursor: oldestCursorRef.current,
      })
    },
    [paneId],
  )

  const size = React.useCallback(() => conversationCacheSize(paneId), [paneId])

  // 卸载即释放本窗格的消息引用(只摘自己那半格,别的窗格不受影响)
  React.useEffect(() => {
    return () => {
      dropConversationCacheForPane(paneId)
    }
  }, [paneId])

  return React.useMemo(
    () => ({
      paneId,
      cacheKeyOf,
      read,
      write,
      patch,
      size,
      hasMoreHistory,
      setHasMoreHistory,
      loadingMoreHistory,
      setLoadingMoreHistory,
      oldestCursorRef,
      resetPager,
    }),
    [
      paneId,
      cacheKeyOf,
      read,
      write,
      patch,
      size,
      hasMoreHistory,
      setHasMoreHistory,
      loadingMoreHistory,
      setLoadingMoreHistory,
      oldestCursorRef,
      resetPager,
    ],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
