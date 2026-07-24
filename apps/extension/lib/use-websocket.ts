/**
 * WebSocket 通知客户端(extension 端,popup/sidepanel 共享)。
 *
 * 共享 hook 在 @ihui/shared/notifications/use-notification-websocket,
 * 此处仅注入 extension 的 token 获取函数和 baseUrl。
 *
 * MV3 注意:background service worker 会被休眠,长连接 WS 不可靠。
 * 此 hook 应在 sidepanel/popup 页面内使用(页面存活期间 WS 有效)。
 * background 如需通知,用 chrome.alarms 轮询 getUnreadCount HTTP API 兜底。
 */
import {
  useNotificationWebSocket as useNotificationWebSocketShared,
  type UseWebSocketReturn,
} from '@ihui/shared/notifications/use-notification-websocket'
import { getToken } from './token'
import { getApiBaseUrl } from './config'

export type { UseWebSocketReturn }

export function useNotificationWebSocket(token: string | null): UseWebSocketReturn {
  return useNotificationWebSocketShared(token, {
    baseUrl: getApiBaseUrl(),
    tokenProvider: () => getToken(),
  })
}
