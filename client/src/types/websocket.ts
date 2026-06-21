/**
 * WebSocket相关类型定义
 */

/**
 * WebSocket消息类型枚举
 */
export enum WebSocketMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  READ = 'read',
  ERROR = 'error',
  CHAT_MESSAGE = 'chat_message',
  CHAT_STREAM = 'chat_stream',
  CHAT_COMPLETE = 'chat_complete',
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket消息接口
 */
export interface WebSocketMessage {
  type: WebSocketMessageType | string
  data?: any
  id?: string
  timestamp?: number
  [key: string]: any
}
