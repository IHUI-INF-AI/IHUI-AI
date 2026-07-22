import { create } from 'zustand'
import type { TerminalSession } from '@ihui/types'

/**
 * 终端会话 store — 管理 session 列表 + activeSessionId + 分屏 pane 状态。
 *
 * 数据来源:use-terminal-session hook 调用 REST API 后更新此 store。
 * 组件消费:terminal-panel / terminal-tab-bar / terminal-session-list。
 *
 * 分屏深化(2026-07-22):
 * - panes: Record<sessionId, paneId[]> 每个 session 可有多个独立 pane(独立 xterm 实例)
 * - splitDirection: 'vertical'(列并排) | 'horizontal'(行堆叠)
 * - 每个 pane 订阅同一 WS 数据流(后端 PTY 数据广播给所有 WS 连接)
 * - 关闭 pane 不影响其他 pane 和 session;关闭 session 时一并清理所有 pane
 */

/** 分屏方向(vertical=左右并排,horizontal=上下堆叠) */
export type TerminalSplitDirection = 'vertical' | 'horizontal'

interface TerminalState {
  /** 当前用户的终端 session 列表 */
  sessions: TerminalSession[]
  /** 当前激活的 session ID */
  activeSessionId: string | null
  /** 加载中(创建/列表请求) */
  loading: boolean
  /** 错误信息 */
  error: string | null

  /** 分屏 pane 状态:sessionId → paneId 列表(每个 session 至少 1 个 pane) */
  panes: Record<string, string[]>
  /** 当前激活的 pane ID(用于焦点切换 + 键盘事件路由) */
  activePaneId: string | null
  /** 每个 session 的分屏方向(默认 vertical) */
  splitDirections: Record<string, TerminalSplitDirection>

  // Actions — session 级别
  setSessions: (sessions: TerminalSession[]) => void
  addSession: (session: TerminalSession) => void
  updateSession: (id: string, patch: Partial<TerminalSession>) => void
  removeSession: (id: string) => void
  setActive: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  /** 重命名会话(乐观更新 store,REST 失败由调用方回滚) */
  renameSession: (id: string, name: string) => void
  reset: () => void

  // Actions — pane 级别
  /** 为 session 新增 pane(返回新 paneId) */
  addPane: (sessionId: string, direction?: TerminalSplitDirection) => string
  /** 移除 session 的指定 pane(若移除最后一个 pane,同时移除 session) */
  removePane: (sessionId: string, paneId: string) => void
  /** 设置当前激活 pane */
  setActivePane: (paneId: string) => void
  /** 获取 session 的所有 pane id */
  getPanes: (sessionId: string) => string[]
  /** 获取 session 的分屏方向 */
  getSplitDirection: (sessionId: string) => TerminalSplitDirection
}

