// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

interface UseSidebarReturn {
  collapsed: boolean
  mobileOpen: boolean
  activeId: string | null
  toggleCollapse: () => void
  openMobile: () => void
  closeMobile: () => void
  setActive: (id: string) => void
}

/**
 * D53 会话注意力态(G-64,2026-09-23 立)。
 *
 * 四态(验收各一用例):idle(无态)/waiting(等待你处理)/unread(有未读更新)/waiting-unread(两者并存)。
 * 纯派生逻辑,不碰 stores/chat.ts 的 state shape(D60 在改它);计数走 props/组件 local state。
 */
export type ConversationAttentionState = 'idle' | 'waiting' | 'unread' | 'waiting-unread'

export interface ConversationAttentionInput {
  hasPendingQuestion: boolean
  unreadCount: number
}

/** 注意力态归一:等待优先于未读,两者并存为 waiting-unread(两徽章并排,不互相吞)。 */
export function resolveConversationAttention(
  input: ConversationAttentionInput,
): ConversationAttentionState {
  const waiting = input.hasPendingQuestion
  const unread = Number.isFinite(input.unreadCount) && input.unreadCount > 0
  if (waiting && unread) return 'waiting-unread'
  if (waiting) return 'waiting'
  if (unread) return 'unread'
  return 'idle'
}

/** 未读数徽章文案:99 封顶(99+),非正数归零。数字徽章本体只渲染本函数结果,不拼其他文案。 */
export function formatUnreadCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count > 99) return '99+'
  return String(Math.floor(count))
}

/**
 * pendingQuestion 挂起→等待你处理联动判定(D53 验收用例)。
 * 显式 waiting(attentionById/行数据)优先;否则挂起的提问归属当前会话时自动进入等待态。
 * pendingQuestion 为全局单例,只属于当前打开的会话,不属于其他行——必须按 conversationId 对齐。
 */
export function isWaitingForConversation(args: {
  conversationId: string
  currentConversationId: string | null
  hasPendingQuestion: boolean
  explicitWaiting?: boolean
}): boolean {
  if (args.explicitWaiting) return true
  return (
    args.hasPendingQuestion &&
    args.currentConversationId !== null &&
    args.conversationId === args.currentConversationId
  )
}

export interface BatchAttentionSummary {
  selectedCount: number
  waitingCount: number
  unreadCount: number
}

/** 多选条注意力汇总:在选中集上派生等待/未读计数,不碰 store,供批量条文案断言。 */
export function buildBatchAttentionSummary(args: {
  selectedIds: ReadonlySet<string> | readonly string[]
  isWaiting: (id: string) => boolean
  unreadOf: (id: string) => number
}): BatchAttentionSummary {
  const ids = Array.isArray(args.selectedIds) ? args.selectedIds : [...args.selectedIds]
  let waitingCount = 0
  let unreadCount = 0
  for (const id of ids) {
    if (args.isWaiting(id)) waitingCount += 1
    if (Number.isFinite(args.unreadOf(id)) && args.unreadOf(id) > 0) unreadCount += 1
  }
  return { selectedCount: ids.length, waitingCount, unreadCount }
}

/** 侧边栏状态管理 Hook，维护折叠/移动端抽屉/激活项 */
export function useSidebar(initialActive?: string): UseSidebarReturn {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [activeId, setActiveId] = React.useState<string | null>(initialActive ?? null)

  return {
    collapsed,
    mobileOpen,
    activeId,
    toggleCollapse: () => setCollapsed((c) => !c),
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
    setActive: setActiveId,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
