'use client'

import * as React from 'react'
import { WifiOff, RotateCw, SignalHigh, SignalMedium } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * Phase 16: SSE 连接状态指示器(2026-07-28 立)
 *
 * 设计目标(对标 Trae Work 极致体验):
 * - 4 状态可视化:connected(已连接) / connecting(连接中) / reconnecting(重连中) / disconnected(已断开)
 * - 图标 + 颜色 + 动画三重编码,一目了然
 * - hover 态:展示详细 tooltip(连接状态 + 详细信息)
 * - 紧凑尺寸(h-4 容器),与 popover header 风格统一
 * - a11y:role=status + aria-live + aria-label
 *
 * Props:
 * - state: 连接状态
 * - reconnectAttempt: 当前重连尝试次数(0=未重连,>0=正在重连第 N 次)
 * - totalAttempts: 最大重试次数(默认 5)
 * - error: 连接错误信息(显示在 tooltip)
 */
export type ConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected'

interface ConnectionStatusProps {
  state: ConnectionState
  /** 当前重连尝试次数(0=未重连,>0=正在重连第 N 次) */
  reconnectAttempt?: number
  /** 最大重试次数(默认 5) */
  totalAttempts?: number
  /** 错误信息(显示在 tooltip) */
  error?: string | null
  /** 自定义 className */
  className?: string
}

const STATE_ICON: Record<ConnectionState, React.ComponentType<{ className?: string }>> = {
  connected: SignalHigh,
  connecting: SignalMedium,
  reconnecting: RotateCw,
  disconnected: WifiOff,
}

const STATE_CLS: Record<ConnectionState, string> = {
  connected: 'text-emerald-500',
  connecting: 'text-amber-500',
  reconnecting: 'text-amber-500',
  disconnected: 'text-red-500',
}

const STATE_ANIM: Record<ConnectionState, string> = {
  connected: 'animate-connection-connected',
  connecting: 'animate-connection-connecting',
  reconnecting: 'animate-spin',
  disconnected: '',
}

const STATE_LABEL_KEY: Record<ConnectionState, string> = {
  connected: 'sseStatus.connected',
  connecting: 'sseStatus.connecting',
  reconnecting: 'sseStatus.reconnecting',
  disconnected: 'sseStatus.disconnected',
}

/**
 * ConnectionStatus — Phase 16 SSE 连接状态指示器
 *
 * 使用示例:
 * ```tsx
 * <ConnectionStatus
 *   state="reconnecting"
 *   reconnectAttempt={2}
 *   totalAttempts={5}
 * />
 * ```
 */
export const ConnectionStatus = React.memo(function ConnectionStatus({
  state,
  reconnectAttempt = 0,
  totalAttempts = 5,
  error = null,
  className,
}: ConnectionStatusProps) {
  const t = useTranslations('ai.pane')
  const Icon = STATE_ICON[state]
  const label = t(STATE_LABEL_KEY[state])

  // tooltip 内容
  const tooltipParts: string[] = [label]
  if (state === 'reconnecting' && reconnectAttempt > 0) {
    tooltipParts.push(`(${reconnectAttempt}/${totalAttempts})`)
  }
  if (error) {
    tooltipParts.push(`· ${error}`)
  }
  const tooltip = tooltipParts.join(' ')

  // 重连中:详细文字格式
  const showTextLabel = state === 'reconnecting' || state === 'disconnected'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm transition-colors',
        showTextLabel ? 'px-1' : '',
        className,
      )}
      role="status"
      aria-live={state === 'disconnected' ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-label={tooltip}
      title={tooltip}
      data-testid={`connection-status-${state}`}
      data-state={state}
    >
      {/* 状态点 + 图标 */}
      <span className="relative inline-flex items-center justify-center">
        {/* 状态点(背景灯) */}
        <span
          className={cn(
            'absolute inset-0 m-auto h-1.5 w-1.5 rounded-full',
            state === 'connected' && 'bg-emerald-500',
            state === 'connecting' && 'bg-amber-500',
            state === 'reconnecting' && 'bg-amber-500',
            state === 'disconnected' && 'bg-red-500',
            STATE_ANIM[state],
          )}
        />
        {/* 图标(在点的上层) */}
        <Icon
          className={cn(
            'relative h-3 w-3 shrink-0',
            STATE_CLS[state],
            state === 'reconnecting' && 'animate-spin',
          )}
        />
      </span>
      {/* 文字标签(仅在重连中/已断开时显示) */}
      {showTextLabel && (
        <span
          className={cn(
            'shrink-0 text-[10px] tabular-nums',
            state === 'reconnecting' && 'text-amber-500',
            state === 'disconnected' && 'text-red-500',
          )}
        >
          {state === 'reconnecting'
            ? t('sseStatus.reconnectingShort', { n: reconnectAttempt, max: totalAttempts })
            : t('sseStatus.disconnectedShort')}
        </span>
      )}
    </span>
  )
})

/**
 * ConnectionStatusDot — 简化版:仅显示一个状态点(不带文字)
 * 适用于空间极其有限的场景(如 trigger 按钮)
 */
export const ConnectionStatusDot = React.memo(function ConnectionStatusDot({
  state,
  className,
}: {
  state: ConnectionState
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        state === 'connected' && 'bg-emerald-500 animate-connection-connected',
        state === 'connecting' && 'bg-amber-500 animate-connection-connecting',
        state === 'reconnecting' && 'bg-amber-500 animate-connection-reconnecting',
        state === 'disconnected' && 'bg-red-500',
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid={`connection-dot-${state}`}
    />
  )
})

/**
 * deriveConnectionState — 从 useAgentStream 状态推导 ConnectionState
 *
 * 推导规则:
 * - isStreaming=true && reconnectAttempt=0 → connected
 * - isStreaming=true && reconnectAttempt>0 → reconnecting
 * - isStreaming=false && reconnectAttempt>0 → reconnecting
 * - isStreaming=false && reconnectAttempt=0 && error → disconnected
 * - isStreaming=false && reconnectAttempt=0 && !error → disconnected(待命)
 * - threadId 有但尚未开始流 → connecting
 */
export function deriveConnectionState(
  isStreaming: boolean,
  reconnectAttempt: number,
  hasError: boolean,
  threadId: string | null,
): ConnectionState {
  if (!threadId) return 'disconnected'
  if (reconnectAttempt > 0) return 'reconnecting'
  if (isStreaming) return 'connected'
  if (hasError) return 'disconnected'
  return 'connecting'
}

export default ConnectionStatus
