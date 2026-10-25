// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 最后一格(2026-10-26):小程序端 chat 同步 store 的**绑定层**(只做 Taro 侧适配)。
 *
 * 平台特有:依赖 Taro 4.2.0 + zustand/vanilla 的既有变通(见 `stores/user.ts` 头注)——
 * `import { create } from 'zustand'` 会被 Taro Vite runner 错误归并成
 * `taro.react_production_min.create`,故统一用 `createStore` + `createTaroZustandHook`。
 *
 * 判据一行都不在这里:`message:*` 的幂等 / 四态裁定 / 待 resync 全在
 * `@ihui/shared/chat` 的 `chat-sync-store`(它再引用 `@ihui/types` 的契约内核)。
 * 本文件只负责"把它包成本端 React 能订阅的 hook",与 user.ts / vip.ts 同一条模式。
 *
 * 页面用法(接线时):
 * ```ts
 * const synced = useChatSyncMessages(conversationId)
 * ```
 * 选择器返回的数组由共享 store 缓存(状态不变 ⇒ 同一引用),所以未变更的会话不会重渲染;
 * **不要**在 selector 里现拼对象/数组(每次新引用 = 每次发布都重渲染)。
 */

import { createStore } from 'zustand/vanilla'
import type {
  ChatSyncEvent,
  ChatSyncMessageSnapshot,
  ChatSyncMessageSurface,
  ChatSyncResyncMergeOutcome,
  ChatSyncResyncRequest,
} from '@ihui/types'
import {
  chatSyncStore,
  type ChatSyncStoreCounters,
  type ChatSyncStoreFrameOutcome,
} from '@ihui/shared/chat'

import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'

export interface ChatSyncMiniappState {
  /** 共享 store 的变更序号:每次真实变更 +1(端内用它当"发布信号") */
  version: number
  /** 会话消息面(稳定引用;空会话返回同一个冻结空数组) */
  messagesOf: (conversationId: string) => readonly ChatSyncMessageSurface[]
  /** 供非 React 路径(广播适配器/诊断脚本)直接投帧 */
  applyEvent: (event: ChatSyncEvent) => ChatSyncStoreFrameOutcome
  /** resync 拉回后的并回(判据在契约,本层只转调) */
  mergeResyncSnapshot: (snapshot: ChatSyncMessageSnapshot) => ChatSyncResyncMergeOutcome
  /** 待 resync 请求(诊断/上层拉取用;不进 React 快照) */
  pendingResyncs: () => readonly ChatSyncResyncRequest[]
  /** 计数器(诊断读数;计数变化不发布,避免 duplicate/stale 触发重渲染) */
  counters: () => ChatSyncStoreCounters
  clear: () => void
}

const chatSyncTaroStore = createStore<ChatSyncMiniappState>()(() => ({
  version: 0,
  messagesOf: (conversationId) => chatSyncStore.messagesOf(conversationId),
  applyEvent: (event) => chatSyncStore.applyEvent(event),
  mergeResyncSnapshot: (snapshot) => chatSyncStore.mergeResyncSnapshot(snapshot),
  pendingResyncs: () => chatSyncStore.pendingResyncs(),
  counters: () => chatSyncStore.counters(),
  clear: () => chatSyncStore.clear(),
}))

// 共享 store 发布 ⇒ 只推进版本号;消息面本身经 messagesOf 懒取(引用稳定,未变更的会话不重渲染)
chatSyncStore.subscribe(() => {
  chatSyncTaroStore.setState({ version: chatSyncStore.version() })
})

/** 端内 store(既能当 hook 调,也保留 getState/subscribe,与 zustand `create` 同形)。 */
export const useChatSyncStore = createTaroZustandHook(chatSyncTaroStore)

/** 非 React 路径(广播适配器)使用的直读入口。 */
export const chatSyncTaroStoreApi = chatSyncTaroStore

/**
 * 会话消息面的便捷 hook(接线页一行取数)。返回引用稳定 ⇒ 别的会话变更不引起本页重渲染。
 */
export function useChatSyncMessages(conversationId: string): readonly ChatSyncMessageSurface[] {
  return useChatSyncStore((s) => s.messagesOf(conversationId))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
