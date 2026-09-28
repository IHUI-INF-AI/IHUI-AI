// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D154(2026-09-30 立)web 端 MCP 连接状态消费面。
 *
 * 载体与 D153 同一枚拍板(V4 §11.3):`@ihui/api-client` 的 `subscribeUserBroadcast`
 * 是设备级单例 + 引用计数,**本文件不再建第二条 per-user 常连**(票面明令禁止)。
 *
 * 三条不可漂的写法:
 *  ① **状态表只由广播写入**,端内不猜测、不轮询补位。
 *     `connected` ⇒ 从表里**移除**(异常态才占对话流高度,与 D131 同一档判断);
 *     `tools` 缺席 ⇒ 按"看得见"处理(判不出不得写成"用不到",否则正是要提示的那一型被静默吞掉)。
 *  ② **同 server 同 state 至多一条**由生产面(`apps/ai-service/app/services/mcp_status.py`)
 *     去重,本端只做**覆盖式**落表:拿到更新的一帧就替换该 server 那一行,
 *     不累积历史 —— 界面要回答的是"现在这台连得上吗",不是事件日志。
 *  ③ **重连动作走 api-client**(`connectExternalServer`),端内不得自拼 fetch(§3 共享层优先);
 *     重连的**结果**由生产面再发一帧回来 —— 所以按钮点下去不本地改状态,那会造出一个假成功态。
 */
import * as React from 'react'
import { subscribeUserBroadcast, type UserBroadcastConfig } from '@ihui/api-client'
import type { McpConnectionState, McpStatusEvent } from '@ihui/types'

import { useAuthStore } from '@/stores/auth'

/** 界面上的一行(一个 server 只有一行) */
export interface McpStatusEntry {
  server: string
  state: McpConnectionState
  /** 技术性原因:诊断用,不是界面文案(界面句子一律由 state × 五语言词表产出) */
  reason?: string
  attempt?: number
  maxAttempts?: number
  tools?: string[]
  /** 收到该帧的时刻(排序与"是否已过期"的判据输入) */
  at: string
}

const entries = new Map<string, McpStatusEntry>()
/**
 * 空表快照:模块级**单例**。
 * getServerSnapshot 与初始 snapshot 必须是同一个引用 —— 否则 hydration 比较的是
 * "两个都空但不同引用"的数组,React 判快照不稳定;而"每次新建空数组"正是它最常见的错法。
 */
const EMPTY_SNAPSHOT: readonly McpStatusEntry[] = Object.freeze([] as McpStatusEntry[])
let snapshot: readonly McpStatusEntry[] = EMPTY_SNAPSHOT
const listeners = new Set<() => void>()

function publish(): void {
  // 稳定顺序:异常态优先(failed 比 connecting 更该被看到),同档按 server 名字典序。
  const rank: Record<McpConnectionState, number> = {
    failed: 0,
    reconnecting: 1,
    connecting: 2,
    connected: 3,
  }
  snapshot = Object.freeze(
    [...entries.values()].sort(
      (a, b) => rank[a.state] - rank[b.state] || a.server.localeCompare(b.server),
    ),
  )
  for (const l of listeners) l()
}

/**
 * 落一帧(导出以便单测直接喂事件,不经 WS)。
 *
 * @returns 该帧是否改变了表(`false` ⇒ 重复帧或已被移除的 connected 帧,不触发重渲染)
 */
export function applyMcpStatusEvent(evt: McpStatusEvent): boolean {
  const { server, state } = evt.data
  if (state === 'connected') {
    // 已连上 ⇒ 这一行没有存在的理由(不提示才是正确界面),整条摘掉而不是留着"connected"徽章
    if (!entries.delete(server)) return false
    publish()
    return true
  }
  const next: McpStatusEntry = {
    server,
    state,
    ...(evt.data.reason !== undefined ? { reason: evt.data.reason } : {}),
    ...(evt.data.attempt !== undefined ? { attempt: evt.data.attempt } : {}),
    ...(evt.data.maxAttempts !== undefined ? { maxAttempts: evt.data.maxAttempts } : {}),
    ...(evt.data.tools !== undefined ? { tools: evt.data.tools } : {}),
    at: new Date().toISOString(),
  }
  const prev = entries.get(server)
  if (prev && prev.state === state && prev.attempt === next.attempt && prev.at === next.at) {
    return false
  }
  entries.set(server, next)
  publish()
  return true
}

export function getMcpStatusSnapshot(): readonly McpStatusEntry[] {
  return snapshot
}

/** 订阅状态表变化(useSyncExternalStore 的 subscribe) */
export function subscribeMcpStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 清空(登出/单测隔离用;广播面不会自己清空,而登出后留着别人的 server 名是错的) */
export function clearMcpStatuses(): void {
  if (entries.size === 0) return
  entries.clear()
  publish()
}

/**
 * 订阅 `mcp:status` 并把表交给消费组件。
 *
 * 与 D153 的 `useConversationBroadcastSync` 同一条连接(hub 内引用计数),
 * 两个消费者 ⇒ 一条常连;这里 `close()` 只减计数,不会把另一家的连接摘掉。
 */
export function useMcpStatusBroadcast(): {
  statuses: readonly McpStatusEntry[]
  connected: boolean
  undetermined: number
} {
  const token = useAuthStore((s) => s.token)
  const [undetermined, setUndetermined] = React.useState(0)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    if (!token) return
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: window.location.origin,
      tokenProvider: () => useAuthStore.getState().token,
    }
    const sub = subscribeUserBroadcast(config, {
      'mcp:status': (evt) => {
        applyMcpStatusEvent(evt as McpStatusEvent)
      },
      onUndetermined: () => setUndetermined((n) => n + 1),
      onState: (s) => setConnected(s === 'open'),
    })
    return () => sub.close()
  }, [token])

  // 登出后不留别人的行(表是设备级的,身份不是)
  React.useEffect(() => {
    if (!token) clearMcpStatuses()
  }, [token])

  // getServerSnapshot 用模块级常量 EMPTY_SNAPSHOT(见上),不得在此新建数组 —— 快照引用必须跨渲染稳定。
  const statuses = React.useSyncExternalStore(
    subscribeMcpStatus,
    getMcpStatusSnapshot,
    () => EMPTY_SNAPSHOT,
  )

  return { statuses, connected, undetermined }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
