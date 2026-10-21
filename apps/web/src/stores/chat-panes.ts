// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票60(2026-10-18 立,第一切片):多窗格 chat store 实例注册表。
 *
 * 真并行多窗格的第一格:会话承载状态从 `conversationId` 单例(useChatStore)
 * 走向 `Map<paneId, Store>`。每个窗格从本表取独立实例(独立 messages/isStreaming/
 * abort 域),互不串话;默认单例 useChatStore 不动,既有消费面零回归。
 *
 * 本切片只交付注册表与隔离性证明(单测);把 AISidePanel/MessageList/send-message
 * 按 paneId 寻址是后续切片(见 PROJECT_PLAN 票 60 实施方案的步序表)。
 *
 * persist name 按窗格隔离(`ihui-chat-pane-<paneId>`):两条实例共用一个
 * localStorage key 会互相覆盖快照 —— 单测里有这一格的断言。
 */

import { createChatStore, type ChatState } from './chat'
import type { StoreApi, UseBoundStore } from 'zustand'

export type ChatStore = UseBoundStore<StoreApi<ChatState>>

/** paneId → 独立 store 实例;默认单例不进表(它不是任何窗格的财产) */
const paneStores = new Map<string, ChatStore>()

/**
 * store 实例 → paneId 反查(2026-10-21 立,票60 普查批)。
 * 发送链(send-message / send-answer / resume-stream / 斜杠命令)是**非 React 面**,
 * 手里只有显式传入的 chatStore,没有 paneId —— 但 mode/timeline 这类伴生 store 要按窗格
 * 寻址才能不互串。反查表在 getChatStoreForPane 建实例时登记:根单例从不进表 ⇒ 查得 null
 * ⇒ 伴生 store 自然回落根单例,与 React 面 useOptionalPaneId 的回落语义同一条判据。
 * WeakMap:实例被 dispose 后不阻止回收(paneIdByStore.delete 同步清,防悬挂)。
 */
const paneIdByStore = new WeakMap<ChatStore, string>()

/**
 * 取某窗格的 store 实例(懒建:第一次取时创建,之后复用同一实例)。
 * paneId 空串/空白按调用方 bug 处理:直接抛 —— 静默回落单例会把两窗格
 * 的状态悄悄并到一份,那正是本票要消灭的缺陷形态。
 */
export function getChatStoreForPane(paneId: string): ChatStore {
  const key = paneId.trim()
  if (!key)
    throw new Error('getChatStoreForPane: paneId 不能为空(静默回落单例 = 两窗格共用一份状态)')
  const existing = paneStores.get(key)
  if (existing) return existing
  const created = createChatStore(`ihui-chat-pane-${key}`)
  paneStores.set(key, created)
  paneIdByStore.set(created, key)
  return created
}

/**
 * 反查:chatStore 实例属于哪个窗格(发送链的伴生 store 寻址入口)。
 * 根单例 / 未登记实例(测试直接 createChatStore 造出来的)⇒ null,调用方回落根单例。
 */
export function paneIdForChatStore(store: ChatStore): string | null {
  return paneIdByStore.get(store) ?? null
}

/** 关闭窗格时回收实例(不回收 = 长会话内存只增不减;persist 快照留在 localStorage) */
export function disposeChatStoreForPane(paneId: string): void {
  const key = paneId.trim()
  const existing = paneStores.get(key)
  if (existing) paneIdByStore.delete(existing)
  paneStores.delete(key)
}

/** 测试/宿主重置:清空全部窗格实例(默认单例不受影响) */
export function resetChatPaneStores(): void {
  for (const store of paneStores.values()) paneIdByStore.delete(store)
  paneStores.clear()
}

/** 当前窗格实例数(测试断言用,不进生产判定) */
export function chatPaneStoreCount(): number {
  return paneStores.size
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
