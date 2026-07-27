import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Agent 任务进度 popover 全局状态(2026-07-27 v6 重构)
 *
 * v6 改动(用户规则):
 * - 从底部 fixed 大弹窗改为输入容器右上角的小 popover
 * - 删除 threadId 输入框(自动从 useChatStore.conversationId 同步)
 * - 删除 verbose/autoScroll/paneHeight/expandedIds 等 v4 残留状态
 * - 新增 pinned 状态(钉住/取消置顶切换)
 *
 * 持久化:open / pinned(localStorage)
 */
interface AgentProgressPaneState {
  /** Pane 是否展开 */
  open: boolean
  /** 当前查看的 threadId(自动从 useChatStore.conversationId 同步,无需用户输入) */
  threadId: string | null
  /** 是否钉住(pinned=true 时点击外部不关闭;unpin 时点击外部关闭) */
  pinned: boolean
  /** 当前进度:正在执行的步骤序号(1-based,0 = 无进行中) */
  progressCurrent: number
  /** 当前进度:总步骤数(0 = 无任务计划) */
  progressTotal: number

  // actions
  openPane: () => void
  closePane: () => void
  toggle: () => void
  setThreadId: (threadId: string | null) => void
  togglePin: () => void
  setProgress: (current: number, total: number) => void
  reset: () => void
}

const STORAGE_KEY = 'ihui-agent-progress-pane-v6'

interface PersistedState {
  open: boolean
  pinned: boolean
}

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    const out: Partial<PersistedState> = {}
    if (typeof parsed.open === 'boolean') out.open = parsed.open
    if (typeof parsed.pinned === 'boolean') out.pinned = parsed.pinned
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
  subscribeWithSelector((set) => ({
    open: persisted.open ?? false,
    threadId: null,
    pinned: persisted.pinned ?? true,
    progressCurrent: 0,
    progressTotal: 0,

    openPane: () => set({ open: true }),

    closePane: () => set({ open: false }),

    toggle: () => set((s) => ({ open: !s.open })),

    setThreadId: (threadId) => set({ threadId }),

    togglePin: () => set((s) => ({ pinned: !s.pinned })),

    setProgress: (current, total) => set({ progressCurrent: current, progressTotal: total }),

    reset: () =>
      set({
        open: false,
        threadId: null,
        pinned: true,
        progressCurrent: 0,
        progressTotal: 0,
      }),
  })),
)

// 持久化订阅(仅持久化 open/pinned)
if (typeof window !== 'undefined') {
  useAgentProgressPaneStore.subscribe(
    (s) => ({
      open: s.open,
      pinned: s.pinned,
    }),
    (persistedState) => schedulePersistWrite(persistedState),
    { fireImmediately: false },
  )
}
