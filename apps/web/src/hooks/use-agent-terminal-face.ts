// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import {
  getAgentTerminalFace,
  listAgentTerminals,
  type AgentTerminalFace,
  type AgentTerminalInfo,
} from '@ihui/api-client'

/**
 * agent 终端屏面的轮询钩子(2026-11-21 立)。
 *
 * 为什么是轮询而不是 WS:ai-service 的这条链路**没有**推流面(它只有上行
 * `terminal-input`),而为"看屏"新建一条 WS 会多一份会话/鉴权/重连状态机。
 * 1.5s 一次的只读 GET 在"人看模型干活"这个场景里足够(屏面本身也是模型
 * 每帧 `cursor` 才用得到的精度,人眼读不出更细)。
 *
 * **`conversationId` 是会话 id,不是流会话 id**:agent 侧终端记账用的是 `metadata.conversationId`,
 * 传 `aiStreamSessionId`(每次流随机生成)会永远拿到空列表 —— 这里刻意用 `s.conversationId`。
 *
 * 三条硬纪律:
 * - **不并发**:上一次没回来就不再发(慢网下叠加请求只会更慢,还会把"卡"放大成雪崩)。
 * - **页面不可见就停**:后台标签页轮询纯属烧服务端 CPU(且 `visibilitychange` 已经够用)。
 * - **失败不静默**:`error` 如实外露,由面板显示;不把失败画成"没有终端"。
 */

const LIST_INTERVAL_MS = 5_000
const FACE_INTERVAL_MS = 1_500

export interface AgentTerminalFaceState {
  terminals: AgentTerminalInfo[]
  activeId: string | null
  face: AgentTerminalFace | null
  loading: boolean
  /** 人可读的失败原因(已含 HTTP 状态/服务端 error);null = 没失败 */
  error: string | null
  /** 手动刷新(立即取一次列表 + 屏面,重置轮询计时) */
  refresh: () => void
  /** 切换要看哪一块终端 */
  select: (terminalId: string) => void
}

export function useAgentTerminalFace(
  conversationId: string | null,
  enabled: boolean,
): AgentTerminalFaceState {
  const [terminals, setTerminals] = React.useState<AgentTerminalInfo[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [face, setFace] = React.useState<AgentTerminalFace | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  const refresh = React.useCallback(() => setTick((n) => n + 1), [])

  // 列表:进入视图/手动刷新时取一次,之后按间隔兜底(新开的终端不必等用户重开面板)
  React.useEffect(() => {
    if (!enabled || !conversationId) {
      setTerminals([])
      setActiveId(null)
      setFace(null)
      setError(null)
      return
    }
    let cancelled = false
    let inFlight = false
    const run = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const rows = await listAgentTerminals(conversationId)
        if (cancelled) return
        setTerminals(rows)
        setError(null)
        setActiveId((prev) => {
          if (prev && rows.some((r) => r.terminal_id === prev)) return prev
          return rows[0]?.terminal_id ?? null
        })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        inFlight = false
      }
    }
    void run()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, LIST_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled, conversationId, tick])

  // 屏面:只轮询**当前选中**那一块,失败即停在这一块上并如实报
  React.useEffect(() => {
    if (!enabled || !conversationId || !activeId) {
      setFace(null)
      return
    }
    let cancelled = false
    let inFlight = false
    const ctrlRef: { current: AbortController | null } = { current: null }
    const run = async () => {
      if (inFlight) return
      inFlight = true
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      try {
        setLoading(true)
        const res = await getAgentTerminalFace(conversationId, activeId, { signal: ctrl.signal })
        if (cancelled) return
        if (res.ok) {
          setFace(res.face)
          setError(null)
          return
        }
        // 这块没了(被关/被回收)⇒ 屏面清空,交给列表轮询重新选一块
        setFace(null)
        if (res.notFound) {
          setActiveId(null)
          setError(null)
        } else {
          setError(res.error)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
        inFlight = false
      }
    }
    void run()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, FACE_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      ctrlRef.current?.abort()
    }
  }, [enabled, conversationId, activeId, tick])

  const select = React.useCallback((terminalId: string) => {
    setActiveId(terminalId)
    setFace(null)
    setError(null)
  }, [])

  return { terminals, activeId, face, loading, error, refresh, select }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
