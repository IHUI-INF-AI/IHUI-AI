// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useTranslations } from 'next-intl'

import { useAuthStore } from '@/stores/auth'

/** G-86(2026-10-29):WS 重连硬上限默认值。耗尽 ⇒ 转降级或失败终态,绝不无限重连 */
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5

/** 兜底(SSE)腿对浏览器原生瞬态重连的容忍轮数;超过即 close ⇒ 可见终态(有界纪律与 WS 腿同源) */
export const MAX_FALLBACK_TRANSIENT_RECONNECTS = 2

/** 指数退避唯一算式(构造失败与 onclose 两条路径共用,禁止第二份副本) */
export function wsBackoffDelay(attempt: number, maxReconnectDelay: number): number {
  return Math.min(1000 * 2 ** attempt, maxReconnectDelay)
}

/** 连接状态机。终态('degraded'/'failed')都有显式文案,"没有终态"绝不渲染成"完成" */
export type WebSocketStreamStatus =
  'connecting' | 'connected' | 'reconnecting' | 'degraded' | 'failed'

/** 放弃原因(机器可读、可归因;人读文案一律走 wsChannel.* i18n 键,端内禁硬编码) */
export type WebSocketStreamStopReason =
  'reconnect-exhausted' | 'fallback-unavailable' | 'fallback-failed'

/** 既有 HTTP/SSE 通道的兜底出口描述(G-86:WS 前置不透传 Upgrade 时不得挂死+无限重连) */
export interface WebSocketFallbackOptions {
  /** SSE(event-stream)地址供给器;返回空/null ⇒ 降级路径不可用 ⇒ 判 fallback-unavailable */
  urlBuilder: (token: string | null) => string | null
  /** 兜底帧守卫;默认复用主 messageGuard(帧形不同时可注入) */
  messageGuard?: (data: unknown) => boolean
}

export interface WebSocketHookOptions<TMessage> {
  urlBuilder: (token: string | null) => string
  messageGuard: (data: unknown) => data is TMessage
  heartbeatInterval?: number
  maxReconnectDelay?: number
  /** 心跳消息工厂,默认发送 'ping' 字符串 */
  heartbeatMessage?: () => string
  /** WS 重连硬上限(默认 5 次):耗尽后转 fallback 或失败终态 */
  maxReconnectAttempts?: number
  /** HTTP/SSE 兜底通道;配置后重连耗尽自动切换继续把内容流完 */
  fallback?: WebSocketFallbackOptions
}

export interface WebSocketHookResult<TMessage> {
  send: (data: string) => void
  close: () => void
  isConnected: boolean
  lastMessage: TMessage | null
  /** 人读状态文案(i18n);null=无异常。绝不静默 */
  error: string | null
  status: WebSocketStreamStatus
  /** 已消耗的重连次数(可归因:第 attempt/max 次;连接成功即清零) */
  reconnectAttempt: number
  maxReconnectAttempts: number
  /** 仅 status='failed' 时有值 */
  stopReason: WebSocketStreamStopReason | null
  /** 失败/降级后的人为恢复出口:重置计数、摘掉兜底、重走 WS 阶梯 */
  retry: () => void
}

/**
 * WebSocket Hook 工厂函数。
 *
 * 封装通用能力：自动附加 JWT token、心跳、断线指数退避重连（有界）、消息类型守卫、
 * 以及 HTTP/SSE 降级兜底。
 * SSR 安全（typeof window 检查 + effect 内连接）。
 *
 * 2026-08-02 修复 Bug #17:新增 `enabled` 参数,支持多 hook 实例并存但只激活一个。
 * 用于 use-ai-websocket.ts 始终挂载 5 个 provider hook(符合 Rules of Hooks),
 * 按 provider 选择 active hook,其他 hook enabled=false 不建立连接。
 *
 * 2026-10-29 G-86(线上前置未透传 Upgrade ⇒ WS 全通道 404 的仓内侧):
 * 2026-09-17 曾把重连改成无限(理由是"耗尽后永久放弃且无恢复手段")。该前提现已不成立——
 * 本实现给出三条出路后才恢复**有界**重连(默认 5 次,可归因:第 attempt/max 次):
 * ① 配置 `fallback` 时,耗尽后自动改走既有 HTTP/SSE 通道继续把内容流完(status='degraded',
 *    用户可见,不静默);② 兜底不可用/也断 ⇒ status='failed' + stopReason 可归因的终态;
 * ③ 恢复出口 = retry()(人为)/新凭据(token 变更)/online 网络事件(重置计数)。
 * 无限重连把"永久 404 型故障"变成后台无限锤;有界+兜底+可见终态才是降级。
 */
