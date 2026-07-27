import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Agent 任务进度查看 Bottom Pane 全局状态
 *
 * 设计参考:社区 fork "Open Codex CLI"(https://github.com/LEON-gittech/Open-Codex-CLI)
 * 提出的 bottom pane 设计(Issue #22099),快捷键借鉴 vim/lazygit 风格自创,
 * 非官方 Codex CLI 规范(Codex 官方无此功能)。
 *
 * 三栏分离:Tasks / Subagents / Terminals
 * 原地更新(同位置重绘,非事件流追加)
 * 快捷键:
 *   - Down 打开 / Esc 关闭 / q 关闭
 *   - j/k 上下移动 cursor / g/G 跳顶跳底 / space/PgDn 翻页 / PgUp 上翻
 *   - 1/2/3 切换 Tasks/Subagents/Terminals 栏
 *   - Tab 切换排序 / a 切换归档 / v 切换 verbose
 *   - Enter 展开/折叠当前项 / y/n 审批
 *   - / 进入搜索模式 / ? 切换帮助 / Ctrl+Shift+J 保留(Web 习惯)
 *
 * 切栏 cursor 智能保持:
 * - 切栏时若新栏有足够条目,cursor 保持原位置
 * - 若新栏条目不足,clamp 到新栏 max-1
 * - 仅在首次打开或 threadId 切换时重置为 0
 *
 * localStorage 持久化(2026-07-27 立):
 * - 持久化字段:open / paneHeight / verbose / showArchived / activeColumn
 * - 不持久化:threadId / threadIdInput / cursorIndex / searchQuery / searchMode / showHelp / expandedIds(会话级)
 * - key: `ihui-agent-progress-pane`
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

export const PANE_HEIGHT_BOUNDS = { min: MIN_PANE_HEIGHT, max: MAX_PANE_HEIGHT }

const STORAGE_KEY = 'ihui-agent-progress-pane'

/** 持久化字段子集(会话级字段不持久化) */
interface PersistedState {
  open: boolean
  paneHeight: number
  verbose: boolean
  showArchived: boolean
  activeColumn: AgentProgressColumn
}

/** 从 localStorage 读取持久化状态(SSR 安全) */
function loadPersistedState(): Partial<PersistedState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    // 校验 activeColumn 枚举
    if (parsed.activeColumn && !['tasks', 'subagents', 'terminals'].includes(parsed.activeColumn)) {
      delete parsed.activeColumn
    }
    // 校验 paneHeight 范围
    if (typeof parsed.paneHeight === 'number') {
      parsed.paneHeight = Math.max(MIN_PANE_HEIGHT, Math.min(MAX_PANE_HEIGHT, parsed.paneHeight))
    }
    return parsed
  } catch {
    return {}
  }
}

/** 写入 localStorage(SSR 安全 + 节流避免高频写入) */
let writeScheduled = false
function schedulePersistWrite(state: PersistedState) {
  if (typeof window === 'undefined') return
  if (writeScheduled) return
  writeScheduled = true
  // 用 microtask 节流,同一 tick 内多次 set 只写一次
  queueMicrotask(() => {
    writeScheduled = false
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage 不可用或 quota exceeded,忽略
    }
  })
}

const persisted = loadPersistedState()

export const useAgentProgressPaneStore = create<AgentProgressPaneState>()(
  subscribeWithSelector((set, get) => ({
  open: persisted.open ?? false,
  threadId: null,
  activeColumn: persisted.activeColumn ?? 'tasks',
  threadIdInput: '',
  verbose: persisted.verbose ?? false,
  showArchived: persisted.showArchived ?? true,
  sortMode: 'recent',
  expandedIds: new Set<string>(),
  cursorIndex: 0,
  searchQuery: '',
  searchMode: false,
  showHelp: false,
  paneHeight: persisted.paneHeight ?? DEFAULT_PANE_HEIGHT,

  openPane: (threadId) =>
    set((s) => ({
      open: true,
      threadId: threadId ?? s.threadId,
      threadIdInput: threadId ?? s.threadIdInput,
      cursorIndex: 0,
    })),

  closePane: () => set({ open: false, searchMode: false, searchQuery: '', showHelp: false }),

  toggle: () => set((s) => ({ open: !s.open })),

  setThreadId: (threadId) =>
    set({
      threadId,
      threadIdInput: threadId ?? '',
      cursorIndex: 0,
    }),

  setActiveColumn: (activeColumn, newColumnCount) =>
    set((s) => {
      // Codex 智能保持 cursor:若未提供 newColumnCount,保持原 cursor
      // 若提供 newColumnCount,clamp 到 [0, newColumnCount-1]
      if (newColumnCount === undefined) {
        return { activeColumn }
      }
      if (newColumnCount <= 0) {
        return { activeColumn, cursorIndex: 0 }
      }
      const clampedCursor = Math.min(s.cursorIndex, newColumnCount - 1)
      return { activeColumn, cursorIndex: clampedCursor }
    }),

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

  enterSearch: () => set({ searchMode: true, searchQuery: '' }),

  exitSearch: () => set({ searchMode: false, searchQuery: '' }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),

  setPaneHeight: (height) =>
    set({
      paneHeight: Math.max(MIN_PANE_HEIGHT, Math.min(MAX_PANE_HEIGHT, height)),
    }),

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
      searchQuery: '',
      searchMode: false,
      showHelp: false,
      paneHeight: DEFAULT_PANE_HEIGHT,
    }),
  })),
)

// 持久化订阅:仅监听持久化字段变化时写入 localStorage(同 tick 多次 set 节流)
if (typeof window !== 'undefined') {
  useAgentProgressPaneStore.subscribe(
    (s) => ({
      open: s.open,
      paneHeight: s.paneHeight,
      verbose: s.verbose,
      showArchived: s.showArchived,
      activeColumn: s.activeColumn,
    }),
    (persistedState) => schedulePersistWrite(persistedState),
    { fireImmediately: false },
  )
}
