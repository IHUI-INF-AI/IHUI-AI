'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { useTerminalStore } from '@/stores/terminal'
import type { TerminalSplitDirection } from '@/stores/terminal'
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
  TerminalHistoryListResponse,
  TerminalScrollbackResponse,
  TerminalSuggestInput,
  TerminalSuggestResponse,
  TerminalDiagnoseInput,
  TerminalDiagnoseResponse,
  TerminalAutoFixInput,
  TerminalAutoFixResponse,
  TerminalRecordingStartInput,
  TerminalRecordingStartResponse,
  TerminalRecordingStopResponse,
  TerminalRecordingListResponse,
  TerminalRecordingDetailResponse,
  TerminalRecordingEditInput,
  TerminalRecordingEditResponse,
  TerminalRecordingPlayResponse,
  TerminalHistoryRecordInput,
  TerminalSmartHistoryResponse,
} from '@ihui/types'

/**
 * 终端会话管理 Hook — 封装 REST API 调用 + WebSocket 连接生命周期 + 分屏 pane 管理。
 *
 * REST 调用:
 *   createSession(opts?)  → POST /terminal/sessions(支持本地 PTY 与 SSH 远程)
 *   refreshSessions()      → GET  /terminal/sessions
 *   closeSession(id)       → DELETE /terminal/sessions/:id
 *   resizeSession(id,...)  → POST /terminal/sessions/:id/resize
 *   renameSession(id,...)  → PUT  /terminal/sessions/:id/rename
 *   getScrollback(id)     → GET  /terminal/sessions/:id/scrollback(回滚恢复)
 *   listHistorySessions() → GET  /terminal/sessions/history(最近 7 天历史会话)
 *
 * AI 辅助(2026-07-23 立,LLM 调用经 ai-service 转发,不可用返回 503):
 *   suggestCommand(id,input)  → POST /terminal/sessions/:id/suggest
 *   diagnoseError(id,input)   → POST /terminal/sessions/:id/diagnose
 *   autoFix(id,fixCommand)    → POST /terminal/sessions/:id/auto-fix
 *
 * 操作录制与回放(2026-07-23 立,Redis list+hash+30 天 TTL,内存降级):
 *   startRecording(id,title?) → POST /terminal/sessions/:id/recording/start
 *   stopRecording(id)         → POST /terminal/sessions/:id/recording/stop
 *   listRecordings()          → GET  /terminal/recordings
 *   getRecording(id)          → GET  /terminal/recordings/:id
 *   deleteRecording(id)       → DELETE /terminal/recordings/:id
 *   editRecording(id,input)   → PUT  /terminal/recordings/:id
 *   playRecording(id)         → POST /terminal/recordings/:id/play
 *
 * 智能命令历史(2026-07-23 立,相关性打分排序):
 *   recordHistory(id,input)   → POST /terminal/sessions/:id/history
 *   getSmartHistory(id)       → GET  /terminal/sessions/:id/history
 *
 * WebSocket:
 *   connectWS(sessionId) → ws(s)://host/ws/terminal/:sessionId?token=xxx
 *   返回 { ws, send, close } 供 terminal-panel 组件使用。
 *
 * 分屏 pane(2026-07-22):
 *   addPane / removePane / setActivePane / getPanes / getSplitDirection
 *   每个 pane 独立 xterm 实例,共享同一 WS 数据流(后端 PTY 广播给所有 WS 连接)。
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
    panes,
    activePaneId,
    splitDirections,
    // AI 辅助 / 录制 / 智能历史 state
    recordingBySession,
    recordings,
    activePlaybackId,
    commandHistory,
    aiSuggestOpen,
    aiSuggestLoading,
    aiSuggestions,
    aiDiagnoseOpen,
    aiDiagnoseLoading,
    aiDiagnoseResult,
    aiError,
    setSessions,
    addSession,
    removeSession,
    setActive,
    setLoading,
    setError,
    renameSession: renameSessionInStore,
    addPane: addPaneInStore,
    removePane: removePaneInStore,
    setActivePane: setActivePaneInStore,
    getPanes: getPanesInStore,
    getSplitDirection: getSplitDirectionInStore,
    // 录制 / 历史 / AI actions
    startRecording: startRecordingInStore,
    stopRecording: stopRecordingInStore,
    isRecording: isRecordingInStore,
    setRecordings,
    addRecording,
    removeRecording: removeRecordingInStore,
    setActivePlaybackId,
    setCommandHistory,
    setAiSuggestOpen,
    setAiSuggestLoading,
    setAiSuggestions,
    setAiDiagnoseOpen,
    setAiDiagnoseLoading,
    setAiDiagnoseResult,
    setAiError,
    resetAiPanel,
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

  /** 获取会话 scrollback(REST,用于前端独立恢复历史输出) */
  const getScrollback = React.useCallback(
    async (sessionId: string): Promise<string[]> => {
      try {
        const result = await fetchApi<TerminalScrollbackResponse>(
          `/terminal/sessions/${sessionId}/scrollback`,
        )
        if (result.success) {
          return result.data.lines
        }
        return []
      } catch {
        /* 路由未注册或服务端降级,返回空 */
        return []
      }
    },
    [],
  )

  /** 列出最近 7 天的历史会话(REST,从 Redis 扫描 terminal:session:* keys) */
  const listHistorySessions = React.useCallback(async (): Promise<
    TerminalHistoryListResponse['sessions']
  > => {
    try {
      const result = await fetchApi<TerminalHistoryListResponse>(
        '/terminal/sessions/history',
      )
      if (result.success) {
        return result.data.sessions
      }
      return []
    } catch {
      /* 路由未注册或 Redis 不可用,返回空 */
      return []
    }
  }, [])

  // ==================== AI 辅助终端(2026-07-23 立,经 ai-service 转发) ====================

  /**
   * AI 命令建议(POST /terminal/sessions/:id/suggest)。
   * LLM 不可用时服务端返回 503 + errorCode='ai_unavailable',此处返回 null + 写入 aiError。
   */
  const suggestCommand = React.useCallback(
    async (sessionId: string, input: TerminalSuggestInput): Promise<TerminalSuggestResponse | null> => {
      setAiSuggestLoading(true)
      setAiError(null)
      try {
        const result = await fetchApi<TerminalSuggestResponse>(
          `/terminal/sessions/${sessionId}/suggest`,
          { method: 'POST', body: JSON.stringify(input) },
        )
        if (result.success) {
          setAiSuggestions(result.data.suggestions)
          return result.data
        }
        // 503 ai_unavailable 或其他错误
        setAiError(result.error)
        return null
      } catch (e) {
        setAiError((e as Error).message)
        return null
      } finally {
        setAiSuggestLoading(false)
      }
    },
    [setAiError, setAiSuggestLoading, setAiSuggestions],
  )

  /**
   * AI 错误诊断(POST /terminal/sessions/:id/diagnose)。
   * 命令失败时由 terminal-panel 自动触发,诊断结果写入 store 浮层。
   */
  const diagnoseError = React.useCallback(
    async (sessionId: string, input: TerminalDiagnoseInput): Promise<TerminalDiagnoseResponse | null> => {
      setAiDiagnoseLoading(true)
      setAiError(null)
      try {
        const result = await fetchApi<TerminalDiagnoseResponse>(
          `/terminal/sessions/${sessionId}/diagnose`,
          { method: 'POST', body: JSON.stringify(input) },
        )
        if (result.success) {
          setAiDiagnoseResult(result.data)
          return result.data
        }
        setAiError(result.error)
        return null
      } catch (e) {
        setAiError((e as Error).message)
        return null
      } finally {
        setAiDiagnoseLoading(false)
      }
    },
    [setAiDiagnoseLoading, setAiDiagnoseResult, setAiError],
  )

  /**
   * AI 自动修复(POST /terminal/sessions/:id/auto-fix)。
   * 把 diagnose 返回的 fixCommand 写入 PTY 执行,服务端返回 applied=true。
   */
  const autoFix = React.useCallback(
    async (sessionId: string, fixCommand: string): Promise<TerminalAutoFixResponse | null> => {
      setAiError(null)
      try {
        const result = await fetchApi<TerminalAutoFixResponse>(
          `/terminal/sessions/${sessionId}/auto-fix`,
          { method: 'POST', body: JSON.stringify({ fixCommand } satisfies TerminalAutoFixInput) },
        )
        if (result.success) {
          return result.data
        }
        setAiError(result.error)
        return null
      } catch (e) {
        setAiError((e as Error).message)
        return null
      }
    },
    [setAiError],
  )

  // ==================== 操作录制与回放(2026-07-23 立) ====================

  /**
   * 开始录制(POST /terminal/sessions/:id/recording/start)。
   * 同一 session 仅一个活动录制,服务端幂等返回已有 recordingId。
   * 成功后写入 store.recordingBySession 标记正在录制。
   */
  const startRecording = React.useCallback(
    async (sessionId: string, title?: string): Promise<string | null> => {
      try {
        const body: TerminalRecordingStartInput = title ? { title } : {}
        const result = await fetchApi<TerminalRecordingStartResponse>(
          `/terminal/sessions/${sessionId}/recording/start`,
          { method: 'POST', body: JSON.stringify(body) },
        )
        if (result.success) {
          startRecordingInStore(sessionId, result.data.recordingId)
          return result.data.recordingId
        }
        return null
      } catch {
        return null
      }
    },
    [startRecordingInStore],
  )

  /**
   * 停止录制(POST /terminal/sessions/:id/recording/stop)。
   * 服务端持久化到 Redis,返回完整录制对象。成功后写入 store.recordings 列表头部 + 清除录制标记。
   */
  const stopRecording = React.useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const result = await fetchApi<TerminalRecordingStopResponse>(
          `/terminal/sessions/${sessionId}/recording/stop`,
          { method: 'POST' },
        )
        if (result.success) {
          stopRecordingInStore(sessionId)
          // 追加到录制列表头部(精简项)
          const r = result.data.recording
          addRecording({
            id: r.id,
            sessionId: r.sessionId,
            title: r.title,
            startedAt: r.startedAt,
            durationMs: r.durationMs,
            eventCount: r.events.length,
          })
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [stopRecordingInStore, addRecording],
  )

  /** 列出当前用户全部录制(GET /terminal/recordings,30 天 TTL 内) */
  const listRecordings = React.useCallback(async (): Promise<boolean> => {
    try {
      const result = await fetchApi<TerminalRecordingListResponse>('/terminal/recordings')
      if (result.success) {
        setRecordings(result.data.recordings)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [setRecordings])

  /** 获取录制详情(含完整 events,用于回放预览 / 编辑) */
  const getRecording = React.useCallback(
    async (recordingId: string): Promise<TerminalRecordingDetailResponse['recording'] | null> => {
      try {
        const result = await fetchApi<TerminalRecordingDetailResponse>(
          `/terminal/recordings/${recordingId}`,
        )
        if (result.success) {
          return result.data.recording
        }
        return null
      } catch {
        return null
      }
    },
    [],
  )

  /** 删除录制(DELETE /terminal/recordings/:id),成功后从 store 列表移除 */
  const deleteRecording = React.useCallback(
    async (recordingId: string): Promise<boolean> => {
      try {
        const result = await fetchApi(`/terminal/recordings/${recordingId}`, { method: 'DELETE' })
        if (result.success) {
          removeRecordingInStore(recordingId)
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [removeRecordingInStore],
  )

  /**
   * 编辑录制(PUT /terminal/recordings/:id,裁剪/合并/删除事件,整体替换 events)。
   * 成功后更新 store 列表中对应项的 eventCount。
   */
  const editRecording = React.useCallback(
    async (recordingId: string, input: TerminalRecordingEditInput): Promise<boolean> => {
      try {
        const result = await fetchApi<TerminalRecordingEditResponse>(
          `/terminal/recordings/${recordingId}`,
          { method: 'PUT', body: JSON.stringify(input) },
        )
        if (result.success) {
          // 更新列表项的 eventCount + title
          const r = result.data.recording
          setRecordings(
            useTerminalStore.getState().recordings.map((item) =>
              item.id === recordingId
                ? { ...item, eventCount: r.events.length, title: r.title, durationMs: r.durationMs }
                : item,
            ),
          )
          return true
        }
        return false
      } catch {
        return false
      }
    },
    [setRecordings],
  )

  /**
   * 回放录制(POST /terminal/recordings/:id/play)。
   * 服务端创建新 session 并按 timestamp 顺序回放事件,返回新 sessionId。
   * 成功后设置 activePlaybackId 供 tab 显示回放徽章。
   */
  const playRecording = React.useCallback(
    async (recordingId: string): Promise<string | null> => {
      try {
        const result = await fetchApi<TerminalRecordingPlayResponse>(
          `/terminal/recordings/${recordingId}/play`,
          { method: 'POST' },
        )
        if (result.success) {
          setActivePlaybackId(recordingId)
          // 回放创建的新 session 需要刷新列表才能切换过去
          void refreshSessions()
          return result.data.sessionId
        }
        return null
      } catch {
        return null
      }
    },
    [setActivePlaybackId, refreshSessions],
  )

  // ==================== 智能命令历史(2026-07-23 立,相关性打分排序) ====================

  /**
   * 记录命令执行(POST /terminal/sessions/:id/history)。
   * 命令完成后由前端回传,服务端累积 frequency + 写入 Redis hash。
   * 失败静默(不影响终端主流程)。
   */
  const recordHistory = React.useCallback(
    async (sessionId: string, input: TerminalHistoryRecordInput): Promise<void> => {
      try {
        await fetchApi(`/terminal/sessions/${sessionId}/history`, {
          method: 'POST',
          body: JSON.stringify(input),
        })
      } catch {
        /* 静默 */
      }
    },
    [],
  )

  /**
   * 获取智能历史(GET /terminal/sessions/:id/history)。
   * 服务端按相关性打分(cwd+50/gitBranch+30/最近24h+20/frequency*5/exitCode=0+10)排序返回。
   * 成功后写入 store.commandHistory 供 Ctrl+R 搜索消费。
   */
  const getSmartHistory = React.useCallback(
    async (sessionId: string): Promise<TerminalSmartHistoryResponse | null> => {
      try {
        const result = await fetchApi<TerminalSmartHistoryResponse>(
          `/terminal/sessions/${sessionId}/history`,
        )
        if (result.success) {
          setCommandHistory(result.data.entries)
          return result.data
        }
        return null
      } catch {
        return null
      }
    },
    [setCommandHistory],
  )

  // ==================== 分屏 pane 操作(转发 store,提供 paneId 透传) ====================

  /** 新增 pane(Ctrl+Shift+D 垂直分割 / Ctrl+Shift+H 水平分割) */
  const addPane = React.useCallback(
    (sessionId: string, direction?: TerminalSplitDirection): string => {
      return addPaneInStore(sessionId, direction)
    },
    [addPaneInStore],
  )

  /** 移除 pane(关闭 pane 不影响其他 pane 和 session) */
  const removePane = React.useCallback(
    (sessionId: string, paneId: string): void => {
      removePaneInStore(sessionId, paneId)
    },
    [removePaneInStore],
  )

  /** 切换激活 pane(Alt+ArrowLeft/Right/Up/Down 焦点切换) */
  const setActivePane = React.useCallback(
    (paneId: string): void => {
      setActivePaneInStore(paneId)
    },
    [setActivePaneInStore],
  )

  /** 获取 session 的所有 pane id */
  const getPanes = React.useCallback(
    (sessionId: string): string[] => getPanesInStore(sessionId),
    [getPanesInStore],
  )

  /** 获取 session 的分屏方向 */
  const getSplitDirection = React.useCallback(
    (sessionId: string): TerminalSplitDirection =>
      getSplitDirectionInStore(sessionId),
    [getSplitDirectionInStore],
  )

  return {
    // State
    sessions,
    activeSession,
    activeSessionId,
    loading,
    error,
    // Pane state
    panes,
    activePaneId,
    splitDirections,
    // AI 辅助 / 录制 / 智能历史 state
    recordingBySession,
    recordings,
    activePlaybackId,
    commandHistory,
    aiSuggestOpen,
    aiSuggestLoading,
    aiSuggestions,
    aiDiagnoseOpen,
    aiDiagnoseLoading,
    aiDiagnoseResult,
    aiError,
    // Actions — session
    createSession,
    refreshSessions,
    closeSession: closeSessionById,
    resizeSession,
    renameSession,
    setActive,
    // Actions — pane
    addPane,
    removePane,
    setActivePane,
    getPanes,
    getSplitDirection,
    // Scrollback / history(REST)
    getScrollback,
    listHistorySessions,
    // AI 辅助终端(REST,经 ai-service 转发,LLM 不可用返回 503)
    suggestCommand,
    diagnoseError,
    autoFix,
    // 操作录制与回放(REST,Redis list+hash+30 天 TTL,内存降级)
    startRecording,
    stopRecording,
    listRecordings,
    getRecording,
    deleteRecording,
    editRecording,
    playRecording,
    // 录制 / AI 浮层 actions(转发 store)
    isRecording: isRecordingInStore,
    setRecordings,
    setActivePlaybackId,
    setCommandHistory,
    setAiSuggestOpen,
    setAiDiagnoseOpen,
    setAiError,
    resetAiPanel,
    // 智能命令历史(REST,相关性打分排序)
    recordHistory,
    getSmartHistory,
    // WebSocket
    connectWS,
    // Token availability
    hasToken: !!token,
  }
}
