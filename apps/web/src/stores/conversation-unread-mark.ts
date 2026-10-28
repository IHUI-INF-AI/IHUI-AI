// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D187 侧栏「标记为未读」客户端标记 store(v1,2026-09-30 立)。
// - 未读展示四态(D53)的 unreadCount 来自后端/attentionById,后端无"已读/未读"会话模型,
//   手动标记属客户端元数据(与 conversation-org v1 同层):localStorage 按 userId 分桶,
//   打开该会话(handleSelect)即视为已读并清除标记;后端 schema 化为后续票。
// - 纯 set 集合语义,不引入排序/派生逻辑。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

interface ConversationUnreadMarkState {
  /** userId → 已标记为未读的会话 id 集(值为 true 的对象即集合) */
  byUser: Record<string, Record<string, true>>
  markUnread: (userId: string, conversationId: string) => void
  clearMark: (userId: string, conversationId: string) => void
}

export const useConversationUnreadMarkStore = create<ConversationUnreadMarkState>()(
  persist(
    (set) => ({
      byUser: {},
      markUnread: (userId, conversationId) =>
        set((s) => {
          const base = s.byUser[userId] ?? {}
          if (base[conversationId]) return s
          return { byUser: { ...s.byUser, [userId]: { ...base, [conversationId]: true } } }
        }),
      clearMark: (userId, conversationId) =>
        set((s) => {
          const base = s.byUser[userId]
          if (!base?.[conversationId]) return s
          const next = { ...base }
          delete next[conversationId]
          return { byUser: { ...s.byUser, [userId]: next } }
        }),
    }),
    createPersistConfig<ConversationUnreadMarkState>('ihui-conversation-unread-marks', (s) => ({
      byUser: s.byUser,
    })),
  ),
)

/** 稳定空 map:selector 必须返回同一引用,否则 useSyncExternalStore 快照永不稳定 → 无限重渲染 */
const EMPTY_MARKS: Record<string, true> = {}

/** 当前用户的未读标记只读 selector(未登录/未就绪时恒空 map) */
export function useConversationUnreadMarks(userId: string | null | undefined) {
  return useConversationUnreadMarkStore((s) =>
    userId ? (s.byUser[userId] ?? EMPTY_MARKS) : EMPTY_MARKS,
  )
}
