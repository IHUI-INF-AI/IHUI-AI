import { create } from 'zustand'

/** 终端停靠面板默认高度(px) */
export const TERMINAL_DOCK_DEFAULT_HEIGHT = 240
/** 终端停靠面板高度钳制 */
export const TERMINAL_DOCK_MIN_HEIGHT = 160
export const TERMINAL_DOCK_MAX_HEIGHT = 480

/**
 * 终端停靠面板 store — 控制 AI 面板底部 PowerShell 终端的展开/收起 + 高度。
 *
 * 设计:
 * - session-only(不持久化):每次进入页面默认收起,用户点开终端按钮才展开。
 * - height 独立于 open 记忆:收起再展开保留上次拖拽高度。
 * - setHeight 在 store 内做 160-480 钳制(拖拽事件高频调用,避免在组件内重复钳制)。
 */
interface TerminalDockState {
  /** 是否展开 */
  open: boolean
  /** 面板高度(px,默认 240) */
  height: number
  /** 拖拽调高中 */
  isResizing: boolean
  toggle: () => void
  setOpen: (v: boolean) => void
  setHeight: (h: number) => void
  setResizing: (v: boolean) => void
}

export const useTerminalDockStore = create<TerminalDockState>()((set) => ({
  open: false,
  height: TERMINAL_DOCK_DEFAULT_HEIGHT,
  isResizing: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: v }),
  setHeight: (h) =>
    set({ height: Math.min(TERMINAL_DOCK_MAX_HEIGHT, Math.max(TERMINAL_DOCK_MIN_HEIGHT, h)) }),
  setResizing: (v) => set({ isResizing: v }),
}))
