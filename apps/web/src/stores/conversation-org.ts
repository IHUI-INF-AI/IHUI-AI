// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 会话文件夹/标签(G-11)客户端元数据 store。
// - 标签:持久化到 localStorage(经共享 persist-helpers,SSR 安全)—— 服务端还没有标签实体,这一半仍是本地;
// - 文件夹:**自 D165(2026-10-01)起以服务端分组表为准**(见 conversation-org-server.ts),本地这份退化成
//   「乐观写入 + 首次上迁(backfill)的来源」,不再是文件夹的真相源;
// - 按 userId 分桶,防共享浏览器串号;
// - 纯逻辑(归一化/去重/空回收)全部复用 @ihui/shared conversation-org,本文件只管"存哪里"。

import { useEffect, useMemo } from 'react'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { withFolderMeta, withTagsMeta, type ConversationOrgMap } from '@ihui/shared'

import { createPersistConfig } from './persist-helpers'
import {
  EMPTY_MEMBERSHIP,
  folderNameById,
  useOrgServerStore,
  type OrgFailureReason,
} from '@ihui/shared/chat/conversation-org-server'

interface ConversationOrgState {
  /** userId → conversationId → 组织元数据 */
  byUser: Record<string, ConversationOrgMap>
  setFolder: (userId: string, conversationId: string, folder: string | null) => void
  setTags: (userId: string, conversationId: string, tags: readonly string[]) => void
}

export const useConversationOrgStore = create<ConversationOrgState>()(
  persist(
    (set, get) => ({
      byUser: {},
      setFolder: (userId, conversationId, folder) => {
        const base = get().byUser[userId] ?? {}
        const prev = base
        const next = withFolderMeta(base, conversationId, folder)
        if (next !== base) {
          set({ byUser: { ...get().byUser, [userId]: next } })
        }
        // 服务端已接管(ready)才写穿;未 ready 时保持"纯本地"语义不变 ——
        // 那既是首次登录前的既有行为,也是本文件既有用例不必 mock 网络的前提。
        const srv = useOrgServerStore.getState()
        if (!srv.ready || srv.userId !== userId) return
        void srv.assign(userId, conversationId, folder).then((r) => {
          if (r.ok) return
          // 失败必须回滚乐观值并留下原因:留着改过的本地值,屏幕显示"已在组里"而库里没有,
          // 下一次刷新又跳回去 —— 这是"改了个没发生的数"的界面版。
          set((s) => ({ byUser: { ...s.byUser, [userId]: prev } }))
          useOrgServerStore.setState({ lastError: r.reason })
        })
      },
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

/**
 * 首次接管时把"只住在 localStorage 里的文件夹"推上服务端(每人一次/每页面生命周期)。
 * 幂等性来自服务端出口本身:同名 create 走"复用已有分组",move 是同值重写,
 * 所以重复触发不产生新行 —— 这也是不把它做成持久化标记的理由(持久标记会让"中途失败"永远不再重试)。
 */
const BACKFILLED = new Set<string>()

async function backfillLocalFolders(userId: string): Promise<void> {
  if (BACKFILLED.has(userId)) return
  BACKFILLED.add(userId)
  const local = useConversationOrgStore.getState().byUser[userId] ?? {}
  const srv = useOrgServerStore.getState()
  for (const [conversationId, meta] of Object.entries(local)) {
    if (!meta.folder) continue
    const already = srv.membership[conversationId]
    if (already) continue // 服务端已有归属:以服务端为准,不用旧本地值覆盖
    const r = await srv.assign(userId, conversationId, meta.folder)
    if (!r.ok) {
      // 一次失败就把机会留给下一位调用方(不写回 BACKFILLED 之外的状态),
      // 但绝不静默:lastError 已在 assign 内置好,UI 会显示原因。
      return
    }
  }
}

/**
 * 当前用户的组织元数据只读 selector。
 * 文件夹位取自**服务端分组表**(ready 之后),标签位仍取本地;未 ready 时整体退回本地 map,
 * 于是"网络还没回来"与"没有分组"在界面上同形的问题由 ready 这一维在调用方另有出口(useOrgSyncState)。
 *
 * 返回值的引用稳定性不是优化而是**必须**:调用方(sidebar-chat-history)把它放进 useMemo 依赖,
 * 每次渲染新建一个对象 = 依赖恒变 = 派生列表每帧重算;该文件头那条"稳定空 map"的注释说的就是同一件事。
 */
export function useConversationOrgMap(userId: string | null | undefined): ConversationOrgMap {
  const localMap = useConversationOrgStore((s) => (userId ? s.byUser[userId] : undefined))
  const ready = useOrgServerStore((s) => s.ready && s.userId === userId)
  const membership = useOrgServerStore((s) => (s.ready ? s.membership : EMPTY_MEMBERSHIP))
  const folders = useOrgServerStore((s) => s.folders)
  const refresh = useOrgServerStore((s) => s.refresh)

  useEffect(() => {
    if (!userId) return
    const srv = useOrgServerStore.getState()
    if (!srv.loading && !(srv.ready && srv.userId === userId)) void refresh(userId)
  }, [userId, refresh])

  useEffect(() => {
    if (!userId || !ready) return
    void backfillLocalFolders(userId)
  }, [userId, ready])

  return useMemo<ConversationOrgMap>(() => {
    if (!userId) return EMPTY_ORG_MAP
    if (!ready) return localMap ?? EMPTY_ORG_MAP
    const out: ConversationOrgMap = {}
    const ids = new Set([...Object.keys(localMap ?? {}), ...Object.keys(membership)])
    for (const id of ids) {
      const meta = localMap?.[id]
      const groupId = membership[id] ?? null
      const folder = folderNameById(folders, groupId)
      const tags = meta?.tags ?? []
      // 空回收:无文件夹且无标签 ⇒ 不留死键(与 @ihui/shared 同一条规则,不在这里另立)
      if (folder === null && tags.length === 0) continue
      out[id] = { folder, tags }
    }
    return out
  }, [userId, ready, localMap, membership, folders])
}

/** 同步状态三态:让调用方能把"还没同步"与"同步后确实没有分组"区分开(两者在数据面上同形,只在状态面上不同形)。 */
export type OrgSyncState = 'local-only' | 'syncing' | 'synced' | 'failed'

export function useOrgSyncState(userId: string | null | undefined): {
  state: OrgSyncState
  reason: OrgFailureReason | null
} {
  const ready = useOrgServerStore((s) => s.ready && s.userId === userId)
  const loading = useOrgServerStore((s) => s.loading)
  const lastError = useOrgServerStore((s) => s.lastError)
  if (ready) return { state: 'synced', reason: null }
  if (loading) return { state: 'syncing', reason: null }
  if (lastError) return { state: 'failed', reason: lastError }
  return { state: 'local-only', reason: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
