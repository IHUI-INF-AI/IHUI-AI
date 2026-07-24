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
} from '@ihui/types'

export type {
  WSNotification,
  AIResponseNotification,
  AIQuestionNotification,
  AIQuestionAnsweredNotification,
}
export { isAIResponse, isAIQuestion, isAIQuestionAnswered } from '@ihui/types'
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
