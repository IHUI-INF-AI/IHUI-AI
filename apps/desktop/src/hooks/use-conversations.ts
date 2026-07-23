import { useCallback, useEffect, useState } from 'react'
import {
  deleteConversation,
  isTauri,
  listConversations,
  loadConversation,
  saveConversation,
  setActiveConversation,
  type Conversation,
  type ConversationSummary,
  type StoredMessage,
} from '../lib/desktop'

export interface UseConversationsResult {
  /** 是否已完成首次加载(非 Tauri 环境也返回 true)。 */
  ready: boolean
  /** 是否启用持久化(仅 Tauri 环境)。 */
  enabled: boolean
  /** 会话列表(按 updatedAt 倒序)。 */
  list: ConversationSummary[]
  /** 当前活跃会话 ID(null = 新会话,未持久化)。 */
  activeId: string | null
  /** 重新拉取会话列表 + 活跃 ID。 */
  refresh: () => Promise<void>
  /** 新建会话(清除 activeId,服务端同步清除)。 */
  startNew: () => Promise<void>
  /** 切换到指定会话,返回完整会话(含消息)。 */
  select: (id: string) => Promise<Conversation | null>
  /** 删除会话;若删除的是当前活跃会话,activeId 清空。 */
  remove: (id: string) => Promise<void>
  /** 持久化当前会话(id 已存在则覆盖,否则新增)。自动设为活跃。 */
  persist: (id: string, title: string, messages: StoredMessage[]) => Promise<void>
}

/**
 * 桌面端会话历史 hook(仅 Tauri 环境启用,浏览器返回 noop)。
 * 启动时自动加载列表 + 活跃会话;切换/删除/保存通过 Rust 端 tauri-plugin-store 落地。
 */
export function useConversations(): UseConversationsResult {
  const enabled = isTauri()
  const [ready, setReady] = useState(false)
  const [list, setList] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setReady(true)
      return
    }
    try {
      const r = await listConversations()
      setList(r.conversations)
      setActiveId(r.activeId)
    } catch {
      // 静默失败:首次启动 store 不存在属正常,下次保存后建立
    } finally {
      setReady(true)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startNew = useCallback(async () => {
    if (!enabled) return
    await setActiveConversation(null)
    setActiveId(null)
  }, [enabled])

  const select = useCallback(
    async (id: string): Promise<Conversation | null> => {
      if (!enabled) return null
      const r = await loadConversation(id)
      await setActiveConversation(id)
      setActiveId(id)
      return r.conversation
    },
    [enabled],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!enabled) return
      await deleteConversation(id)
      setList((cur) => cur.filter((c) => c.id !== id))
      setActiveId((cur) => {
        if (cur === id) return null
        return cur
      })
    },
    [enabled],
  )

  const persist = useCallback(
    async (id: string, title: string, messages: StoredMessage[]) => {
      if (!enabled) return
      await saveConversation(id, title, messages)
      setActiveId(id)
      // 刷新列表(可能因 50 条上限截断旧会话)
      try {
        const r = await listConversations()
        setList(r.conversations)
      } catch {
        // 静默
      }
    },
    [enabled],
  )

  return { ready, enabled, list, activeId, refresh, startNew, select, remove, persist }
}
