// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 对话内「提示留痕」的 web 侧 store(2026-11 立,对齐 RN)。
 *
 * 立因:用户要求「凡 toast 都要在 AI 对话框里留痕」—— RN 侧已落 `NoticeLog` 挂在消息列表尾部,
 * web 侧此前只有 sonner 的 4s 瞬时光条,关掉就没了。本模块把 web 的 toast 也记一份,
 * 由 `ChatNoticeLog` 渲染在消息流尾部。
 *
 * 为什么用**模块级 store + window 无关的 Map**,而不是塞进 zustand chat store:
 * - 记录来源是 `Toaster` 的 window 事件总线(全局单点),它不认识任何 React 树;
 * - 多 pane 场景下 chat store 是工厂化的,「当前会话」在 store 里并不唯一,
 *   而 toast 本身是**全局 UI**(top-center 单实例),只能归属到「当前活跃会话」。
 *   故这里维护一个 `activeScope`,由 `MessageList` 挂载/切换时上报(最后挂载者胜出,
 *   与 toast 的全局单实例语义一致)。
 *
 * 行为契约(去重/上限/编解码)全部来自 `@ihui/shared/chat/notice-log` —— 与 RN 是同一份,
 * 不在本文件另写一套。
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  appendNotice,
  clearNoticeLog,
  loadNoticeLog,
  mergeNotices,
  noticeLogStorageKey,
  saveNoticeLog,
  type ChatNotice,
  type NoticeKind,
  type NoticeLogStorage,
} from '@ihui/shared/chat/notice-log'

const EMPTY: readonly ChatNotice[] = Object.freeze([])

const isDev = process.env.NODE_ENV !== 'production'

/**
 * localStorage 适配器。
 *
 * 吞掉异常是**刻意**的:Safari 隐私模式 / 配额写满时 localStorage 会直接抛,
 * 而留痕是辅助能力 —— 不能因为它把聊天页打成白屏。但 dev 一律告警,不做无声降级。
 */
const webStorage: NoticeLogStorage = {
  getItem: async (key) => {
    try {
      return window.localStorage.getItem(key)
    } catch (err) {
      if (isDev) console.warn('[notice-log] 读取本地存储失败,留痕降级为纯内存:', err)
      return null
    }
  },
  setItem: async (key, value) => {
    try {
      window.localStorage.setItem(key, value)
    } catch (err) {
      if (isDev) console.warn('[notice-log] 写入本地存储失败,留痕仅在本次会话可见:', err)
    }
  },
  removeItem: async (key) => {
    try {
      window.localStorage.removeItem(key)
    } catch (err) {
      if (isDev) console.warn('[notice-log] 清除本地存储失败:', err)
    }
  },
}

/** 按存储键缓存记录(键已含会话维度,见 shared 的 `noticeLogStorageKey`) */
const logs = new Map<string, readonly ChatNotice[]>()
/** 已从存储读回过的键 —— 未读回前不写盘,否则首帧空数组会把磁盘上的旧记录清掉 */
const ready = new Set<string>()
const listeners = new Set<() => void>()

/** 当前活跃会话(由 MessageList 上报)。null = 新会话(落 draft 键) */
let activeScope: string | null = null
/** 记录 id 的会话内前缀:避免跨重启与磁盘上的旧记录撞 id(同 RN 侧处理) */
const sessionNonce = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
let seq = 0

function emit(): void {
  for (const fn of listeners) fn()
}

function flush(conversationId: string | null): void {
  const key = noticeLogStorageKey(conversationId)
  const list = logs.get(key) ?? EMPTY
  void saveNoticeLog(webStorage, conversationId, list).catch((err: unknown) => {
    if (isDev) console.warn('[notice-log] 写盘失败,留痕仅在内存:', err)
  })
}

async function hydrate(conversationId: string | null): Promise<void> {
  const key = noticeLogStorageKey(conversationId)
  if (ready.has(key)) return
  let loaded: ChatNotice[] = []
  try {
    loaded = await loadNoticeLog(webStorage, conversationId)
  } catch (err) {
    if (isDev) console.warn('[notice-log] 读回失败,本次留痕仅存活于内存:', err)
  }
  // 读回期间可能已经记了新条目 ⇒ 合并而非覆盖(mergeNotices 按 id 去重、按时刻排序)
  const prev = logs.get(key) ?? EMPTY
  const merged = mergeNotices(loaded, prev)
  logs.set(key, merged)
  ready.add(key)
  emit()
  // 空列表不回写:盘上本来就是空的,再写一遍只会给每个会话留一枚无信息的键。
  // 「清空」由 clearNotices 显式负责,不靠这里顺带完成。
  if (merged.length > 0) flush(conversationId)
}

/** MessageList 挂载/切换会话时上报作用域。 */
export function setNoticeScope(conversationId: string | null): void {
  activeScope = conversationId
  const key = noticeLogStorageKey(conversationId)
  if (ready.has(key)) return
  void hydrate(conversationId)
}

/** 记一条留痕(由 Toaster 的总线单点调用;fire-and-forget,永不抛错)。 */
export function recordNotice(kind: NoticeKind, text: string): void {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return
  const conversationId = activeScope
  const key = noticeLogStorageKey(conversationId)
  const prev = logs.get(key) ?? EMPTY
  const next = appendNotice(prev, {
    id: `${sessionNonce}-${++seq}`,
    kind,
    text: trimmed,
    ts: Date.now(),
  })
  logs.set(key, next)
  emit()
  if (ready.has(key)) flush(conversationId)
  else void hydrate(conversationId)
}

/** 主动清空某会话的留痕(新建对话 / 清空对话时调用)。 */
export function clearNotices(conversationId: string | null = activeScope): void {
  const key = noticeLogStorageKey(conversationId)
  logs.set(key, EMPTY)
  ready.add(key)
  emit()
  void clearNoticeLog(webStorage, conversationId).catch((err: unknown) => {
    if (isDev) console.warn('[notice-log] 清除失败(不影响本次使用):', err)
  })
}

function subscribeKey(fn: () => void): () => void {
  // 全量广播即可:`useSyncExternalStore` 会用快照做等值判定,未变更的订阅者不会真的重渲染,
  // 而按 key 过滤反而容易写错(记录先于 hydrate 落进 logs 时会漏通知)。
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * 订阅某会话的留痕。
 *
 * 快照必须**引用稳定**(`useSyncExternalStore` 的硬要求):未变更时一律返回同一个数组,
 * 否则每次渲染都会判「变了」并无限重渲染。`logs` 只在真正追加/清空时换引用。
 */
export function useNoticeLog(conversationId: string | null): readonly ChatNotice[] {
  const key = noticeLogStorageKey(conversationId)
  const subscribe = useCallback((fn: () => void) => subscribeKey(fn), [])
  const getSnapshot = useCallback(() => logs.get(key) ?? EMPTY, [key])
  const getServerSnapshot = useCallback(() => EMPTY, [])
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    // 挂载/切会话:上报作用域(供 Toaster 记录时定位)+ 确保已读回
    setNoticeScope(conversationId)
  }, [conversationId])

  return list
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
