'use client'

import { create } from 'zustand'

/**
 * ProgressJumpStore — Plan Step ↔ Message 双向跳转联动状态(2026-07-28 立,Trae Work 对齐)
 *
 * 设计目标:
 * - 右侧 PlanStepItem 点击 → 滚动到对应 AI 消息 + 1.5s 高亮闪烁
 * - 消息 hover → 右侧对应 PlanStepItem 联动高亮
 * - PlanStep 与 Message 通过 relatedMessageId 字段关联(use-agent-progress 自动建立)
 *
 * 状态设计:
 * - pendingJumpToMessage:{ messageId, nonce } 用 nonce 强制 effect 重跑(同一 messageId 重复点击)
 * - highlightedMessageId:持续 1.5s 后自动清除
 * - linkPlanStepToMessage:幂等,重复调用不更新
 *
 * 关联:
 * - use-agent-progress.ts:PlanStep.relatedMessageId 字段填充
 * - chat.ts:lastStreamMessageId 字段 + setLastStreamMessage action
 * - message-list.tsx:监听 pendingJumpToMessage + message hover 触发 setHoveredMessage
 * - agent-task-progress-pane.tsx:PlanStepItem 点击 + hover 联动
 */

export interface ProgressJumpState {
  pendingJumpToMessage: { messageId: string; nonce: number } | null
  hoveredPlanStepId: string | null
  hoveredMessageId: string | null
  highlightedMessageId: string | null
  planStepToMessageId: Record<string, string>
  messageToPlanStepIds: Record<string, string[]>

  /** 触发跳转到指定 message(用 nonce 保证 effect 能重跑) */
  requestJumpToMessage: (messageId: string) => void
  /** 清除 pendingJump(滚动完成后) */
  clearPendingJump: () => void
  /** hover plan step 联动(从 agent-task-progress-pane 调用) */
  setHoveredPlanStep: (id: string | null) => void
  /** hover message 联动(从 message-list 调用) */
  setHoveredMessage: (id: string | null) => void
  /** 高亮 message 1.5s(MessageList 内部用) */
  flashHighlight: (messageId: string) => void
  /** 关联 planStepId → messageId(use-agent-progress 内部用) */
  linkPlanStepToMessage: (planStepId: string, messageId: string) => void
  /** 清空所有关联(切会话时调用) */
  clearAllLinks: () => void
}

let nonceCounter = 0
let highlightTimer: ReturnType<typeof setTimeout> | null = null

export const useProgressJumpStore = create<ProgressJumpState>((set, get) => ({
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
}))
