import { create } from 'zustand'

import { getGitStatus, getGithubStatus, type GithubStatus } from '@ihui/api-client'
import type { GitStatusSnapshot } from '@ihui/types'

/**
 * EnvironmentInfoStore — AI 面板右上角"环境信息"按钮对应的 popover 状态机(2026-08-17 立)。
 *
 * 设计:
 * - session-only(不持久化):每次进入页面 popover 默认折叠,用户主动点开才加载数据。
 * - fetchStatus 每次都重新拉(对标 Cursor 行为);如已在 loading 中,直接忽略重复触发。
 * - workspacePath 必传(无 active workspace 时,popover 渲染"未选择工作区"占位,不动 API)。
 * - 失败/超时 → snapshot 置为 null + error 写消息,UI 兜底显示降级文案。
 */
interface EnvironmentInfoState {
  open: boolean
  /** 后端返回的最新快照(isRepo=false 时仍写入,前端用其分支/计数展示降级) */
  snapshot: GitStatusSnapshot | null
  loading: boolean
  error: string | null
  lastFetchedAt: number | null
  /** 提交/推送弹窗(2026-08-17 Phase4:点击"提交或推送"行打开,对齐 Cursor 弹窗交互) */
  commitDialogOpen: boolean
  /** 完整详情 Dialog(2026-08-17 Phase5:header "+" 展开,方案 A 全屏大尺寸) */
  fullViewOpen: boolean
  /** GitHub 配置弹窗(2026-08-17:PR 行"连接 GitHub"入口,配置 token) */
  githubConfigOpen: boolean
  /** GitHub 仓库/token 状态(检测后写入) */
  githubStatus: GithubStatus | null
}

interface EnvironmentInfoActions {
  openPopover: () => void
  closePopover: () => void
  togglePopover: () => void
  /** 重新拉数据;workspacePath 缺失/与上次一致且无错误 → 跳过(防抖) */
  fetchStatus: (workspacePath: string | null) => Promise<void>
  /** 检测 GitHub 仓库状态 + token 配置情况 */
  fetchGithubStatus: (workspacePath: string | null) => Promise<void>
  openCommitDialog: () => void
  closeCommitDialog: () => void
  openFullView: () => void
  closeFullView: () => void
  openGithubConfig: () => void
  closeGithubConfig: () => void
  reset: () => void
}

const INITIAL: EnvironmentInfoState = {
  open: false,
  snapshot: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
  commitDialogOpen: false,
  fullViewOpen: false,
  githubConfigOpen: false,
  githubStatus: null,
}

export const useEnvironmentInfoStore = create<EnvironmentInfoState & EnvironmentInfoActions>(
  (set, get) => ({
    ...INITIAL,
    openPopover: () => set({ open: true }),
    closePopover: () => set({ open: false }),
    togglePopover: () => set((s) => ({ open: !s.open })),
    openCommitDialog: () => set({ commitDialogOpen: true }),
    closeCommitDialog: () => set({ commitDialogOpen: false }),
    openFullView: () => set({ fullViewOpen: true }),
    closeFullView: () => set({ fullViewOpen: false }),
    openGithubConfig: () => set({ githubConfigOpen: true }),
    closeGithubConfig: () => set({ githubConfigOpen: false }),
    reset: () => set(INITIAL),

    fetchGithubStatus: async (workspacePath) => {
      if (!workspacePath) return
      try {
        const res = await getGithubStatus({ workspacePath })
        if (res.success && res.data) {
          set({ githubStatus: res.data })
        }
      } catch {
        // 静默失败,不阻塞环境信息主流程
      }
    },

    fetchStatus: async (workspacePath) => {
      const { loading } = get()
      if (loading) return
      if (!workspacePath) {
        set({ snapshot: null, error: null, loading: false })
        return
      }
      set({ loading: true, error: null })
      try {
        const res = await getGitStatus({ workspacePath })
        if (!res.success) {
          set({
            loading: false,
            error: res.error ?? '环境信息加载失败',
            snapshot: null,
            lastFetchedAt: Date.now(),
          })
          return
        }
        set({
          loading: false,
          snapshot: res.data,
          error: null,
          lastFetchedAt: Date.now(),
        })
      } catch (e) {
        set({
          loading: false,
          error: e instanceof Error ? e.message : '环境信息加载失败',
          snapshot: null,
          lastFetchedAt: Date.now(),
        })
      }
    },
  }),
)

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(
    window as unknown as {
      __envInfoStore?: typeof useEnvironmentInfoStore
    }
  ).__envInfoStore = useEnvironmentInfoStore
}