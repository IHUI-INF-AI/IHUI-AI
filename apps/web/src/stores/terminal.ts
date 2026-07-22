import { create } from 'zustand'
import type { TerminalSession } from '@ihui/types'

/**
 * 终端会话 store — 管理 session 列表 + activeSessionId。
 *
 * 数据来源:use-terminal-session hook 调用 REST API 后更新此 store。
 * 组件消费:terminal-panel / terminal-tab-bar / terminal-session-list。
 */

interface TerminalState {
  /** 当前用户的终端 session 列表 */
  sessions: TerminalSession[]
  /** 当前激活的 session ID */
  activeSessionId: string | null
  /** 加载中(创建/列表请求) */
  loading: boolean
  /** 错误信息 */
  error: string | null

  // Actions
  setSessions: (sessions: TerminalSession[]) => void
  addSession: (session: TerminalSession) => void
  updateSession: (id: string, patch: Partial<TerminalSession>) => void
  removeSession: (id: string) => void
  setActive: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    })),

  updateSession: (id, patch) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, ...patch } : sess,
      ),
    })),

  removeSession: (id) =>
    set((s) => {
      const filtered = s.sessions.filter((sess) => sess.id !== id)
      const newActive =
        s.activeSessionId === id
          ? (filtered[0]?.id ?? null)
          : s.activeSessionId
      return { sessions: filtered, activeSessionId: newActive }
    }),

  setActive: (id) => set({ activeSessionId: id }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () => set({ sessions: [], activeSessionId: null, loading: false, error: null }),
}))
