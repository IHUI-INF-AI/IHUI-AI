/**
 * WebSocket 通知客户端(mobile-rn 端)。
 *
 * 共享 hook 在 @ihui/shared/notifications/use-notification-websocket,
 * 此处仅注入 mobile-rn 的 token 获取函数和 baseUrl。
 */
import {
  useNotificationWebSocket as useNotificationWebSocketShared,
  type UseWebSocketReturn,
} from '@ihui/shared/notifications/use-notification-websocket'
import { getToken } from '../lib/token'
import { API_BASE_URL } from '../lib/config'

export type { UseWebSocketReturn }

export function useNotificationWebSocket(token: string | null): UseWebSocketReturn {
  return useNotificationWebSocketShared(token, {
    baseUrl: API_BASE_URL,
    tokenProvider: () => getToken(),
  })
}
