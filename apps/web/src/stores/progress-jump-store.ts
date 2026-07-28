'use client'

import { create } from 'zustand'

/**
 * ProgressJumpStore — Plan Step ↔ Message 双向跳转联动状态(2026-07-28 立,Trae Work 对齐)
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
