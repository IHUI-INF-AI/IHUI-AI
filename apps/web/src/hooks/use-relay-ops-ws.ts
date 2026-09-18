// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { createWebSocketHook } from '@/hooks/create-websocket-hook'
import { buildWsUrl } from '@/lib/ws-url'

/**
 * 运营面板 WS 实时快照(2026-09-18,#58 运营面板 WS 实时化)。
 *
 * 订阅 /ws/relay/ops(仅管理员可连),接收 { event:'relay-ops-snapshot', data } 帧。
 * data 形状与 REST 响应逐字段一致(relay-ops-snapshot.ts 契约),各运营页收到后
 * 直接 queryClient.setQueryData 热替换,WS 断连时页面自动回落 30s 轮询。
 */

export interface RelayOpsChannelMember {
  memberId: string
  keyPoolId: string
  weight: number
  keyPoolName: string | null
  keyPoolProviderCode: string | null
  circuitState: string
  failureCount: number
  lastFailureAt: string | null
  recentCallsCount: number
  avgLatencyMs: number | null
  createdAt: string | null
}

export interface RelayOpsGroupStat {
  group: {
    id: string
    name: string
    loadBalanceStrategy: string
    priority: number
    enabled: boolean
  }
  memberCount: number
  circuitSummary: { closed: number; open: number; halfOpen: number }
  totalRecentCalls: number
  members: RelayOpsChannelMember[]
}

export interface RelayOpsSnapshot {
  ts: string
  alerts: {
    rules: Array<Record<string, unknown>>
    events: Array<Record<string, unknown>>
  }
  channels: {
    groups: Array<Record<string, unknown>>
    stats: Array<RelayOpsGroupStat | null>
  }
  usage: {
    overview: Record<string, unknown> | null
  }
}

interface RelayOpsMessage {
  event: 'relay-ops-snapshot'
  data: RelayOpsSnapshot
}

function relayOpsMessageGuard(v: unknown): v is RelayOpsMessage {
  if (typeof v !== 'object' || v === null) return false
  const o = v as { event?: unknown; data?: unknown }
  if (o.event !== 'relay-ops-snapshot') return false
  if (typeof o.data !== 'object' || o.data === null) return false
  const d = o.data as { ts?: unknown; alerts?: unknown; channels?: unknown; usage?: unknown }
  return typeof d.ts === 'string' && !!d.alerts && !!d.channels && !!d.usage
}

function buildRelayOpsWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  return buildWsUrl('/ws/relay/ops', token)
}

const useRelayOpsWS = createWebSocketHook<RelayOpsMessage>({
  urlBuilder: buildRelayOpsWsUrl,
  messageGuard: relayOpsMessageGuard,
})

export interface UseRelayOpsWsResult {
  /** WS 是否在线;false 时页面应回落 REST 轮询(refetchInterval) */
  realtimeConnected: boolean
  /** 最近一帧快照(形状与 REST 响应一致,可直接 setQueryData) */
  snapshot: RelayOpsSnapshot | null
  /** 手动触发服务端立即推一帧(替代 REST 手动刷新按钮的 WS 路径) */
  refresh: () => void
}

export function useRelayOpsWs(enabled = true): UseRelayOpsWsResult {
  const ws = useRelayOpsWS(enabled)
  const sendRef = React.useRef(ws.send)
  sendRef.current = ws.send
  const refresh = React.useCallback(() => {
    try {
      sendRef.current(JSON.stringify({ type: 'refresh' }))
    } catch {
      /* 连接不可用时静默,页面回落轮询 */
    }
  }, [])
  return {
    realtimeConnected: ws.isConnected,
    snapshot: ws.lastMessage ? ws.lastMessage.data : null,
    refresh,
  }
}