/** 生成 pane 唯一 ID(避免引入额外依赖,用时间戳 + 随机数) */
function generatePaneId(): string {
  return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 默认 pane ID(session 创建时初始化的第一个 pane) */
function defaultPaneId(sessionId: string): string {
  return `pane-${sessionId.slice(0, 8)}-1`
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,
  error: null,
  panes: {},
  activePaneId: null,
  splitDirections: {},

  setSessions: (sessions) =>
    set((s) => {
      // 为新出现的 session 初始化默认 pane(已存在的 session 保留原 pane 状态)
      const newPanes: Record<string, string[]> = { ...s.panes }
      const newDirections = { ...s.splitDirections }
      for (const sess of sessions) {
        if (!newPanes[sess.id]) {
          newPanes[sess.id] = [defaultPaneId(sess.id)]
          newDirections[sess.id] = 'vertical'
        }
      }
      // 清理已不存在的 session 的 pane 状态(refresh 后某些 session 可能已关闭)
      const liveIds = new Set(sessions.map((x) => x.id))
      for (const key of Object.keys(newPanes)) {
        if (!liveIds.has(key)) {
          delete newPanes[key]
          delete newDirections[key]
        }
      }
      // 初始化 activePaneId(若当前为空且有 session)
      let activePaneId = s.activePaneId
      if (!activePaneId && sessions.length > 0) {
        const firstSession = sessions[0]
        if (firstSession) {
          const firstPane = newPanes[firstSession.id]?.[0]
          if (firstPane) activePaneId = firstPane
        }
      }
      return { sessions, panes: newPanes, splitDirections: newDirections, activePaneId }
    }),

  addSession: (session) =>
    set((s) => {
      const paneId = defaultPaneId(session.id)
      return {
        sessions: [...s.sessions, session],
        activeSessionId: session.id,
        panes: { ...s.panes, [session.id]: [paneId] },
        splitDirections: { ...s.splitDirections, [session.id]: 'vertical' },
        activePaneId: paneId,
      }
    }),

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
      // 清理 pane 状态
      const newPanes = { ...s.panes }
      delete newPanes[id]
      const newDirections = { ...s.splitDirections }
      delete newDirections[id]
      // 若当前 activePaneId 属于被移除 session 的 pane,重置为首个 session 的首个 pane
      let activePaneId = s.activePaneId
      const removedPanes = s.panes[id] ?? []
      if (removedPanes.includes(activePaneId ?? '')) {
        activePaneId = filtered[0] ? (newPanes[filtered[0].id]?.[0] ?? null) : null
      }
      return { sessions: filtered, activeSessionId: newActive, panes: newPanes, splitDirections: newDirections, activePaneId }
    }),

  setActive: (id) =>
    set((s) => {
      // 切换 session 时,activePaneId 也跟随切换到该 session 的第一个 pane
      const firstPane = id ? (s.panes[id]?.[0] ?? null) : null
      return { activeSessionId: id, activePaneId: firstPane ?? s.activePaneId }
    }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  renameSession: (id, name) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, name } : sess,
      ),
    })),

  reset: () =>
    set({
      sessions: [],
      activeSessionId: null,
      loading: false,
      error: null,
      panes: {},
      activePaneId: null,
      splitDirections: {},
    }),

  // ==================== Pane Actions ====================

  addPane: (sessionId, direction = 'vertical') => {
    const paneId = generatePaneId()
    set((s) => {
      const currentPanes = s.panes[sessionId] ?? []
      return {
        panes: { ...s.panes, [sessionId]: [...currentPanes, paneId] },
        splitDirections: { ...s.splitDirections, [sessionId]: direction },
        activePaneId: paneId,
      }
    })
    return paneId
  },

  removePane: (sessionId, paneId) =>
    set((s) => {
      const currentPanes = s.panes[sessionId] ?? []
      const newPanesArr = currentPanes.filter((id) => id !== paneId)
      // 若移除后该 session 无 pane,从 store 一并移除 session(乐观)
      if (newPanesArr.length === 0) {
        const newPanes = { ...s.panes }
        delete newPanes[sessionId]
        const newDirections = { ...s.splitDirections }
        delete newDirections[sessionId]
        const filteredSessions = s.sessions.filter((x) => x.id !== sessionId)
        const newActiveSession =
          s.activeSessionId === sessionId
            ? (filteredSessions[0]?.id ?? null)
            : s.activeSessionId
        const newActivePane =
          newActiveSession ? (newPanes[newActiveSession]?.[0] ?? null) : null
        return {
          sessions: filteredSessions,
          activeSessionId: newActiveSession,
          panes: newPanes,
          splitDirections: newDirections,
          activePaneId: newActivePane,
        }
      }
      // 仍有 pane:调整 activePaneId(若被移除的是 active pane,切到第一个)
      const newActivePane =
        s.activePaneId === paneId ? newPanesArr[0] : s.activePaneId
      return {
        panes: { ...s.panes, [sessionId]: newPanesArr },
        activePaneId: newActivePane,
      }
    }),

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  getPanes: (sessionId) => get().panes[sessionId] ?? [],

  getSplitDirection: (sessionId) =>
    get().splitDirections[sessionId] ?? 'vertical',
}))