export function createWebSocketHook<TMessage>(options: WebSocketHookOptions<TMessage>) {
  const {
    heartbeatInterval = 30000,
    maxReconnectDelay = 30000,
    heartbeatMessage = () => 'ping',
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    fallback,
  } = options

  return function useWS(enabled = true): WebSocketHookResult<TMessage> {
    const token = useAuthStore((s) => s.token)
    const t = useTranslations('wsChannel')
    const { urlBuilder, messageGuard } = options

    // t 的身份可能随 next-intl provider 重渲染而变;若进 useCallback deps,connect/effect
    // 整链会被反复拆建(旧实现未引用 t,从未踩到)。存 ref:调用时取新值,deps 恒定。
    const tRef = React.useRef(t)
    tRef.current = t

    const [isConnected, setConnected] = React.useState(false)
    const [lastMessage, setLastMessage] = React.useState<TMessage | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [status, setStatus] = React.useState<WebSocketStreamStatus>('connecting')
    const [attemptShown, setAttemptShown] = React.useState(0)
    const [stopReason, setStopReason] = React.useState<WebSocketStreamStopReason | null>(null)

    const wsRef = React.useRef<WebSocket | null>(null)
    const reconnectAttempt = React.useRef(0)
    const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const heartbeatTimer = React.useRef<ReturnType<typeof setInterval> | null>(null)
    const closedByUnmount = React.useRef(false)
    const esRef = React.useRef<EventSource | null>(null)
    const fallbackTransientReconnects = React.useRef(0)
    /** WS 腿已判终态:此后只有 retry()/新 token/online 事件/enabled 开关能复活,不自动回锤 */
    const wsTerminalRef = React.useRef(false)
    /** connect 与 scheduleReconnect 互相引用,经 ref 解环(每渲染刷新为最新闭包) */
    const connectRef = React.useRef<() => void>(() => {})
    /** 上一枚 token:变更 = 新凭据到手的合法重连机会(demand-audit 换票链路依赖这一点) */
    const lastTokenRef = React.useRef<string | null | undefined>(undefined)

    const clearTimers = React.useCallback(() => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current)
        heartbeatTimer.current = null
      }
    }, [])

    const stopFallback = React.useCallback(() => {
      if (esRef.current) {
        try {
          esRef.current.close()
        } catch {
          /* ignore */
        }
        esRef.current = null
      }
    }, [])

    const resetWsEpisode = React.useCallback(() => {
      wsTerminalRef.current = false
      reconnectAttempt.current = 0
      setAttemptShown(0)
      setStopReason(null)
      stopFallback()
    }, [stopFallback])

    const startHeartbeat = React.useCallback(
      (ws: WebSocket) => {
        if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
        heartbeatTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(heartbeatMessage())
            } catch {
              /* 心跳发送失败，等待 onclose 触发重连 */
            }
          }
        }, heartbeatInterval)
      },
      [heartbeatInterval, heartbeatMessage],
    )

    /**
     * 兜底腿:改走既有 SSE(event-stream)通道把内容继续流完。
     * 分档口径与 useAgentSSE 2026-10-26 一致(CONNECTING=瞬态,浏览器正在原生重连;
     * CLOSED=致命,不再重连)。瞬态只容忍 MAX_FALLBACK_TRANSIENT_RECONNECTS 轮,
     * 超过即主动 close ⇒ 可见终态 —— 有界纪律两腿同规,不允许无限重连。
     */
    const openFallback = React.useCallback(() => {
      const url = fallback ? fallback.urlBuilder(token) : null
      const goFail = (reason: WebSocketStreamStopReason, key: string) => {
        wsTerminalRef.current = true
        setStatus('failed')
        setStopReason(reason)
        setError(tRef.current(key))
      }
      if (!url || typeof EventSource === 'undefined') {
        goFail('fallback-unavailable', 'fallbackUnavailable')
        return
      }
      let es: EventSource
      try {
        es = new EventSource(url)
      } catch {
        goFail('fallback-unavailable', 'fallbackUnavailable')
        return
      }
      esRef.current = es
      fallbackTransientReconnects.current = 0
      setStatus('degraded')
      setStopReason(null)
      setError(tRef.current('degradedNotice'))
      const guard = fallback?.messageGuard ?? ((d: unknown): boolean => messageGuard(d))
      es.onmessage = (event: MessageEvent<string>) => {
        const raw = event.data
        if (raw === 'pong' || raw === '"pong"') return
        try {
          const parsed = JSON.parse(raw) as unknown
          if (!guard(parsed)) return
          setLastMessage(parsed as TMessage)
        } catch {
          /* 非法 JSON 忽略 */
        }
      }
      es.onerror = () => {
        const fatal = es.readyState === EventSource.CLOSED
        if (!fatal && fallbackTransientReconnects.current < MAX_FALLBACK_TRANSIENT_RECONNECTS) {
          fallbackTransientReconnects.current += 1
          return
        }
        es.close()
        if (esRef.current === es) esRef.current = null
        goFail('fallback-failed', 'fallbackFailed')
      }
    }, [fallback, messageGuard, token])

    /** WS 重连耗尽的统一裁决(构造异常与 onclose 两条路径共用):降级或终态,二选一,绝不静默 */
    const handleExhausted = React.useCallback(() => {
      clearTimers()
      if (fallback) {
        openFallback()
        return
      }
      wsTerminalRef.current = true
      setStatus('failed')
      setStopReason('reconnect-exhausted')
      setError(tRef.current('reconnectExhausted', { max: maxReconnectAttempts }))
    }, [clearTimers, fallback, openFallback, maxReconnectAttempts])

    /** 有界重连调度:第 attempt/max 次可归因;达到上限 ⇒ handleExhausted(此前是无限重连) */
    const scheduleReconnect = React.useCallback(() => {
      if (!enabled || !token || closedByUnmount.current || wsTerminalRef.current) return
      if (reconnectAttempt.current >= maxReconnectAttempts) {
        handleExhausted()
        return
      }
      const delay = wsBackoffDelay(reconnectAttempt.current, maxReconnectDelay)
      reconnectAttempt.current += 1
      setAttemptShown(reconnectAttempt.current)
      setStatus('reconnecting')
      setError(
        tRef.current('reconnecting', {
          attempt: reconnectAttempt.current,
          max: maxReconnectAttempts,
        }),
      )
      reconnectTimer.current = setTimeout(() => connectRef.current(), delay)
    }, [enabled, token, handleExhausted, maxReconnectAttempts, maxReconnectDelay])

    const connect = React.useCallback(() => {
      // 2026-08-02 Bug #17:enabled=false 时不建立连接;终态只让位给 retry()/新 token/online
      if (!enabled || !token || closedByUnmount.current || wsTerminalRef.current) return
      if (typeof window === 'undefined') return

      let ws: WebSocket
      try {
        ws = new WebSocket(urlBuilder(token))
      } catch (e) {
        setError(e instanceof Error ? e.message : tRef.current('connectFailed'))
        // 2026-09-17:构造失败也纳入重连调度(现与 onclose 同一条有界阶梯)
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttempt.current = 0
        setAttemptShown(0)
        wsTerminalRef.current = false
        setConnected(true)
        setStatus('connected')
        setStopReason(null)
        setError(null)
        startHeartbeat(ws)
      }

      ws.onmessage = (event) => {
        const raw = event.data
        if (raw === 'pong' || raw === '"pong"') return
        try {
          const parsed = JSON.parse(raw) as unknown
          if (!messageGuard(parsed)) return
          setLastMessage(parsed)
        } catch {
          /* 非法 JSON 忽略 */
        }
      }

      ws.onclose = () => {
        setConnected(false)
        // 2026-08-21 修复(登出后旧 token 重连 bug):
        // 原缺陷:onclose 闭包捕获旧 enabled/token,closedByUnmount 在 effect 重跑时已被重置为 false,
        // 登出(token→null)时序:cleanup close ws → 新 effect 重置 closedByUnmount=false →
        // onclose 异步触发时闭包 token 仍是旧值(非空)→ 排队重连 → 用旧 token 重建 WebSocket,
        // 登出后仍接收账号推送(隐私问题)。
        // 修复:onclose 触发时校验"被关闭的 ws 是否仍是当前活跃连接"——
        // cleanup/token 变化都会把 wsRef.current 置 null 或替换为新 ws,
        // 此时旧 ws 的 onclose 不应触发重连。正常网络断开时 wsRef.current === ws,照常重连。
        if (wsRef.current !== ws) return
        clearTimers()
        // G-86:这里曾是"取消 10 次硬上限 ⇒ 无限重连"(恢复手段缺失的权宜)。
        // 现降级为有界:scheduleReconnect 数到上限即转 fallback/终态,出路见文件头注。
        scheduleReconnect()
      }

      ws.onerror = () => {
        setError(tRef.current('connectError'))
      }
    }, [enabled, token, urlBuilder, messageGuard, startHeartbeat, clearTimers, scheduleReconnect])
    connectRef.current = connect

    React.useEffect(() => {
      closedByUnmount.current = false
      // 2026-08-02 Bug #17:enabled=false 时关闭现有连接,不建立新连接
      if (!enabled) {
        clearTimers()
        resetWsEpisode()
        if (wsRef.current) {
          try {
            wsRef.current.close()
          } catch {
            /* ignore */
          }
          wsRef.current = null
        }
        setConnected(false)
        setStatus('connecting')
        setError(null)
        return
      }
      if (token) {
        // 新凭据 = 新的建连机会:demand-audit 换票链路依赖"新票写回 store 后由本 hook
        // 现取重连",终态不得把这合法的一跳也门死(计数与降级同时复位)。
        if (lastTokenRef.current !== undefined && lastTokenRef.current !== token) {
          resetWsEpisode()
          setStatus('connecting')
          setError(null)
        }
        lastTokenRef.current = token
        connect()
      } else {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
        setConnected(false)
      }

      return () => {
        closedByUnmount.current = true
        clearTimers()
        stopFallback()
        if (wsRef.current) {
          try {
            wsRef.current.close()
          } catch {
            /* ignore */
          }
          wsRef.current = null
        }
        setConnected(false)
      }
    }, [enabled, token, connect, clearTimers, resetWsEpisode, stopFallback])

    // 网络恢复/页面回前台:
    // - online = 网络路径换了 ⇒ 视同新机会,复位终态与计数后再连(重置有界窗口,不是绕开有界);
    // - visibilitychange = 只跳过剩余退避等待,不复位计数(否则"永久 404 前置"会在每次切回
    //   标签页时被再锤满一轮 5 次,归因面反而变糊);
    // - 两臂在已有活跃连接(OPEN/CONNECTING)时都不动作;终态下 visibility 臂绝不自动复活。
    React.useEffect(() => {
      const hasLiveWs = () => {
        const ws = wsRef.current
        return !!ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      }
      const onOnline = () => {
        if (!enabled || !token || closedByUnmount.current) return
        if (hasLiveWs()) return
        resetWsEpisode()
        setStatus('connecting')
        setError(null)
        clearTimers()
        connect()
      }
      const onVisibility = () => {
        if (document.visibilityState !== 'visible') return
        if (!enabled || !token || closedByUnmount.current || wsTerminalRef.current) return
        if (hasLiveWs()) return
        clearTimers()
        connect()
      }
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisibility)
      return () => {
        window.removeEventListener('online', onOnline)
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }, [enabled, token, connect, clearTimers, resetWsEpisode])

    const send = React.useCallback((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    }, [])

    const close = React.useCallback(() => {
      closedByUnmount.current = true
      clearTimers()
      stopFallback()
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          /* ignore */
        }
        wsRef.current = null
      }
      setConnected(false)
      wsTerminalRef.current = false
      setStatus('connecting')
      setStopReason(null)
      setError(null)
    }, [clearTimers, stopFallback])

    /** 终态/降级后的人为恢复出口(2026-09-17"无恢复手段"顾虑的正解):复位计数、摘兜底、重走 WS */
    const retry = React.useCallback(() => {
      if (!enabled || closedByUnmount.current) return
      resetWsEpisode()
      setStatus('connecting')
      setError(null)
      clearTimers()
      if (token) connect()
    }, [enabled, token, connect, clearTimers, resetWsEpisode])

    return {
      send,
      close,
      retry,
      isConnected,
      lastMessage,
      error,
      status,
      reconnectAttempt: attemptShown,
      maxReconnectAttempts,
      stopReason,
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
