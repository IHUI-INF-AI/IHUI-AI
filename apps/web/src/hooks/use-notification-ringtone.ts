// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { useWebSocket } from '@/hooks/use-websocket'
import { useAuthStore } from '@/stores/auth'
import { isSoundNotificationEnabled } from '@ihui/shared/notifications/notification-store'
import {
  playRingtone,
  readStoredRingtoneId,
  unlockRingtoneAudio,
} from '@ihui/shared/notifications/ringtone'

/**
 * 响铃必须排除的内部帧 type(与用户可见通知无关)。
 * - ai_response / chat_message / agent.action:沿用 use-notification.ts 的 NON_NOTIFICATION_TYPES 口径
 * - ai_question / chat_question_answered:多端同步的 AI 提问弹窗帧,无可见通知文本
 *
 * 真正的 AI 流式 token 走 SSE(/api/ai/chat/stream),不经过 /ws/notifications,不会进本 hook。
 */
const NON_RINGTONE_TYPES = new Set([
  'ai_response',
  'chat_message',
  'agent.action',
  'ai_question',
  'chat_question_answered',
])

/** 帧是否为用户可见通知(type 封壳 notification 且 data.type 不在内部清单) */
function isUserVisibleFrame(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false
  const frame = message as { type?: unknown; data?: { type?: unknown } | null }
  if (frame.type !== 'notification' || !frame.data) return false
  return !NON_RINGTONE_TYPES.has(String(frame.data.type))
}

/**
 * 全局通知响铃 hook。
 *
 * 挂载点:根 GlobalHooksProvider(与 useGlobalNotification 同层,整站只挂一次,避免一声双响)。
 * 响铃条件:已登录 + 声音开关开 + 帧为用户可见通知帧。
 *
 * 口径:
 * - 不按页面可见性 / 失焦短路:后台、其他标签页照常响。
 * - 每次收到帧现读开关与选中铃声,不在挂载时固化成常量或闭包快照。
 * - 连发去抖 1200ms 由 shared ringtone.playRingtone 内部承担,本层不另造数值。
 */
export function useNotificationRingtone(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { lastMessage } = useWebSocket()

  // 浏览器自动播放策略:首次 pointerdown / keydown 解锁 AudioContext;已解锁为空操作。
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const unlock = (): void => unlockRingtoneAudio()
    document.addEventListener('pointerdown', unlock)
    document.addEventListener('keydown', unlock)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  React.useEffect(() => {
    if (!isAuthenticated) return
    // 现读开关(不看 mount 时快照):关闭后下一条帧立即静音。
    if (!isSoundNotificationEnabled()) return
    if (!isUserVisibleFrame(lastMessage)) return
    // 现读选中 id:切换铃声后下一条帧即生效,不捕获旧值。
    playRingtone(readStoredRingtoneId())
  }, [lastMessage, isAuthenticated])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
