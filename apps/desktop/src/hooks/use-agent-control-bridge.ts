/**
 * Agent Control Bridge React hook(desktop 端,2026-07-22 立)
 *
 * 在应用启动时调用,封装:
 *  - initAgentControlBridge(token):上报能力 + 60s 续期 + token 重试
 *  - useNotificationWebSocket(token):监听 WS agent.action 消息
 *  - 收到 agent.action → handleAgentAction → POST /result 回传
 *
 * 用法:在已登录根组件中 `useAgentControlBridge(token)`
 */
import { useEffect } from 'react'
import type { WSNotification } from '@ihui/api-client'
import type { AgentActionRequest } from '@ihui/types'
import { handleAgentAction, initAgentControlBridge } from '../lib/agent-control-bridge'
import { useNotificationWebSocket } from './use-websocket'

export interface UseAgentControlBridgeReturn {
  /** WebSocket 连接状态(与 useNotificationWebSocket 一致) */
  connected: boolean
  /** 最近收到的 WS 通知(供调用方消费,避免重复建连) */
  lastMessage: WSNotification | null
}

export function useAgentControlBridge(token: string | null): UseAgentControlBridgeReturn {
  const { connected, lastMessage } = useNotificationWebSocket(token)

  useEffect(() => {
    return initAgentControlBridge(token ?? '')
  }, [token])

  useEffect(() => {
    if (!lastMessage) return
    const data = lastMessage.data
    if (!data || data.type !== 'agent.action') return
    const req = data.request as AgentActionRequest | undefined
    if (!req) return
    void handleAgentAction(req)
  }, [lastMessage])

  return { connected, lastMessage }
}
