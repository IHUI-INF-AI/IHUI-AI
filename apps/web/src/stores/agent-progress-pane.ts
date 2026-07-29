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
 *
 * Phase 24(2026-07-29):SSR 安全 — 之前在模块加载时同步读 localStorage,
 * 导致 SSR/CSR 初始 state 不一致,触发 React Hydration 错误。
 * 修复:store 初始化用 SSR 安全的默认 open=false / pinned=true,
 * 客户端 mount 后通过 hydrateAgentProgressPaneFromStorage() 同步 localStorage 真实值。
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

let persistTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersistWrite(state: PersistedState): void {
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

// Phase 24 修复:模块加载时不再读取 localStorage,直接用 SSR 安全默认值
// (open=false, pinned=true),客户端 mount 后通过 hydrateAgentProgressPaneFromStorage() 注入真实值
export const useAgentProgressPaneStore = create<AgentProgressPaneState>()(
  subscribeWithSelector((set) => ({
    open: false,
    threadId: null,
    pinned: true,
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

/**
 * Phase 24(2026-07-29 立,SSR 修复):客户端 mount 后调用,同步 localStorage 中的
 * 持久化值到 store。仅 patch 已存在的字段,避免用 false 覆盖 SSR 默认值。
 *
 * 使用方式(在应用根组件挂载后调用一次):
 * ```tsx
 * function App() {
 *   useEffect(() => {
 *     hydrateAgentProgressPaneFromStorage()
 *   }, [])
 *   return <Root />
 * }
 * ```
 */
let hydrationApplied = false
export function hydrateAgentProgressPaneFromStorage(): void {
  if (hydrationApplied) return
  if (typeof window === 'undefined') return
  hydrationApplied = true
  const persisted = loadPersisted()
  if (Object.keys(persisted).length === 0) return
  useAgentProgressPaneStore.setState((prev) => {
    const next = { ...prev }
    if (typeof persisted.open === 'boolean') next.open = persisted.open
    if (typeof persisted.pinned === 'boolean') next.pinned = persisted.pinned
    return next
  })
}
