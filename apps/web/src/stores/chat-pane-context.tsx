// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 票60(2026-10-18,步序二):窗格寻址的 chat store 消费基座。
 *
 * React context 提供 paneId,`usePaneChatStore()` 据此把消费面接到该窗格的
 * 独立 store 实例(getChatStoreForPane);context 之外(既有单窗格场景)恒
 * 返回单例 useChatStore —— 消费面可以逐个安全切换,非窗格场景零行为变化。
 *
 * **挂载点**:根窗格保持单例(不挂 Provider);非根窗格由 ChatPaneBody 外包
 * ChatPaneProvider(paneId=叶 id)。发送链路与 useChat 均已按传入 store 实例化,
 * 读写落在同一实例上。
 */

import * as React from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { useChatStore, type ChatState } from '@/stores/chat'
import { getChatStoreForPane } from '@/stores/chat-panes'

export type ChatStore = UseBoundStore<StoreApi<ChatState>>

const ChatPaneIdContext = React.createContext<string | null>(null)

/**
 * 窗格会话域 Provider:paneId 即 multi-pane 布局树的树叶 id(pane-split.ts leaf.id,
 * 对齐层见 use-chat-pane-sync.ts)。空/空白 paneId 在挂载点就炸(与 getChatStoreForPane
 * 同一判据)—— 静默回落单例会把两窗格的状态悄悄并到一份,那正是本票要消灭的缺陷形态。
 */
export function ChatPaneProvider(props: {
  paneId: string
  children: React.ReactNode
}): React.ReactElement {
  if (!props.paneId.trim()) {
    throw new Error('ChatPaneProvider: paneId 不能为空(静默回落单例 = 两窗格共用一份状态)')
  }
  return (
    <ChatPaneIdContext.Provider value={props.paneId}>{props.children}</ChatPaneIdContext.Provider>
  )
}

/**
 * 窗格寻址的 chat store 解析 hook(消费面切换点)。
 * - Provider 内:返回该窗格的独立实例(懒建 + 复用,见 chat-panes.ts);
 * - 无 Provider:返回单例 useChatStore —— 恒同一引用,消费面既有行为零变化。
 * 返回值是 zustand bound store,`chatStore(selector)` / `chatStore.getState()` 照常用。
 */
export function usePaneChatStore(): ChatStore {
  const paneId = React.useContext(ChatPaneIdContext)
  return React.useMemo(
    () => (paneId === null ? useChatStore : getChatStoreForPane(paneId)),
    [paneId],
  )
}

/** 读当前窗格 id(Provider 外返回 null = 根窗格/单例) */
export function useOptionalPaneId(): string | null {
  const currentPaneId: string | null = React.useContext(ChatPaneIdContext)
  return currentPaneId
}

/**
 * 窗格事件门控:派发方把 paneId 放进 detail,监听方只处理属于自己窗格的事件。
 * 无 paneId 的历史事件按根窗格处理(向后兼容);根窗格监听方的 paneId 为 null。
 */
export function matchesPaneEvent(
  detailPaneId: string | null | undefined,
  currentPaneId: string | null,
): boolean {
  return (detailPaneId ?? null) === currentPaneId
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
