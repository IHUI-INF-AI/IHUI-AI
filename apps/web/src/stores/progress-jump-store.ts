import { create } from 'zustand'

/**
 * Progress Jump Store — Plan Step ↔ Message 双向跳转联动状态(2026-07-28 立,Phase 19.1)
 *
 * 职责:跨组件跳转/高亮联动,解耦 PlanStepItem(右侧索引)和 MessageList(对话流)
 *
 * 设计要点:
 * - 跳转用 nonce 保证同 messageId 重复点击也能重新触发(useEffect 依赖)
 * - hoveredPlanStepId/hoveredMessageId 用于双向 hover 联动(右侧索引 hover → 消息侧高亮)
 * - highlightedMessageId 短时高亮(1.5s 后自动清除),用 timeoutRef 维护
 * - 反向 map(planStepToMessageId/messageToPlanStepIds)集中维护,避免在多处散乱同步
 *
 * 关联策略(Trae Work 对齐):
 * - use-chat.ts streamChat 开始时 setLastStreamMessage(assistantId)
 * - useAgentProgress 提取 plan_updated 事件时,关联到 chat store.lastStreamMessageId
 * - 反向:MessageList hover message 时,从 messageToPlanStepIds 找相关 planStep,setHoveredPlanStep
 */

interface ProgressJumpState {
  /** 计划跳转到的目标消息(messageId + nonce 触发副作用) */
  pendingJumpToMessage: { messageId: string; nonce: number } | null
  /** 当前 hover 的 plan step id(右侧索引 hover → 联动消息侧) */
  hoveredPlanStepId: string | null
  /** 当前 hover 的 message id(消息侧 hover → 联动右侧索引) */
  hoveredMessageId: string | null
  /** 正在短时高亮的消息 id(MessageList 渲染时读取,1.5s 后由 timer 清除) */
  highlightedMessageId: string | null
  /** 反向索引:planStepId → messageId(由 use-chat 或 useAgentProgress 写入) */
  planStepToMessageId: Record<string, string>
  /** 反向索引:messageId → planStepId[] */
  messageToPlanStepIds: Record<string, string[]>

  // actions
  /** 请求跳转到指定消息(nonce 自增,确保同 messageId 重复点击也能触发) */
  requestJumpToMessage: (messageId: string) => void
  /** 清除 pending 状态(MessageList 滚动完成后调用) */
  clearPendingJump: () => void
  setHoveredPlanStep: (id: string | null) => void
  setHoveredMessage: (id: string | null) => void
  /** 短时高亮 1.5s(由 timer 自动清除) */
  flashHighlight: (messageId: string) => void
  /** 建立 planStep ↔ message 双向关联(幂等) */
  linkPlanStepToMessage: (planStepId: string, messageId: string) => void
  /** 清除所有关联(切换 conversation 时调用,避免脏数据) */
  clearAllLinks: () => void
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null
let nonceCounter = 0

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
      // 仅当高亮未变更才清除(避免新 flash 干扰)
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
