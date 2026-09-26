// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:PLACEHOLDER

// D20 会话文件夹/标签(G-11)客户端元数据 store(v1)。
// - 持久化到 localStorage(经共享 persist-helpers,SSR 安全);
// - 按 userId 分桶,防共享浏览器串号;
// - 纯逻辑(归一化/去重/空回收)全部复用 @ihui/shared conversation-org,本文件只管"存哪里"。
// 后端 schema 化持久化(chats conversations.folder/tags 列 + api-client 端点)为后续票。

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  withFolderMeta,
  withTagsMeta,
  type ConversationOrgMap,
} from '@ihui/shared'

import { createPersistConfig } from './persist-helpers'

interface ConversationOrgState {
  /** userId → conversationId → 组织元数据 */
  byUser: Record<string, ConversationOrgMap>
  setFolder: (userId: string, conversationId: string, folder: string | null) => void
  setTags: (userId: string, conversationId: string, tags: readonly string[]) => void
}

export const useConversationOrgStore = create<ConversationOrgState>()(
  persist(
    (set) => ({
      byUser: {},
      setFolder: (userId, conversationId, folder) =>
        set((s) => {
          const base = s.byUser[userId] ?? {}
          const next = withFolderMeta(base, conversationId, folder)
          if (next === base) return s
          return { byUser: { ...s.byUser, [userId]: next } }
        }),
      setTags: (userId, conversationId, tags) =>
        set((s) => {
          const base = s.byUser[userId] ?? {}
          const next = withTagsMeta(base, conversationId, tags)
          if (next === base) return s
          return { byUser: { ...s.byUser, [userId]: next } }
        }),
    }),
    createPersistConfig<ConversationOrgState>('ihui-conversation-org', (s) => ({
      byUser: s.byUser,
    })),
  ),
)

/** 稳定空 map:selector 必须返回同一引用,否则 useSyncExternalStore 快照永不稳定 → 无限重渲染(全路由崩溃) */
const EMPTY_ORG_MAP: ConversationOrgMap = {}

/** 当前用户的组织元数据只读 selector(未登录/未就绪时恒空 map) */
export function useConversationOrgMap(userId: string | null | undefined): ConversationOrgMap {
  return useConversationOrgStore((s) => (userId ? (s.byUser[userId] ?? EMPTY_ORG_MAP) : EMPTY_ORG_MAP))
}
// [IHUI-AI-PROVENANCE]:PLACEHOLDER
