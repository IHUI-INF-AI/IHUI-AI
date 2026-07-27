import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Agent 任务进度查看 Bottom Pane 全局状态(2026-07-27 v4 重构,Codex 流式对齐)
 *
 * Codex 真实样式对齐(v4):
 * - 单栏流式事件日志(非三栏 TUI 数据浏览器)
 * - 事件按时间顺序流式追加,自动滚到底部
 * - 简洁事件项:`• <event-type> <summary>` + 可展开 ` └ <details>`
 * - 当前运行项:spinner `⠏ <running-task>`
 * - plan 用 □/✔ 嵌入流中
 * - 关闭按钮 ✕ 可见(右上角)
 *
 * 快捷键(简化):
 *   - Ctrl+Shift+J 切换开关 / ArrowDown 打开 / Esc 关闭
 *   - v 切换 verbose(显示原始 ID)
 *   - Enter 展开当前 hover 事件详情
 *
 * localStorage 持久化:open / paneHeight / verbose / autoScroll
 */
interface AgentProgressPaneState {
  /** Pane 是否展开 */
  open: boolean
  /** 当前查看的 threadId(null = 空状态,显示输入框) */
  threadId: string | null
  /** 输入框中的 threadId 草稿(未提交) */
  threadIdInput: string
  /** verbose 模式(显示原始 ID,默认 false 显示人类可读昵称) */
  verbose: boolean
  /** 是否自动滚到底部(流式追加时,默认 true) */
  autoScroll: boolean
  /** 展开的事件 ID 集合(默认折叠,点击展开详情) */
  expandedIds: Set<string>
  /** Pane 高度(px,默认 240 紧凑,可 drag resize,范围 [160, 600]) */
  paneHeight: number

  // actions
  openPane: (threadId?: string) => void
  closePane: () => void
  toggle: () => void
  setThreadId: (threadId: string | null) => void
  setThreadIdInput: (value: string) => void
  submitThreadId: () => void
  toggleVerbose: () => void
  setAutoScroll: (auto: boolean) => void
  toggleExpanded: (id: string) => void
  isExpanded: (id: string) => boolean
  setPaneHeight: (height: number) => void
  reset: () => void
}

const DEFAULT_PANE_HEIGHT = 240
const MIN_PANE_HEIGHT = 160
const MAX_PANE_HEIGHT = 600

export const PANE_HEIGHT_BOUNDS = { min: MIN_PANE_HEIGHT, max: MAX_PANE_HEIGHT }

const STORAGE_KEY = 'ihui-agent-progress-pane-v4'

interface PersistedState {
  open: boolean
  paneHeight: number
  verbose: boolean
  autoScroll: boolean
}

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    const out: Partial<PersistedState> = {}
    if (typeof parsed.open === 'boolean') out.open = parsed.open
    if (typeof parsed.paneHeight === 'number') {
      out.paneHeight = Math.min(MAX_PANE_HEIGHT, Math.max(MIN_PANE_HEIGHT, parsed.paneHeight))
    }
    if (typeof parsed.verbose === 'boolean') out.verbose = parsed.verbose
    if (typeof parsed.autoScroll === 'boolean') out.autoScroll = parsed.autoScroll
    return out
  } catch {
    return {}
  }
}

const persisted = loadPersisted()

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersistWrite(state: PersistedState) {
  if (typeof window === 'undefined') return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 忽略配额错误
    }
  }, 200)
}

export const useAgentProgressPaneStore = create<AgentProgressPaneState>()(
  subscribeWithSelector((set, get) => ({
    open: persisted.open ?? false,
    threadId: null,
    threadIdInput: '',
    verbose: persisted.verbose ?? false,
    autoScroll: persisted.autoScroll ?? true,
    expandedIds: new Set<string>(),
    paneHeight: persisted.paneHeight ?? DEFAULT_PANE_HEIGHT,

    openPane: (threadId) =>
      set((s) => ({
        open: true,
        threadId: threadId ?? s.threadId,
        threadIdInput: threadId ?? s.threadIdInput,
      })),

    closePane: () => set({ open: false }),

    toggle: () => set((s) => ({ open: !s.open })),

    setThreadId: (threadId) =>
      set((s) => ({ threadId, threadIdInput: threadId ?? s.threadIdInput })),

    setThreadIdInput: (value) => set({ threadIdInput: value }),

    submitThreadId: () => {
      const input = useAgentProgressPaneStore.getState().threadIdInput.trim()
      if (!input) return
      set({ threadId: input })
    },

    toggleVerbose: () => set((s) => ({ verbose: !s.verbose })),

    setAutoScroll: (auto) => set({ autoScroll: auto }),

    toggleExpanded: (id) =>
      set((s) => {
        const next = new Set(s.expandedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { expandedIds: next }
      }),

    isExpanded: (id) => get().expandedIds.has(id),

    setPaneHeight: (height) =>
      set({
        paneHeight: Math.min(MAX_PANE_HEIGHT, Math.max(MIN_PANE_HEIGHT, Math.round(height))),
      }),

    reset: () =>
      set({
        open: false,
        threadId: null,
        threadIdInput: '',
        verbose: false,
        autoScroll: true,
        expandedIds: new Set<string>(),
        paneHeight: DEFAULT_PANE_HEIGHT,
      }),
  })),
)

// 持久化订阅(仅持久化 open/paneHeight/verbose/autoScroll)
if (typeof window !== 'undefined') {
  useAgentProgressPaneStore.subscribe(
    (s) => ({
      open: s.open,
      paneHeight: s.paneHeight,
      verbose: s.verbose,
      autoScroll: s.autoScroll,
    }),
    (persistedState) => schedulePersistWrite(persistedState),
    { fireImmediately: false },
  )
}
