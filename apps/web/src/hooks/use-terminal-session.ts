'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { useTerminalStore } from '@/stores/terminal'
import { fetchApi } from '@/lib/api'
import type {
  TerminalSession,
  TerminalCreateInput,
  TerminalCreateResponse,
  TerminalListResponse,
  TerminalResizeInput,
  TerminalRenameInput,
  TerminalRenameResponse,
  TerminalWSServerMessage,
} from '@ihui/types'

/**
 * 终端会话管理 Hook — 封装 REST API 调用 + WebSocket 连接生命周期。
 *
 * REST 调用:
 *   createSession(cwd?)  → POST /terminal/sessions
 *   refreshSessions()    → GET  /terminal/sessions
 *   closeSession(id)     → DELETE /terminal/sessions/:id
 *   resizeSession(id,...)→ POST /terminal/sessions/:id/resize
 *   renameSession(id,...)→ PUT  /terminal/sessions/:id/rename
 *
 * WebSocket:
 *   connectWS(sessionId) → ws(s)://host/ws/terminal/:sessionId?token=xxx
 *   返回 { ws, send, close } 供 terminal-panel 组件使用。
 */

export interface TerminalWSHandle {
  /** WebSocket 实例(null=未连接) */
  ws: WebSocket | null
  /** 发送客户端消息(input/resize/close) */
  send: (msg: unknown) => void
  /** 关闭连接 */
  close: () => void
  /** 连接状态 */
  readyState: number
}

/** 创建 WebSocket URL(同 use-task-websocket.ts 模式) */
function buildWsUrl(sessionId: string, token: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/terminal/${sessionId}?token=${encodeURIComponent(token)}`
}

export function useTerminalSession() {
  const token = useAuthStore((s) => s.token)
  const {
    sessions,
    activeSessionId,
    loading,
    error,
    setSessions,
    addSession,
    removeSession,
    setActive,
    setLoading,
    setError,
    renameSession: renameSessionInStore,
  } = useTerminalStore()

  const activeSession = React.useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  /** 创建新终端会话(REST + store 更新) */
  const createSession = React.useCallback(
    async (opts?: TerminalCreateInput): Promise<TerminalSession | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchApi<TerminalCreateResponse>('/terminal/sessions', {
          method: 'POST',
          body: JSON.stringify(opts ?? {}),
        })
        if (!result.success) {
          setError(result.error)
          return null
        }
        addSession(result.data.session)
        return result.data.session
      } catch (e) {
        setError((e as Error).message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [addSession, setError, setLoading],
  )

  /** 刷新 session 列表 */
  const refreshSessions = React.useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await fetchApi<TerminalListResponse>('/terminal/sessions')
      if (result.success) {
        setSessions(result.data.sessions)
        // 如果没有 active session 且有 session,激活第一个
        const store = useTerminalStore.getState()
        const firstSession = result.data.sessions[0]
        if (!store.activeSessionId && firstSession) {
          setActive(firstSession.id)
        }
      }
    } catch {
      /* 静默失败,不阻塞 UI */
    } finally {
      setLoading(false)
    }
  }, [setActive, setLoading, setSessions])

  /** 关闭终端会话(REST + store 更新 + WS 关闭) */
  const closeSessionById = React.useCallback(
    async (sessionId: string): Promise<void> => {
      // 先从 store 移除(乐观更新)
      removeSession(sessionId)
      try {
        await fetchApi(`/terminal/sessions/${sessionId}`, { method: 'DELETE' })
      } catch {
        /* REST 失败不影响 UI(PTY 可能已退出) */
      }
    },
    [removeSession],
  )

  /** 调整终端大小(REST) */
  const resizeSession = React.useCallback(
    async (sessionId: string, cols: number, rows: number): Promise<void> => {
      try {
        const body: TerminalResizeInput = { cols, rows }
        await fetchApi(`/terminal/sessions/${sessionId}/resize`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      } catch {
        /* resize 失败静默忽略 */
      }
    },
    [],
  )

  /** 重命名终端会话(乐观更新 store,REST 失败回滚) */
  const renameSession = React.useCallback(
    async (sessionId: string, name: string): Promise<boolean> => {
      const trimmed = name.trim()
      // 乐观更新 store
      const prev = useTerminalStore
        .getState()
        .sessions.find((s) => s.id === sessionId)?.name
      renameSessionInStore(sessionId, trimmed)
      try {
        const body: TerminalRenameInput = { name: trimmed }
        const result = await fetchApi<TerminalRenameResponse>(
          `/terminal/sessions/${sessionId}/rename`,
          { method: 'PUT', body: JSON.stringify(body) },
        )
        if (!result.success) {
          // 回滚
          renameSessionInStore(sessionId, prev ?? '')
          return false
        }
        // 以服务端返回为准
        renameSessionInStore(sessionId, result.data.session.name ?? trimmed)
        return true
      } catch {
        // 回滚
        renameSessionInStore(sessionId, prev ?? '')
        return false
      }
    },
    [renameSessionInStore],
  )

  /** 创建 WebSocket 连接(供 terminal-panel 组件使用) */
  const connectWS = React.useCallback(
    (sessionId: string, handlers: {
      onMessage?: (msg: TerminalWSServerMessage) => void
      onOpen?: () => void
      onClose?: () => void
      onError?: (err: string) => void
    }): TerminalWSHandle => {
      if (!token) {
        return { ws: null, send: () => {}, close: () => {}, readyState: WebSocket.CLOSED }
      }

      let ws: WebSocket | null = null
      try {
        ws = new WebSocket(buildWsUrl(sessionId, token))
      } catch (e) {
        handlers.onError?.((e as Error).message)
        return { ws: null, send: () => {}, close: () => {}, readyState: WebSocket.CLOSED }
      }

      const handle: TerminalWSHandle = {
        ws,
        send: (msg: unknown) => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg))
          }
        },
        close: () => {
          if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close(1000, 'client disconnect')
          }
        },
        readyState: ws.readyState,
      }

      ws.onopen = () => {
        handle.readyState = WebSocket.OPEN
        handlers.onOpen?.()
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as TerminalWSServerMessage
          handlers.onMessage?.(msg)
        } catch {
          /* 非 JSON 消息(如 pong 心跳)忽略 */
        }
      }

      ws.onclose = () => {
        handle.readyState = WebSocket.CLOSED
        handlers.onClose?.()
      }

      ws.onerror = () => {
        handle.readyState = WebSocket.CLOSED
        handlers.onError?.('WebSocket 连接失败')
      }

      return handle
    },
    [token],
  )

  return {
    // State
    sessions,
    activeSession,
    activeSessionId,
    loading,
    error,
    // Actions
    createSession,
    refreshSessions,
    closeSession: closeSessionById,
    resizeSession,
    renameSession,
    setActive,
    // WebSocket
    connectWS,
    // Token availability
    hasToken: !!token,
  }
}
