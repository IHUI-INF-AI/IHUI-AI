import { type WSNotification } from '@ihui/api-client';
export interface UseWebSocketReturn {
    /** 当前连接状态 */
    connected: boolean;
    /** 最近收到的通知(每次更新触发依赖重渲染) */
    lastMessage: WSNotification | null;
}
export interface NotificationWebSocketConfig {
    baseUrl: string;
    tokenProvider: () => string | null;
}
export declare function useNotificationWebSocket(token: string | null, config: NotificationWebSocketConfig): UseWebSocketReturn;
