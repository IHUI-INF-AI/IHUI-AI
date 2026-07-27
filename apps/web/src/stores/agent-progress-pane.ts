import { create } from 'zustand'

/**
 * Agent 任务进度查看 Bottom Pane 全局状态(2026-07-27 重构,Codex 对齐)
 *
 * Codex CLI TUI 架构对齐:
 * - 持久化底部面板(Bottom Pane),非右侧 Drawer
 * - 三栏分离:Tasks / Subagents / Terminals(非 4 tab)
 * - 原地更新(同位置重绘,非事件流追加)
 * - 快捷键(Codex 标准):
 *   - Down 打开 / Esc 关闭
 *   - j/k 上下移动 cursor
 *   - 1/2/3 切换 Tasks/Subagents/Terminals 栏
 *   - Tab 切换排序 / a 切换归档 / v 切换 verbose
 *   - Enter 展开/折叠当前项 / y/n 审批
 *   - Ctrl+Shift+J 保留(Web 习惯)
 *
 * 设计:仅管理 Pane 的 UI 状态(开关 / threadId / 当前栏 / cursor / verbose / 排序 / 折叠集合),
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
  /** 当前 cursor 索引(j/k 移动,Enter 激活) */
  cursorIndex: number

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
  /** cursor 移动(Codex j/k),clamp 到 [0, max-1] */
  moveCursor: (delta: number, max: number) => void
  /** 直接设置 cursor(切栏时重置为 0) */
  setCursor: (index: number) => void
  /** Enter 键:展开/折叠当前 cursor 指向的条目 */
  toggleExpandedAt: (idAt: (index: number) => string | null) => void
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
  cursorIndex: 0,

  openPane: (threadId) =>
    set((s) => ({
      open: true,
      threadId: threadId ?? s.threadId,
      threadIdInput: threadId ?? s.threadIdInput,
      cursorIndex: 0,
    })),

  closePane: () => set({ open: false }),

  toggle: () => set((s) => ({ open: !s.open })),

  setThreadId: (threadId) =>
    set({
      threadId,
      threadIdInput: threadId ?? '',
      cursorIndex: 0,
    }),

  setActiveColumn: (activeColumn) => set({ activeColumn, cursorIndex: 0 }),

  setThreadIdInput: (value) => set({ threadIdInput: value }),

  submitThreadId: () => {
    const input = get().threadIdInput.trim()
    if (!input) return
    set({ threadId: input, cursorIndex: 0 })
  },

  toggleVerbose: () => set((s) => ({ verbose: !s.verbose })),

  toggleShowArchived: () => set((s) => ({ showArchived: !s.showArchived })),

  cycleSortMode: () =>
    set((s) => {
      const idx = SORT_CYCLE.indexOf(s.sortMode)
      const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]
      return { sortMode: next, cursorIndex: 0 }
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

  moveCursor: (delta, max) =>
    set((s) => {
      if (max <= 0) return { cursorIndex: 0 }
      const next = Math.max(0, Math.min(max - 1, s.cursorIndex + delta))
      return { cursorIndex: next }
    }),

  setCursor: (index) => set({ cursorIndex: Math.max(0, index) }),

  toggleExpandedAt: (idAt) => {
    const id = idAt(get().cursorIndex)
    if (id) get().toggleExpanded(id)
  },

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
      cursorIndex: 0,
    }),
}))
