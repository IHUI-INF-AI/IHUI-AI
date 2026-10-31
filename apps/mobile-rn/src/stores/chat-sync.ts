// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 #71(2026-10-31):RN 端 chat 多端/多标签实时同步的**绑定层 + 投影层**。
 *
 * 平台特有:依赖 React 的 useSyncExternalStore / useEffect(RN 运行时具备)与
 * zustand/vanilla 的既有依赖(mobile-rn 已在 dependencies 里,与小程序端同一档)。
 *
 * 分层与小程序端 `apps/miniapp-taro/src/stores/chat-sync.ts` 逐字同构:
 * 判据一行都不在这里 —— `(messageId, rev)` 幂等、duplicate/stale/gap 四态、待 resync
 * 全在 `@ihui/shared/chat` 的 `chat-sync-store`(它再引用 `@ihui/types` 的契约内核)。
 * 本文件只做两件事:
 *  ① 用本端状态库把共享 store 包成可订阅状态(发布信号 = 共享 store 的 版本号);
 *  ② 把共享消息面**投影**进聊天页的页级消息列表(纯函数,node 下可直接测)。
 *
 * 为什么是"投影"而不是换掉页级 state:ChatScreen 的消息面是页级 useState,流式增量、
 * 工具卡、附件、标记都挂在同一批对象上;换数据源 = 重写渲染语义(本票明确不做)。
 * 所以只做"补":
 *  - 本地已有这一行(按 id / 页面历史行的 flagTargetId / `serverId-序号` 约定匹配)
 *    ⇒ 就地覆盖 content/reasoning(其它字段原样保留);
 *  - 本地没有 ⇒ 追加到末尾(id = 服务端 messageId);
 *  - 追加内容与本端已有同角色消息逐字相同 ⇒ 判回声并跳过。广播会发给该账号**全部**连接
 *    (含刚写完这条的那台),本端自己的流式行又没有服务端 id —— 不判回声就会在流结束后
 *    多出重复一条。失效方向恒为"宁可少显示一次,不重复一条"。
 *
 * 终态帧本票不投影(与共享 store 的 unwired 档、web 端第三切片同批处理);帧仍被点名计数。
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
} from '@ihui/types'
import type { ChatMessage } from '@ihui/shared'
import {
  chatSyncStore,
  type ChatSyncStoreCounters,
  type ChatSyncStoreFrameOutcome,
} from '@ihui/shared/chat'

interface ChatSyncRnState {
  /** 共享 store 的变更序号:每次真实变更 +1(端内用它当"发布信号") */
  version: number
  /** 会话消息面(稳定引用;空会话返回同一个冻结空数组) */
  messagesOf: (conversationId: string) => readonly ChatSyncMessageSurface[]
  /** 供非 React 路径(广播适配器 / 诊断脚本)直接投帧 */
  applyEvent: (event: ChatSyncEvent) => ChatSyncStoreFrameOutcome
  /** resync 拉回后的并回(判据在契约,本层只转调) */
  mergeResyncSnapshot: (snapshot: ChatSyncMessageSnapshot) => ChatSyncResyncMergeOutcome
  /** 待 resync 请求(诊断 / 上层拉取用;不进 React 快照) */
  pendingResyncs: () => readonly ChatSyncResyncRequest[]
  /** 计数器(诊断读数;计数变化不发布,避免 duplicate/stale 触发重渲染) */
  counters: () => ChatSyncStoreCounters
  clear: () => void
}

export const chatSyncRnStore = createStore<ChatSyncRnState>()(() => ({
  version: 0,
  messagesOf: (conversationId) => chatSyncStore.messagesOf(conversationId),
  applyEvent: (event) => chatSyncStore.applyEvent(event),
  mergeResyncSnapshot: (snapshot) => chatSyncStore.mergeResyncSnapshot(snapshot),
  pendingResyncs: () => chatSyncStore.pendingResyncs(),
  counters: () => chatSyncStore.counters(),
  clear: () => chatSyncStore.clear(),
}))

// 共享 store 发布 ⇒ 只推进版本号;消息面本身经 messagesOf 懒取(引用稳定 ⇒ 未变更的会话不重渲染)
chatSyncStore.subscribe(() => {
  chatSyncRnStore.setState({ version: chatSyncStore.version() })
})

/** 非 React 路径(广播适配器 `lib/user-broadcast`)使用的直读 / 投帧入口。 */
export const chatSyncRnStoreApi = chatSyncRnStore

