/**
 * WebSocket 通知客户端(共享 hook,各端通用)。
 *
 * 使用共享层 @ihui/api-client 的 WebSocketClient(框架无关),
 * 此处仅做 React hook 薄包装,由各端注入自己的 token 获取函数和 baseUrl。
 *
 * 功能:
 * - 登录后自动连接 ws://host/ws/notifications?token=<access_token>
 * - 心跳:30s ping,服务端回 pong
 * - 断线重连:指数退避(1s → 2s → 4s → ... → 30s 上限)
 * - 组件卸载时关闭连接
 * - token 变化(登录/登出)自动重连
 *
 * 用法:在已登录的组件中调用
 * `const { connected, lastMessage } = useNotificationWebSocket(token, config)`
 */
import { useEffect, useRef, useState } from 'react';
import { createNotificationClient, } from '@ihui/api-client';
export function useNotificationWebSocket(token, config) {
    const [connected, setConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const clientRef = useRef(null);
    useEffect(() => {
        if (!token)
            return;
        const client = createNotificationClient({
            baseUrl: config.baseUrl,
            tokenProvider: config.tokenProvider,
        }, {
            onOpen: () => setConnected(true),
            onClose: () => setConnected(false),
            onMessage: (msg) => setLastMessage(msg),
        });
        clientRef.current = client;
        client.connect();
        return () => {
            client.disconnect();
            clientRef.current = null;
        };
    }, [token, config.baseUrl, config.tokenProvider]);
    return { connected, lastMessage };
}
//# sourceMappingURL=use-notification-websocket.js.map