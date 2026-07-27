import { create } from 'zustand'

/**
 * Agent 任务进度查看 Bottom Pane 全局状态(2026-07-27 重构,Codex 对齐)
 *
 * Codex CLI TUI 架构对齐:
 * - 持久化底部面板(Bottom Pane),非右侧 Drawer
 * - 三栏分离:Tasks / Subagents / Terminals(非 4 tab)
 * - 原地更新(同位置重绘,非事件流追加)
 * - 快捷键(Codex 标准):
 *   - Down 打开 / Esc 关闭 / q 关闭(Codex 标准)
 *   - j/k 上下移动 cursor / g/G 跳顶跳底 / space 翻页
 *   - 1/2/3 切换 Tasks/Subagents/Terminals 栏
 *   - Tab 切换排序 / a 切换归档 / v 切换 verbose
 *   - Enter 展开/折叠当前项 / y/n 审批
 *   - / 进入搜索模式 / ? 切换帮助 / Ctrl+Shift+J 保留(Web 习惯)
 *
 * Codex 切栏 cursor 智能保持:
 * - 切栏时若新栏有足够条目,cursor 保持原位置
 * - 若新栏条目不足,clamp 到新栏 max-1
 * - 仅在首次打开或 threadId 切换时重置为 0
 *
 * 设计:仅管理 Pane 的 UI 状态(开关 / threadId / 当前栏 / cursor / verbose / 排序 / 折叠集合 / 搜索 / 高度 / 帮助),
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
  /** 搜索查询(/ 进入搜索模式,空字符串 = 不搜索) */
  searchQuery: string
  /** 是否处于搜索模式(/ 触发,Esc 退出) */
  searchMode: boolean
  /** 是否显示帮助面板(? 触发) */
  showHelp: boolean
  /** Pane 高度(px,默认 360,可 drag resize,范围 [200, 720]) */
  paneHeight: number

  // actions
  openPane: (threadId?: string) => void
  closePane: () => void
  toggle: () => void
  setThreadId: (threadId: string | null) => void
  /**
   * 切栏:Codex 智能保持 cursor
   * - 不再强制重置 0,而是 clamp 到新栏的 max-1
   * - 调用方需传入新栏的可见条目数(newColumnCount)
   */
  setActiveColumn: (column: AgentProgressColumn, newColumnCount?: number) => void
  setThreadIdInput: (value: string) => void
  submitThreadId: () => void
  toggleVerbose: () => void
  toggleShowArchived: () => void
  cycleSortMode: () => void
  toggleExpanded: (id: string) => void
  isExpanded: (id: string) => boolean
  /** cursor 移动(Codex j/k),clamp 到 [0, max-1] */
  moveCursor: (delta: number, max: number) => void
  /** 直接设置 cursor */
  setCursor: (index: number) => void
  /** Enter 键:展开/折叠当前 cursor 指向的条目 */
  toggleExpandedAt: (idAt: (index: number) => string | null) => void
  /** 进入搜索模式(/ 快捷键) */
  enterSearch: () => void
  /** 退出搜索模式(Esc / Enter) */
  exitSearch: () => void
  /** 更新搜索查询 */
  setSearchQuery: (query: string) => void
  /** 切换帮助面板(? 快捷键) */
  toggleHelp: () => void
  /** 设置 pane 高度(drag resize) */
  setPaneHeight: (height: number) => void
  reset: () => void
}

const SORT_CYCLE: AgentProgressSortMode[] = ['recent', 'duration', 'status']

const DEFAULT_PANE_HEIGHT = 360
const MIN_PANE_HEIGHT = 200
const MAX_PANE_HEIGHT = 720

export const PANE_HEIGHT_BOUNDS = { min: MIN_P