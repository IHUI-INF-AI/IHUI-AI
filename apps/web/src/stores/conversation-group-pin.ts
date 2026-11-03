// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165(承 V4 §9.4②):分组置顶(pin/unpin)客户端 store。
// - 与 D20 会话组织 store 同款纪律:localStorage 按 userId 分桶、经共享 persist-helpers SSR 安全;
// - 只存分组名(归一化后),分组本身仍以 orgMap 派生 —— 这里不是第二份分组真相,
//   orgMap 里删掉的分组,置顶记录随 orderFoldersWithPinned 自然失效(不会凭空长出分组);
// - 后端 schema 化持久化为后续票(与 conversation-org store 的 v1 说明同)。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { normalizeOrgName } from '@ihui/shared'

import { createPersistConfig } from './persist-helpers'

interface ConversationGroupPinState {
  /** userId → 已置顶分组名列表(归一化,保序 = 置顶先后) */
  byUser: Record<string, string[]>
  pinFolder: (userId: string, folder: string) => void
  unpinFolder: (userId: string, folder: string) => void
  togglePin: (userId: string, folder: string) => void
}

export const useConversationGroupPinStore = create<ConversationGroupPinState>()(
  persist(
    (set, get) => ({
      byUser: {},
      pinFolder: (userId, folder) =>
        set((s) => {
          const name = normalizeOrgName(folder)
          if (!name) return s
          const current = s.byUser[userId] ?? []
          if (current.includes(name)) return s
          return { byUser: { ...s.byUser, [userId]: [...current, name] } }
        }),
      unpinFolder: (userId, folder) =>
        set((s) => {
          const name = normalizeOrgName(folder)
          const current = s.byUser[userId] ?? []
          if (!current.includes(name)) return s
          const next = current.filter((f) => f !== name)
          if (next.length === 0) {
            // 空桶回收:与 org store 的"清空即不占记录"同一条卫生规则
            const { [userId]: _removed, ...rest } = s.byUser
            return { byUser: rest }
          }
          return { byUser: { ...s.byUser, [userId]: next } }
        }),
      togglePin: (userId, folder) => {
        const name = normalizeOrgName(folder)
        if (!name) return
        if ((get().byUser[userId] ?? []).includes(name)) get().unpinFolder(userId, name)
        else get().pinFolder(userId, name)
      },
    }),
    createPersistConfig<ConversationGroupPinState>('ihui-conversation-group-pin', (s) => ({
      byUser: s.byUser,
    })),
  ),
)

/** 稳定空数组:selector 必须返回同一引用,否则 useSyncExternalStore 快照永不稳定 → 无限重渲染 */
const EMPTY_PINNED: readonly string[] = Object.freeze([])

/** 当前用户已置顶分组(只读快照;未登录/未就绪时恒空数组) */
export function usePinnedFolders(userId: string | null | undefined): readonly string[] {
  return useConversationGroupPinStore((s) =>
    userId ? (s.byUser[userId] ?? EMPTY_PINNED) : EMPTY_PINNED,
  )
}