function subscribeChatSyncVersion(listener: () => void): () => void {
  return chatSyncRnStore.subscribe(listener)
}

function getChatSyncVersion(): number {
  return chatSyncRnStore.getState().version
}

/** 页面消息行的最小可匹配面(ChatScreen 的运行时形状;flagTargetId 未进 ChatMessage 类型)。 */
interface LocalChatRow {
  id: string
  role: string
  content: string
  reasoning?: string
  /** 历史回放行的服务端 id(ChatScreen 写在运行时对象上,类型层未声明) */
  flagTargetId?: unknown
}

export interface ChatSyncSurfaceUpdate {
  index: number
  content: string
  reasoning?: string
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

/**
 * 服务端消息在本地消息列表里的位置。
 *
 * 三种约定都要认,缺一种就会把"已显示的这条"当成新消息再追加一条:
 *  ① 本端追加行 / 流式行:id 就是服务端 messageId(或本地生成的 `msg-N`);
 *  ② 历史回放行:ChatScreen 把服务端 id 写在 flagTargetId,显示 id 是 `serverId-序号`;
 *  ③ 兜底:`serverId-序号` 前缀(分隔符必须在,否则短 id 会吞长 id)。
 */
function indexOfSurface(local: readonly LocalChatRow[], surfaceId: string): number {
  const exact = local.findIndex((row) => row.id === surfaceId)
  if (exact >= 0) return exact
  const flagged = local.findIndex((row) => serverIdOfRow(row) === surfaceId)
  if (flagged >= 0) return flagged
  return local.findIndex((row) => row.id.startsWith(`${surfaceId}-`))
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '')
}

/**
 * 计算"把共享消息面投影进本地列表"的最小变更集。返回 null = 零变化(调用方不得发布)。
 * 纯函数:不读全局、不写状态,node 用例直接喂数组即可。
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
      if (!contentChanged && !reasoningChanged) continue
      updated.add(index)
      updates.push({
        index,
        content: surface.content,
        ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
      })
      continue
    }
    // 回声:本端刚写完的那条没有服务端 id,但内容逐字相同 ⇒ 不是"另一端的新消息"
    const echo = local.some(
      (row) => row.role === surface.role && row.content.length > 0 && row.content === surface.content,
    )
    if (echo) continue
    appends.push(surface)
  }

  if (updates.length === 0 && appends.length === 0) return null
  return { updates, appends }
}

function toLocalMessage(surface: ChatSyncMessageSurface): ChatMessage {
  return {
    id: surface.id,
    role: surface.role as ChatMessage['role'],
    content: surface.content,
    ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
  }
}

/** 应用 plan。局部更新保留行上其它字段(工具卡 / 附件 / 标记全部原样)。 */
export function applyChatSyncSurfaceMerge(
  local: readonly ChatMessage[],
  plan: ChatSyncSurfaceMergePlan,
): ChatMessage[] {
  const next = local.slice()
  for (const update of plan.updates) {
    const row = next[update.index]
    if (!row) continue
    next[update.index] = {
      ...row,
      content: update.content,
      ...(update.reasoning !== undefined ? { reasoning: update.reasoning } : {}),
    }
  }
  for (const surface of plan.appends) next.push(toLocalMessage(surface))
  return next
}

export interface UseRemoteChatSyncMessagesOptions {
  /** 当前打开的会话;null = 尚未关联后端会话(不合并,别会话的帧不得串进来) */
  conversationId: string | null
  /** 页级消息 setter(与 ChatScreen 的 useState 同一枚) */
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  /** 本端正在流式生成 ⇒ 暂停合并(本端流式链路是这一格里的权威) */
  paused?: boolean
}

/**
 * 聊天页挂载点:把共享 store 的消息面并进页级 messages。
 *
 * 依赖只有 [版本号, paused, conversationId];setMessages 走 ref 读最新值 ——
 * 与 `use-user-broadcast-sync` 同一条纪律(RN 侧每次渲染都是新函数,进依赖会每帧重跑)。
 */
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
    const surfaces = chatSyncRnStoreApi.getState().messagesOf(conversationId)
    if (surfaces.length === 0) return
    optsRef.current.setMessages((prev) => {
      const plan = planChatSyncSurfaceMerge(prev, surfaces)
      return plan === null ? prev : applyChatSyncSurfaceMerge(prev, plan)
    })
  }, [version, paused, conversationId])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
