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
 * G-20261114:此前**只有绑定层** —— 帧进了 store 的消息面却没有任何消费者,
 * 屏幕上一条都不出现。本轮补上投影层(纯函数 + 页级 hook),与
 * `apps/mobile-rn/src/stores/chat-sync.ts` 逐字同构(既有分层约定见 RN 头注),
 * 含终态状态位投影,判据仍全部来自共享 store / 契约内核,本层零复算。
 *
 * 选择器返回的数组由共享 store 缓存(状态不变 ⇒ 同一引用),所以未变更的会话不会重渲染;
 * **不要**在 selector 里现拼对象/数组(每次新引用 = 每次发布都重渲染)。
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { createStore } from 'zustand/vanilla'
import type {
  ChatSyncEvent,
  ChatSyncMessageSnapshot,
  ChatSyncMessageSurface,
  ChatSyncResyncMergeOutcome,
  ChatSyncResyncRequest,
  ChatSyncTerminalState,
} from '@ihui/types'
import type { ChatMessage } from '@/api'
import {
  chatSyncStore,
  type ChatSyncStoreCounters,
  type ChatSyncStoreFrameOutcome,
} from '@ihui/shared/chat'

interface ChatSyncMiniappState {
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

/** 非 React 路径(广播适配器)使用的直读入口。 */
export const chatSyncTaroStoreApi = chatSyncTaroStore

// ── 投影层(G-20261114):把共享 store 的消息面并进聊天页 ──────────────────
// 只用 React 原生 useSyncExternalStore + 既有 vanilla store 的 subscribe,
// 不引 zustand/react 的 create(见文件头注的 Taro 4.2.0 打包 bug)。
// 与 apps/mobile-rn/src/stores/chat-sync.ts 的投影层逐字同构:判据零复算,
// 差异只在 ChatMessage.id 在本端可选。

function subscribeChatSyncVersion(listener: () => void): () => void {
  return chatSyncTaroStore.subscribe(listener)
}

function getChatSyncVersion(): number {
  return chatSyncTaroStore.getState().version
}

/** 页面消息行的最小可匹配面(本端 ChatMessage.id 可选,故这里也放宽)。 */
interface LocalChatRow {
  id?: string
  role: string
  content: string
  reasoning?: string
  /** 历史回放行把服务端 id 写在运行时对象上(类型层未声明) */
  flagTargetId?: unknown
  /** 终态状态位(可能由上一次投影写入) */
  terminal?: ChatSyncTerminalState
}

type ProjectedChatMessage = ChatMessage & { terminal?: ChatSyncTerminalState }

export interface ChatSyncSurfaceUpdate {
  index: number
  content: string
  reasoning?: string
  terminal?: ChatSyncTerminalState
}

export interface ChatSyncSurfaceMergePlan {
  updates: readonly ChatSyncSurfaceUpdate[]
  appends: readonly ChatSyncMessageSurface[]
}

function serverIdOfRow(row: LocalChatRow): string | null {
  return typeof row.flagTargetId === 'string' && row.flagTargetId.length > 0
    ? row.flagTargetId
    : null
}

/** 三种 id 约定都要认,缺一种就会把"已显示的这条"当成新消息再追加一条。 */
function indexOfSurface(local: readonly LocalChatRow[], surfaceId: string): number {
  const exact = local.findIndex((row) => row.id === surfaceId)
  if (exact >= 0) return exact
  const flagged = local.findIndex((row) => serverIdOfRow(row) === surfaceId)
  if (flagged >= 0) return flagged
  return local.findIndex(
    (row) => typeof row.id === 'string' && row.id.startsWith(`${surfaceId}-`),
  )
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

function sameTerminal(
  a: ChatSyncTerminalState | undefined,
  b: ChatSyncTerminalState | undefined,
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.rev === b.rev && a.reason === b.reason
}

/**
 * 计算"把共享消息面投影进本地列表"的最小变更集。返回 null = 零变化(调用方不得发布)。
 * 纯函数,node 下可直接测;与 RN 端同名函数同构。
 */
export function planChatSyncSurfaceMerge(
  local: readonly LocalChatRow[],
  surfaces: readonly ChatSyncMessageSurface[],
): ChatSyncSurfaceMergePlan | null {
  const updates: ChatSyncSurfaceUpdate[] = []
  const appends: ChatSyncMessageSurface[] = []
  const updated = new Set<number>()

  for (const surface of surfaces) {
    const index = indexOfSurface(local, surface.id)
    if (index >= 0) {
      if (updated.has(index)) continue
      const row = local[index]!
      const contentChanged = row.content !== surface.content
      const reasoningChanged =
        surface.reasoning !== undefined && !sameText(row.reasoning, surface.reasoning)
      // 终态粘性(契约 §4):不带 terminal 的 snapshot 不得清掉既有终态。
      const terminalChanged =
        surface.terminal !== undefined && !sameTerminal(row.terminal, surface.terminal)
      if (!contentChanged && !reasoningChanged && !terminalChanged) continue
      updated.add(index)
      updates.push({
        index,
        content: surface.content,
        ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
        ...(surface.terminal !== undefined ? { terminal: surface.terminal } : {}),
      })
      continue
    }
    // 回声:本端刚写完的那条没有服务端 id,但内容逐字相同 ⇒ 不是"另一端的新消息"
    const echo = local.some(
      (row) =>
        row.role === surface.role && row.content.length > 0 && row.content === surface.content,
    )
    if (echo) continue
    appends.push(surface)
  }

  if (updates.length === 0 && appends.length === 0) return null
  return { updates, appends }
}

function toLocalMessage(surface: ChatSyncMessageSurface): ProjectedChatMessage {
  return {
    id: surface.id,
    role: surface.role as ChatMessage['role'],
    content: surface.content,
    ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
    ...(surface.terminal !== undefined ? { terminal: surface.terminal } : {}),
  }
}

/** 应用 plan。局部更新保留行上其它字段(工具卡 / 附件 / 标记全部原样)。 */
export function applyChatSyncSurfaceMerge(
  local: readonly ChatMessage[],
  plan: ChatSyncSurfaceMergePlan,
): ProjectedChatMessage[] {
  const next: ProjectedChatMessage[] = local.slice()
  for (const update of plan.updates) {
    const row = next[update.index]
    if (!row) continue
    next[update.index] = {
      ...row,
      content: update.content,
      ...(update.reasoning !== undefined ? { reasoning: update.reasoning } : {}),
      ...(update.terminal !== undefined ? { terminal: update.terminal } : {}),
    }
  }
  for (const surface of plan.appends) next.push(toLocalMessage(surface))
  return next
}

export interface UseRemoteChatSyncMessagesOptions {
  /** 当前打开的会话;空串/null = 尚未关联后端会话,不得把别会话的帧并进来 */
  conversationId: string | null
  /** 页级消息 setter(与聊天页的 useState 同一枚) */
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  /** 本端正在流式生成 ⇒ 暂停合并(本端流式链路是这一格里的权威) */
  paused?: boolean
}

/** 聊天页挂载点:把共享 store 的消息面并进页级 messages。 */
export function useRemoteChatSyncMessages(options: UseRemoteChatSyncMessagesOptions): void {
  const optsRef = useRef(options)
  optsRef.current = options
  const version = useSyncExternalStore(
    subscribeChatSyncVersion,
    getChatSyncVersion,
    getChatSyncVersion,
  )
  const paused = options.paused === true
  const { conversationId } = options

  useEffect(() => {
    if (!conversationId || paused) return
    const surfaces = chatSyncTaroStoreApi.getState().messagesOf(conversationId)
    if (surfaces.length === 0) return
    optsRef.current.setMessages((prev) => {
      const plan = planChatSyncSurfaceMerge(prev, surfaces)
      return plan === null ? prev : applyChatSyncSurfaceMerge(prev, plan)
    })
  }, [version, paused, conversationId])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
