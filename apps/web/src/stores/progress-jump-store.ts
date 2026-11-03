// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { create, type StateCreator } from 'zustand'
import { useOptionalPaneId } from '@/stores/chat-pane-context'

/**
 * ProgressJumpStore — Plan Step ↔ Message 双向跳转联动状态(2026-07-28 立,AI 工作台 对齐)
 */

export interface ProgressJumpState {
  pendingJumpToMessage: { messageId: string; nonce: number } | null
  hoveredPlanStepId: string | null
  hoveredMessageId: string | null
  highlightedMessageId: string | null
  planStepToMessageId: Record<string, string>
  messageToPlanStepIds: Record<string, string[]>

  requestJumpToMessage: (messageId: string) => void
  clearPendingJump: () => void
  setHoveredPlanStep: (id: string | null) => void
  setHoveredMessage: (id: string | null) => void
  flashHighlight: (messageId: string) => void
  linkPlanStepToMessage: (planStepId: string, messageId: string) => void
  clearAllLinks: () => void
}

/**
 * 状态配方只有一份实现(§0.6):根单例与每个非根窗格的实例都由它构造。
 * 计数器与高亮定时器随实例走 —— 挪出模块级,两窗格才不会再互相撤销对方的那次跳转。
 */
function buildProgressJumpState(): StateCreator<ProgressJumpState> {
  let nonceCounter = 0
  let highlightTimer: ReturnType<typeof setTimeout> | null = null
  return (set, get) => ({
    pendingJumpToMessage: null,
    hoveredPlanStepId: null,
    hoveredMessageId: null,
    highlightedMessageId: null,
    planStepToMessageId: {},
    messageToPlanStepIds: {},

    requestJumpToMessage: (messageId) => {
      nonceCounter += 1
      set({ pendingJumpToMessage: { messageId, nonce: nonceCounter } })
    },

    clearPendingJump: () => set({ pendingJumpToMessage: null }),

    setHoveredPlanStep: (id) => set({ hoveredPlanStepId: id }),

    setHoveredMessage: (id) => set({ hoveredMessageId: id }),

    flashHighlight: (messageId) => {
      if (highlightTimer) {
        clearTimeout(highlightTimer)
        highlightTimer = null
      }
      set({ highlightedMessageId: messageId })
      highlightTimer = setTimeout(() => {
        if (get().highlightedMessageId === messageId) {
          set({ highlightedMessageId: null })
        }
        highlightTimer = null
      }, 1500)
    },

    linkPlanStepToMessage: (planStepId, messageId) => {
      const s = get()
      if (s.planStepToMessageId[planStepId] === messageId) return
      set({
        planStepToMessageId: { ...s.planStepToMessageId, [planStepId]: messageId },
        messageToPlanStepIds: {
          ...s.messageToPlanStepIds,
          [messageId]: Array.from(
            new Set([...(s.messageToPlanStepIds[messageId] ?? []), planStepId]),
          ),
        },
      })
    },

    clearAllLinks: () => {
      set({
        planStepToMessageId: {},
        messageToPlanStepIds: {},
        hoveredPlanStepId: null,
        hoveredMessageId: null,
        highlightedMessageId: null,
      })
    },
  })
}

/** 根窗格那一份(= 历史形态;Provider 外的消费面读的仍是这一例,单窗格调用面零变化) */
export const useProgressJumpStore = create<ProgressJumpState>(buildProgressJumpState())

type ProgressJumpBoundStore = typeof useProgressJumpStore

const paneStores = new Map<string, ProgressJumpBoundStore>()

/** 非根窗格各一份(懒建 + 复用)。空 paneId 抛错:静默回落单例 = 两窗格共用一份跳转态 */
export function getProgressJumpStoreForPane(paneId: string): ProgressJumpBoundStore {
  if (!paneId.trim()) {
    throw new Error(
      'getProgressJumpStoreForPane: paneId 不能为空(静默回落单例 = 两窗格共用一份跳转态)',
    )
  }
  const existing = paneStores.get(paneId)
  if (existing) return existing
  const created = create<ProgressJumpState>(buildProgressJumpState())
  paneStores.set(paneId, created)
  return created
}

/**
 * 窗格寻址的跳转 store 解析 hook(票60 残余,照 usePaneChatStore 同一形态):
 * - Provider 内 ⇒ 该窗格实例:跳转请求、高亮、PlanStep↔Message 联动映射都只在本窗格生效,
 *   别窗格消费后 `clearPendingJump` 不再抢走这一次跳转;
 * - Provider 外 ⇒ 恒返回根单例(同一引用)。
 */
export function useProgressJumpStoreForPane(): ProgressJumpBoundStore {
  const currentPaneId = useOptionalPaneId()
  return React.useMemo(
    () =>
      currentPaneId === null ? useProgressJumpStore : getProgressJumpStoreForPane(currentPaneId),
    [currentPaneId],
  )
}

/** 测试/窗格回收通道:清掉全部非根窗格实例(根单例不动) */
export function resetProgressJumpPaneStores(): void {
  paneStores.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
