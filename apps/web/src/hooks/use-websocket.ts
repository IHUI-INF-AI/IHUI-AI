// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useMemo } from 'react'
import {
  useNotificationWebSocket as useNotificationWebSocketShared,
  type UseWebSocketReturn,
} from '@ihui/shared/notifications/use-notification-websocket'
import { useAuthStore } from '@/stores/auth'
import type {
  WSNotification,
  AIResponseNotification,
  AIQuestionNotification,
  AIQuestionAnsweredNotification,
  ChatMessageNotification,
} from '@ihui/types'

export type {
  WSNotification,
  AIResponseNotification,
  AIQuestionNotification,
  AIQuestionAnsweredNotification,
  ChatMessageNotification,
}
export { isAIResponse, isAIQuestion, isAIQuestionAnswered, isChatMessage } from '@ihui/types'
export type { UseWebSocketReturn }

export function useWebSocket(): UseWebSocketReturn {
  const token = useAuthStore((s) => s.token)
  const config = useMemo(
    () => ({
      baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
      tokenProvider: () => useAuthStore.getState().token,
    }),
    [],
  )
  return useNotificationWebSocketShared(token, config)
}
