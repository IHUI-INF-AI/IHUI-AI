import { create } from 'zustand'

/**
 * Agent 任务进度查看 Drawer 全局状态(2026-07-27 立,Codex 风格)
 *
 * 设计:仅管理 Drawer 的 UI 状态(开关 / 当前 threadId / 当前 tab),
 * 不缓存 SSE 事件流 — 事件聚合由 use-agent-progress.ts hook 负责,
 * 避免事件数据在 store 与 hook 间双向同步的复杂性。
 *
 * 触发:
 * - 浮动按钮(AgentProgressTrigger)
 * - Ctrl+Shift+J 快捷键
 * - openDrawer(threadId) 编程式调用
 */

export type AgentProgressTab = 'overview' | 'steps' | 'tools' | 'changes'

interface AgentProgressDrawerState {
  /** Drawer 是否展开 */
  open: boolean
  /** 当前查看的 threadId(null = 空状态,显示输入框) */
  threadId: string | null
  /** 当前激活的 tab */
  activeTab: AgentProgressTab
  /** 输入框中的 threadId 草稿(未提交) */
  threadIdInput: string

  // actions
  openDrawer: (threadId?: string) => void
  closeDrawer: () => void
  toggle: () => void
  setThreadId: (threadId: string | null) => void
  setActiveTab: (tab: AgentProgressTab) => void
  setThreadIdInput: (value: string) => void
  /** 提交输入框的 threadId,开始查看 */
  submitThreadId: () => void
  reset: () => void
}

export const useAgentProgressDrawerStore = create<AgentProgressDrawerState>((set, get) => ({
  open: false,
  threadId: null,
  activeTab: 'overview',
  threadIdInput: '',

  openDrawer: (threadId) =>
    set((s) => ({
      open: true,
      threadId: threadId ?? s.threadId,
      threadIdInput: threadId ?? s.threadIdInput,
    })),

  closeDrawer: () => set({ open: false }),

  toggle: () => set((s) => ({ open: !s.open })),

  setThreadId: (threadId) =>
    set({
      threadId,
      threadIdInput: threadId ?? '',
    }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setThreadIdInput: (value) => set({ threadIdInput: value }),

  submitThreadId: () => {
    const input = get().threadIdInput.trim()
    if (!input) return
    set({ threadId: input })
  },

  reset: () =>
    set({
      open: false,
      threadId: null,
      activeTab: 'overview',
      threadIdInput: '',
    }),
}))
