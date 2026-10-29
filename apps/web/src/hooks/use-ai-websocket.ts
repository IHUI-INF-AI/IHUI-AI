// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import {
  createWebSocketHook,
  type WebSocketHookResult,
  type WebSocketStreamStatus,
  type WebSocketStreamStopReason,
} from '@/hooks/create-websocket-hook'
import { buildWsUrl as buildWs } from '@/lib/ws-url'

export type AIWSProvider = 'qwen' | 'zhipu' | 'deepseek' | 'doubao' | 'generic'

export const PROVIDER_PATHS: Record<AIWSProvider, string> = {
  qwen: '/cozeZhsApi/ws/qwen/stream',
  zhipu: '/cozeZhsApi/ws/zhipu/stream',
  deepseek: '/cozeZhsApi/ws/chatdeepseek/stream',
  doubao: '/cozeZhsApi/ws/doubao/streamDou',
  generic: '/v1/ai/capabilities/ws/stream',
}

interface AIWSMessage {
  type: string
  data?: unknown
  [key: string]: unknown
}

interface UseAIWebSocketReturn {
  send: (data: unknown) => void
  close: () => void
  isConnected: boolean
  lastMessage: AIWSMessage | null
  error: Event | null
  /**
   * G-86(2026-10-29):工厂已算出的连接状态机原样透出,不再只给一个无 message 的 Event。
   * 'failed' = 有界重连耗尽后的可见终态(此前这里只映射成 Event('error'),UI 无法区分
   * "正在重连"与"已放弃",即票面所述"握手失败后静默"的可归因缺口)。
   */
  status: WebSocketStreamStatus
  /** 仅 status='failed' 时有值:放弃原因可归因(reconnect-exhausted/fallback-unavailable/fallback-failed) */
  stopReason: WebSocketStreamStopReason | null
  /** 人读错误文案(i18n 已译文案),null=无异常;与 error:Event 并存,后者仅保留向后兼容 */
  errorMessage: string | null
  /** 已消耗的重连次数(第 attempt/max 次) */
  reconnectAttempt: number
  maxReconnectAttempts: number
  /** 失败终态后的人为恢复出口(复位计数并重走 WS 阶梯) */
  retry: () => void
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
  // WS 源统一由 @/lib/ws-url 解析:桌面端指向线上(或显式 NEXT_PUBLIC_WS_BASE_URL),浏览器保持同源
  return buildWs(PROVIDER_PATHS[provider], token)
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
 *   const { send, isConnected, lastMessage } = useAiWebSocket() // '@/hooks/use-ai-ws-business'
 *
 * 2026-08-02 修复 Bug #17:重构为始终挂载 5 个 provider hook(符合 Rules of Hooks),
 * 按 provider 选择 active hook,其他 hook enabled=false 不建立连接。
 * 之前用 `React.useMemo(() => PROVIDER_HOOKS[provider], [provider]) + useProviderWS()`
 * 是 React 反模式 — provider 切换时 useMemo 返回新函数引用,React 会把它当成同一
 * hook 位置重新执行,导致旧 provider 的 state 丢失/残留(provider 切换场景下
 * lastMessage/isConnected 会闪烁错乱)。
 */
export function useAIWebSocket(provider: AIWSProvider): UseAIWebSocketReturn {
  // 始终挂载 5 个 hook(符合 Rules of Hooks),只有 active provider 的 hook enabled=true
  const qwenWS = useQwenWS(provider === 'qwen')
  const zhipuWS = useZhipuWS(provider === 'zhipu')
  const deepseekWS = useDeepseekWS(provider === 'deepseek')
  const doubaoWS = useDoubaoWS(provider === 'doubao')
  const genericWS = useGenericWS(provider === 'generic')

  // 按 provider 选择 active hook 的结果
  const ws = React.useMemo<WebSocketHookResult<AIWSMessage>>(
    () =>
      ({
        qwen: qwenWS,
        zhipu: zhipuWS,
        deepseek: deepseekWS,
        doubao: doubaoWS,
        generic: genericWS,
      })[provider],
    [provider, qwenWS, zhipuWS, deepseekWS, doubaoWS, genericWS],
  )

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
    // G-86:失败终态可见、可归因(不复用 error:Event —— 它没有 message,UI 读不出原因)
    status: ws.status,
    stopReason: ws.stopReason,
    errorMessage: ws.error,
    reconnectAttempt: ws.reconnectAttempt,
    maxReconnectAttempts: ws.maxReconnectAttempts,
    retry: ws.retry,
  }
}

// ===================== AI 业务方法扩展(8 方法 + 4 消息类型 + 7 参数变体) =====================
// 从独立文件 re-export,保持单文件 < 400 行(等价自旧项目 aiWebSocketMixin.js)

export {
  useAiWebSocket,
  type AiModelKey,
  type AgentContentListItem,
  type WebSocketAiMessage,
  type WebSocketSendParam,
  type UseAiWebSocketOptions,
  type UseAiWebSocketReturn,
} from '@/hooks/use-ai-ws-business'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
