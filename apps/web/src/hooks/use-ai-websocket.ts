'use client'

import * as React from 'react'

import { createWebSocketHook, type WebSocketHookResult } from '@/hooks/create-websocket-hook'

export type AIWSProvider = 'qwen' | 'zhipu' | 'deepseek' | 'doubao' | 'generic'

const PROVIDER_PATHS: Record<AIWSProvider, string> = {
  qwen: '/cozeZhsApi/ws/qwen/stream',
  zhipu: '/cozeZhsApi/ws/zhipu/stream',
  deepseek: '/cozeZhsApi/ws/chatdeepseek/stream',
  doubao: '/cozeZhsApi/ws/doubao/streamDou',
  generic: '/api/v1/ai/capabilities/ws/stream',
}

export interface AIWSMessage {
  type: string
  data?: unknown
  [key: string]: unknown
}

export interface UseAIWebSocketReturn {
  send: (data: unknown) => void
  close: () => void
  isConnected: boolean
  lastMessage: AIWSMessage | null
  error: Event | null
}

/** 类型守卫:判断解析后的对象是否符合 AIWSMessage 结构 */
function isAIWSMessage(v: unknown): v is AIWSMessage {
  if (typeof v !== 'object' || v === null) return false
  const t = (v as { type?: unknown }).type
  return typeof t === 'string'
}

/** 消息守卫:符合 AIWSMessage 结构且非 pong 心跳响应 */
function aiMessageGuard(v: unknown): v is AIWSMessage {
  return isAIWSMessage(v) && (v as AIWSMessage).type !== 'pong'
}

function buildWsUrl(provider: AIWSProvider, token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = PROVIDER_PATHS[provider]
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`
}

/**
 * 工厂创建的多个 provider 专属 Hook(qwen/zhipu/deepseek/doubao/generic)。
 * 每个 Hook 独立配置 URL 与消息守卫,内部复用统一的心跳/重连/类型守卫逻辑。
 */
const useQwenWS = createWebSocketHook<AIWSMessage>({
  urlBuilder: (token) => buildWsUrl('qwen', token),
  messageGuard: aiMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

const useZhipuWS = createWebSocketHook<AIWSMessage>({
  urlBuilder: (token) => buildWsUrl('zhipu', token),
  messageGuard: aiMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

const useDeepseekWS = createWebSocketHook<AIWSMessage>({
  urlBuilder: (token) => buildWsUrl('deepseek', token),
  messageGuard: aiMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

const useDoubaoWS = createWebSocketHook<AIWSMessage>({
  urlBuilder: (token) => buildWsUrl('doubao', token),
  messageGuard: aiMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

const useGenericWS = createWebSocketHook<AIWSMessage>({
  urlBuilder: (token) => buildWsUrl('generic', token),
  messageGuard: aiMessageGuard,
  heartbeatMessage: () => JSON.stringify({ type: 'ping' }),
})

const PROVIDER_HOOKS: Record<AIWSProvider, () => WebSocketHookResult<AIWSMessage>> = {
  qwen: useQwenWS,
  zhipu: useZhipuWS,
  deepseek: useDeepseekWS,
  doubao: useDoubaoWS,
  generic: useGenericWS,
}

/**
 * AI 厂商 WebSocket 客户端。
 *
 * 功能:
 * - 根据 provider 连接对应 WS 端点(qwen/zhipu/deepseek/doubao/generic)
 * - 自动附加 JWT token
 * - 心跳:30s 一次 {type:'ping'}
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 消息类型守卫:仅符合 AIWSMessage 结构且非 pong 的消息才会被推送
 *
 * 用法:
 *   const { send, isConnected, lastMessage } = useAIWebSocket('qwen')
 */
export function useAIWebSocket(provider: AIWSProvider): UseAIWebSocketReturn {
  // provider 变化时切换到对应工厂 Hook(urlBuilder 引用变化 → 自动重连新端点)
  const useProviderWS = React.useMemo(() => PROVIDER_HOOKS[provider], [provider])
  const ws = useProviderWS()

  const send = React.useCallback(
    (data: unknown) => {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data))
    },
    [ws.send],
  )

  // 向后兼容:工厂 error 为 string | null,映射为 Event | null
  const error = React.useMemo<Event | null>(
    () => (ws.error ? (typeof Event !== 'undefined' ? new Event('error') : null) : null),
    [ws.error],
  )

  return {
    send,
    close: ws.close,
    isConnected: ws.isConnected,
    lastMessage: ws.lastMessage,
    error,
  }
}

// ===================== AI 业务方法扩展(8 方法 + 4 消息类型 + 7 参数变体) =====================
// 从独立文件 re-export,保持单文件 < 400 行(迁移自旧项目 aiWebSocketMixin.js)

export {
  useAiWebSocket,
  type AiModelKey,
  type AgentContentListItem,
  type WebSocketAiMessage,
  type WebSocketSendParam,
  type UseAiWebSocketOptions,
  type UseAiWebSocketReturn,
} from '@/hooks/use-ai-ws-business'
