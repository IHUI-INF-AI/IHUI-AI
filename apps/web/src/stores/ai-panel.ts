import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** AI 侧边 docked 面板默认宽度(对齐旧架构 _sidebar-layout.scss --ai-panel-default-width) */
export const AI_PANEL_DEFAULT_WIDTH = 400
export const AI_PANEL_MIN_WIDTH = 320
export const AI_PANEL_MAX_WIDTH = 720

interface AiPanelState {
  /** 面板是否展开(全局唯一,任何路由可触发) */
  open: boolean
  /** 用户拖拽后的宽度(持久化) */
  width: number
  /** 拖拽中标记(禁用过渡动画) */
  isResizing: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
}

/**
 * 全局 AI docked 面板状态。
 * - open 不持久化:每次刷新默认展开(2026-07-19 改,符合"AI 对话框默认弹出"的全局设定)
 *   merge 函数强制覆盖 rehydrate 后的 open=true,防止旧版本 localStorage 残留的 open=false 干扰
 * - width 持久化:保留用户拖拽偏好
 */
export const useAiPanelStore = create<AiPanelState>()(
  persist(
    (set) => ({
      // open=true:AI 对话框默认弹出展开(用户规则 2026-07-20 确认)
      open: true,
      width: AI_PANEL_DEFAULT_WIDTH,
      isResizing: false,

      openPanel: () => set({ open: true }),
      closePanel: () => set({ open: false }),
      togglePanel: () => set((s) => ({ open: !s.open })),
      setWidth: (w) =>
        set({
          width: Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, w)),
        }),
      setResizing: (v) => set({ isResizing: v }),
    }),
    {
      ...createPersistConfig<AiPanelState>('ihui-ai-panel', (s) => ({
        width: s.width,
      })),
      // 强制 open=true:rehydrate 时即使 localStorage 残留旧版本 open=false 也覆盖为 true。
      // 保证"AI 对话框默认弹出"规则在所有刷新场景下生效。
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...((persistedState as Partial<AiPanelState>) || {}),
        open: true,
      }),
    },
  ),
)
