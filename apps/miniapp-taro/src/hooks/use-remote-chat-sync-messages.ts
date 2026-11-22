// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-20261114:把 chat 同步 store 的内核面投影到聊天页的消息行。
 *
 * 页面不直接读 store(那会让每一帧都整页重渲染),而是:
 *   store.version 变 → 取当前会话内核面 → `planChatSyncSurfaceMerge` 判差异 →
 *   有变化才 `setMessages`,且只替换真正变了的行(未变更行保持原对象引用)。
 *
 * `paused` 是本端流式中必须置 true:本端 SSE 正在逐 token 写同一行,此时 WS snapshot
 * 覆盖过来会吞掉本端已有的前缀(web 端同一纪律)。暂停期间版本号仍会推进,
 * 解除暂停后 effect 以最新版本重跑一次,不会漏帧。
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { ChatSyncMessageSurface } from '@ihui/types'

import type { ChatMessage } from '@/api'
import {
  applyChatSyncSurfaceMerge,
  planChatSyncSurfaceMerge,
  type ChatSyncSurfaceRow,
} from '@/lib/chat-sync-surface'
import { chatSyncTaroStoreApi } from '@/stores/chat-sync'

export interface UseRemoteChatSyncMessagesOptions {
  /** 当前会话 id(与广播帧 room.conversationId 同域) */
  conversationId: string
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  /** 本端流式中暂停投影(见文件头注) */
  paused?: boolean
}

const readVersion = (): number => chatSyncTaroStoreApi.getState().version

function toSurfaceRows(messages: readonly ChatMessage[]): ChatSyncSurfaceRow[] {
  return messages.map((message, index) => ({
    // 端内流式行在拿到落库 id 前没有 id:给一个仅本进程内稳定的占位,
    // 真正的回声去重靠 planChatSyncSurfaceMerge 的 role+content 判据。
    id: message.id ?? `local:${index}`,
    role: message.role,
    content: message.content,
    ...(message.reasoning === undefined ? {} : { reasoning: message.reasoning }),
  }))
}

function projectMessages(
  prev: readonly ChatMessage[],
  remote: readonly ChatSyncMessageSurface[],
): ChatMessage[] {
  const rows = toSurfaceRows(prev)
  const plan = planChatSyncSurfaceMerge(rows, remote)
  if (!plan) return prev as ChatMessage[]

  const next = applyChatSyncSurfaceMerge(rows, plan)
  const projected = prev.map((message, index) => {
    const before = rows[index]
    const after = next[index]
    if (!before || !after) return message
    if (before.content === after.content && before.reasoning === after.reasoning) return message
    return {
      ...message,
      content: after.content,
      ...(after.reasoning === undefined ? {} : { reasoning: after.reasoning }),
    }
  })

  for (const row of next.slice(rows.length)) {
    // 端内只渲染 user / assistant;system 面不落到气泡。
    if (row.role === 'system') continue
    projected.push({
      id: row.id,
      role: row.role,
      content: row.content,
      ...(row.reasoning === undefined ? {} : { reasoning: row.reasoning }),
      timestamp: Date.now(),
    })
  }

  return projected
}

export function useRemoteChatSyncMessages({
  conversationId,
  setMessages,
  paused = false,
}: UseRemoteChatSyncMessagesOptions): void {
  const version = useSyncExternalStore(chatSyncTaroStoreApi.subscribe, readVersion, readVersion)

  useEffect(() => {
    if (paused || !conversationId) return
    const remote = chatSyncTaroStoreApi.getState().messagesOf(conversationId)
    if (remote.length === 0) return
    setMessages((prev) => projectMessages(prev, remote))
  }, [conversationId, paused, setMessages, version])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
