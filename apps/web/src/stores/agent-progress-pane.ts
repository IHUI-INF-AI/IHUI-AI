import { create } from 'zustand'

/**
 * Agent 任务进度查看 Bottom Pane 全局状态(2026-07-27 重构,Codex 对齐)
 *
 * Codex CLI TUI 架构对齐:
 * - 持久化底部面板(Bottom Pane),非右侧 Drawer
 * - 三栏分离:Tasks / Subagents / Terminals(非 4 tab)
 * - 原地更新(同位置重绘,非事件流追加)
 * - 快捷键:Down 打开,Tab 切换排序,a 切换 active/archived,v 切换 verbose
 *
 * 设计:仅管理 Pane 的 UI 状态(开关 / threadId / 当前栏 / verbose / 排序 / 折叠集合),
 * 不缓存 SSE 事件流 — 事件聚合由 use-agent-progress.ts hook 负责。
 */

export type AgentProgressColumn = 'tasks' | 'subagents' | 'terminals'

export type AgentProgressSortMode = 'recent' | 'duration' | 'status'

interface AgentProgressPaneState {
  /** Pane 是否展开 */
  open: boolean
  /** 当前查看的 threadId(null = 空状态,显示输入框) */
  threadId: string | null
  /** 当前激活的栏(Tasks/Subagents/Terminals 三栏) */
  activeColumn: AgentProgressColumn
  /** 输入框中的 threadId 草稿(未提交) */
  threadIdInput: string
  /** verbose 模式(显示原始 ID,默认 false 显示人类可读昵称) */
  verbose: boolean
  /** 是否显示已归档(完成/失败)的子代理与终端(默认 true,Codex 行为) */
  showArchived: boolean
  /** 排序模式(Tab 键循环切换) */
  sortMode: AgentProgressSortMode
  /** 展开的条目 ID 集合(默认折叠,点击展开) */
  expandedIds: Set<string>

  // actions
  openPane: (threadId?: string) => void
  closePane: () => void
  toggle: () => void
  setThreadId: (threadId: string | null) => void
  setActiveColumn: (column: AgentProgressColumn) => void
  setThreadIdInput: (value: string) => void
  submitThreadId: () => void
  toggleVerbose: () => void
  toggleShowArchived: () => void
  cycleSortMode: () => void
  toggleExpanded: (id: string) => void
  isExpanded: (id: string) => boolean
  reset: () => void
}

const SORT_CYCLE: AgentProgressSortMode[] = ['recent', 'duration', 'status']

export const useAgentProgressPaneStore = create<AgentProgressPaneState>((set, get) => ({
  open: false,
  threadId: null,
  activeColumn: 'tasks',
  threadIdInput: '',
  verbose: false,
  showArchived: true,
  sortMode: 'recent',
  expandedIds: new Set<string>(),

  openPane: (threadId) =>
    set((s) => ({
      open: true,
      threadId: threadId ?? s.threadId,
      threadIdInput: threadId ?? s.threadIdInput,
    })),

  closePane: () => set({ open: false }),

  toggle: () => set((s) => ({ open: !s.open })),

  setThreadId: (threadId) =>
    set({
      threadId,
      threadIdInput: threadId ?? '',
    }),

  setActiveColumn: (activeColumn) => set({ activeColumn }),

  setThreadIdInput: (value) => set({ threadIdInput: value }),

  submitThreadId: () => {
    const input = get().threadIdInput.trim()
    if (!input) return
    set({ threadId: input })
  },

  toggleVerbose: () => set((s) => ({ verbose: !s.verbose })),

  toggleShowArchived: () => set((s) => ({ showArchived: !s.showArchived })),

  cycleSortMode: () =>
    set((s) => {
      const idx = SORT_CYCLE.indexOf(s.sortMode)
      const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]
      return { sortMode: next }
    }),

  toggleExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { expandedIds: next }
    }),

  isExpanded: (id) => get().expandedIds.has(id),

  reset: () =>
    set({
      open: false,
      threadId: null,
      activeColumn: 'tasks',
      threadIdInput: '',
      verbose: false,
      showArchived: true,
      sortMode: 'recent',
      expandedIds: new Set<string>(),
    }),
}))
