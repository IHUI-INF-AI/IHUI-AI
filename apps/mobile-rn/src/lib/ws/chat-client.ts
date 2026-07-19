/**
 * 直播实时聊天 WebSocket 客户端(mobile-rn 端)
 *
 * 功能:
 * - 复用共享层 @ihui/api-client 的 WebSocketClient(框架无关,断线指数退避重连 + 心跳)
 * - 端点:GET /ws/live-chat?roomId=<id>&token=<access_token>
 * - 消息协议(与服务端约定):
 *   服务端推送 { type: 'chat', data: ChatMessage }
 *   客户端发送 { type: 'send', content: string }
 *   心跳:客户端发 'ping' / 服务端回 'pong'(沿用 WebSocketClient 默认)
 * - 历史消息:首次连接后服务端会推送 { type: 'history', data: ChatMessage[] }(可选)
 * - 系统提示:{ type: 'system', data: { content, level } }(可选)
 *
 * 使用(React 组件外,纯逻辑客户端):
 * ```ts
 * const client = new LiveChatClient({ baseUrl: API_BASE_URL, tokenProvider: () => getToken() })
 * const unsub = client.subscribe({
 *   onMessage: (msg) => setMessages((p) => [...p, msg]),
 *   onStatusChange: (status) => setStatus(status),
 * })
 * await client.connect(roomId)
 * client.send('hello')
 * // ...组件卸载
 * client.disconnect()
 * unsub()
 * ```
 */
import {
  WebSocketClient,
  type WebSocketLike,
  type WebSocketClientHandlers,
} from '@ihui/api-client'

export interface ChatMessage {
  id: string
  nickname: string
  content: string
  createdAt: string
  /** 可选:消息类型(普通 / 礼物 / 系统) */
  kind?: 'text' | 'gift' | 'system'
}

export type ChatStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error'

export interface LiveChatClientOptions {
  baseUrl: string
  tokenProvider: () => string | null
  /** 心跳间隔 ms,默认 30000 */
  heartbeatInterval?: number
  /** 最大重连延迟 ms,默认 30000 */
  maxReconnectDelay?: number
  /**
   * WebSocket 工厂(测试用 / 未来 RN 环境 WebSocket 不可用时注入)。
   * 不传时走默认 new WebSocket。
   */
  webSocketFactory?: (url: string) => WebSocketLike
}

export interface LiveChatHandlers {
  onMessage?: (msg: ChatMessage) => void
  onHistory?: (history: ChatMessage[]) => void
  onStatusChange?: (status: ChatStatus) => void
  onError?: (error: string) => void
}

function buildChatWsUrl(baseUrl: string, roomId: string, token: string): string {
  const url = new URL(baseUrl)
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({ roomId, token })
  return `${proto}//${url.host}/ws/live-chat?${params.toString()}`
}

function isChatMessage(data: unknown): data is ChatMessage {
  if (typeof data !== 'object' || data === null) return false
  const d = data as ChatMessage
  return typeof d.id === 'string' && typeof d.nickname === 'string' && typeof d.content === 'string'
}

function isChatHistory(data: unknown): data is ChatMessage[] {
  return Array.isArray(data) && data.every(isChatMessage)
}

/**
 * 直播聊天客户端。
 *
 * 跨多轮 connect/disconnect 安全:disconnect 后再次 connect 会重建底层 WebSocketClient。
 * 订阅者 unsubscribe 即可解绑,无需 disconnect。
 */
export class LiveChatClient {
  private client: WebSocketClient<unknown> | null = null
  private currentRoomId: string | null = null
  private listeners = new Set<LiveChatHandlers>()
  private status: ChatStatus = 'idle'
  private currentToken: string | null = null

  constructor(private readonly options: LiveChatClientOptions) {}

  /** 注册订阅,返回反订阅函数 */
  subscribe(handlers: LiveChatHandlers): () => void {
    this.listeners.add(handlers)
    // 立即推送当前状态,避免新订阅者等待 onStatusChange 触发
    handlers.onStatusChange?.(this.status)
    return () => {
      this.listeners.delete(handlers)
    }
  }

  getStatus(): ChatStatus {
    return this.status
  }

  private setStatus(next: ChatStatus): void {
    if (this.status === next) return
    this.status = next
    for (const l of this.listeners) l.onStatusChange?.(next)
  }

  private emitMessage(msg: ChatMessage): void {
    for (const l of this.listeners) l.onMessage?.(msg)
  }

  private emitHistory(history: ChatMessage[]): void {
    for (const l of this.listeners) l.onHistory?.(history)
  }

  private emitError(error: string): void {
    for (const l of this.listeners) l.onError?.(error)
  }

  /**
   * 连接指定房间的聊天频道。
   * 若已在同房间连接中,no-op;若切换房间,会先断开旧连接再用新房间建立。
   */
  connect(roomId: string): void {
    if (this.currentRoomId === roomId && this.client) {
      // 已连接 / 正在连接同一房间:跳过(底层 WebSocketClient 已做 readyState 检查)
      return
    }
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
    this.currentRoomId = roomId
    const token = this.options.tokenProvider()
    if (!token) {
      this.setStatus('error')
      this.emitError('未登录,无法连接聊天')
      return
    }
    this.currentToken = token
    this.setStatus('connecting')

    const handlers: WebSocketClientHandlers<unknown> = {
      onOpen: () => {
        this.setStatus('open')
      },
      onClose: () => {
        // 主动 disconnect 也会触发,此时 client 已被置 null,在 disconnect 内处理
        if (this.client) {
          this.setStatus('reconnecting')
        } else {
          this.setStatus('closed')
        }
      },
      onMessage: (msg) => {
        // 兼容服务端两种消息外壳:{type:'chat', data} 或裸 ChatMessage
        if (typeof msg === 'object' && msg !== null && 'type' in msg) {
          const wrapped = msg as { type: string; data?: unknown }
          if (wrapped.type === 'chat' && isChatMessage(wrapped.data)) {
            this.emitMessage(wrapped.data)
            return
          }
          if (wrapped.type === 'history' && isChatHistory(wrapped.data)) {
            this.emitHistory(wrapped.data)
            return
          }
        }
        if (isChatMessage(msg)) {
          this.emitMessage(msg)
        }
      },
      onError: (err) => {
        this.setStatus('error')
        this.emitError(err)
      },
    }

    this.client = new WebSocketClient<unknown>(
      {
        urlBuilder: () => buildChatWsUrl(this.options.baseUrl, roomId, this.currentToken ?? ''),
        tokenProvider: () => this.currentToken,
        // 接受所有消息,具体类型解析在 onMessage 回调中按外壳分支处理
        messageGuard: (_data: unknown): _data is unknown => true,
        heartbeatInterval: this.options.heartbeatInterval,
        maxReconnectDelay: this.options.maxReconnectDelay,
        webSocketFactory: this.options.webSocketFactory,
      },
      handlers,
    )
    this.client.connect()
  }

  /**
   * 发送聊天消息。
   * 仅当底层连接处于 OPEN 状态时真正发送,否则返回 false(调用方可保留在输入框重试)。
   */
  send(content: string): boolean {
    if (!this.client) return false
    const payload = JSON.stringify({ type: 'send', content })
    return this.client.send(payload)
  }

  /** 断开当前连接(不重连) */
  disconnect(): void {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
    this.currentRoomId = null
    this.currentToken = null
    this.setStatus('closed')
  }
}
