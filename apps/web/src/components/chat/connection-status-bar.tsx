// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D131 对话流保真③:把已有的四态连接件 `ConnectionStatus` 挂上主对话流的输入区 chrome。
//
// 口径(用户已批):**仅异常态常驻**。
//   · 'connected' / 'connecting' 一律不渲染、不占位(反向对照用例钉住这一条 ——
//     否则"仅异常态"只是文案);
//   · 只有 reconnecting(重连中)/ disconnected(已断开)才占一行。
//
// 为什么信号住在这一份模块级 store,而不是 `stores/chat.ts`:
//   主对话流的"重连中"只有 `packages/api-client` 的 `onReconnect` 回调知道
//   (`send-message.ts` / `send-answer.ts` 各一处),而 chat store 的运行域三键
//   (`isStreaming` / `streamingAssistantId` / `aiStreamSessionId`)按 G-703 的纪律
//   只在"运行"语义里增删。把一个纯展示信号塞进运行域 = 让每一次运行结束都要
//   替它想清楚何时清账,而那正是最容易漏的一格。所以信号自持一份,并由
//   `isStreaming` 从 true→false 这一次确定性事件兜底清理(见下方 effect)。
//
// chrome 档位:复用输入区上方既有 chrome(`QueueInteractionBar` / `ContextBudgetBar`
// 同一行),不自造第三个浮层家族;容器不带自己的 padding,行级间距由 chrome 的
// `flex items-center gap` 决定(AGENTS §4 弹层内边距四档:同族同档)。

'use client'

import * as React from 'react'

import {
  ConnectionStatus,
  deriveConnectionState,
  type ConnectionState,
} from '@/components/ai/progress-sections/connection-status'

export interface ConnectionSignal {
  state: ConnectionState
  attempt: number
  totalAttempts: number
  error?: string | null
}

const IDLE: ConnectionSignal = { state: 'connecting', attempt: 0, totalAttempts: 0 }

let signal: ConnectionSignal = IDLE
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function setSignal(next: ConnectionSignal): void {
  if (
    next.state === signal.state &&
    next.attempt === signal.attempt &&
    next.totalAttempts === signal.totalAttempts &&
    (next.error ?? null) === (signal.error ?? null)
  ) {
    return
  }
  signal = next
  emit()
}

/** 由 `onReconnect` 调用:进入"重连中",带第几次尝试与总上限。 */
export function markStreamReconnecting(attempt: number, totalAttempts = 5): void {
  setSignal({ state: 'reconnecting', attempt, totalAttempts, error: null })
}

/** 由 stream 结束 / 用户主动中断调用:回到无占位态。 */
export function clearStreamConnection(): void {
  setSignal(IDLE)
}

/** 网络类错误(重连次数用尽等):落"已断开",异常态需要占位。 */
export function markStreamDisconnected(error?: string | null): void {
  setSignal({ state: 'disconnected', attempt: 0, totalAttempts: 0, error: error ?? null })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ConnectionSignal {
  return signal
}

/**
 * 读当前连接信号的唯一出口。`ConnectionStatusBar` 与 `input-status-slot` 的占位判定
 * 都经它 —— 两处各自 `useSyncExternalStore(subscribe, getSnapshot)` 就是第二份真相,
 * 漂移后的表现不是报错,是"槽位以为要显示、组件却空了"(或反过来)。
 */
export function useStreamConnectionSignal(): ConnectionSignal {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 异常态判据的唯一一份实现:组件与用例都读它,不得各写一遍。 */
export function isAbnormalConnectionState(state: ConnectionState): boolean {
  return state === 'reconnecting' || state === 'disconnected'
}

export interface ConnectionStatusBarProps {
  /** 主对话流的运行标志(chat store 的 isStreaming);true→false 触发兜底清账 */
  isStreaming: boolean
  /** 当前会话标识:缺省(null)⇒ 无从谈"连着",按 deriveConnectionState 落 disconnected */
  threadId: string | null
  className?: string
}

/**
 * ConnectionStatusBar — 输入区上方 chrome 里的连接状态位(仅异常态占位)。
 */
export function ConnectionStatusBar({
  isStreaming,
  threadId,
  className,
}: ConnectionStatusBarProps) {
  const current = useStreamConnectionSignal()

  // 运行已结束却还挂着 reconnecting ⇒ 清账(重连成功后流继续,isStreaming 仍为 true 时不动)。
  // 但 **disconnected 不在清账范围内**:它的生产者就是"流以错误结束"这一刻,
  // 若跟着 isStreaming 的 true→false 一起被抹,断开态在屏幕上根本来不及出现
  // (等于把刚接上的通路又自己关掉)。它由下一次发送开始时显式 clearStreamConnection() 归零。
  const wasStreamingRef = React.useRef(isStreaming)
  React.useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && current.state !== 'disconnected') {
      clearStreamConnection()
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, current.state])

  // 没有会话 ⇒ 这一档不是"异常",而是"根本没在连"(未打开对话 / 新会话草稿态),
  // 占位只会让人以为断了。判据必须先看有没有连接对象,再看连接状态。
  if (!threadId) return null

  // 状态推导只走既有四态件的那一份出口,不在端内重写判据。
  const shown = deriveConnectionState(
    isStreaming,
    current.attempt,
    current.state === 'disconnected' || (current.error ?? null) !== null,
    threadId,
  )
  if (!isAbnormalConnectionState(shown)) return null

  return (
    <div
      className={className}
      data-testid="connection-status-bar"
      data-connection-state={shown}
      // 仅异常态常驻:正常态在上面就 return null 了,不渲染也不占位
    >
      <ConnectionStatus
        state={shown}
        reconnectAttempt={current.attempt}
        totalAttempts={current.totalAttempts || 5}
        error={current.error}
      />
    </div>
  )
}

export default ConnectionStatusBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
