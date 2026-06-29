/** WebSocket 管理器类型声明（对应 websocket.js） */

export interface WsCallbacks {
  onOpen?: () => void
  onMessage?: (message: unknown) => void
  onError?: (error: unknown) => void
  onClose?: (res: unknown) => void
}

export interface WebSocketManager {
  connect(url: string, userUuid: string, callbacks: WsCallbacks): void
  close(): void
  isConnected(): boolean
  send(message: unknown): boolean
  getReadyState(): number
}

declare const websocketManager: WebSocketManager
export default websocketManager
