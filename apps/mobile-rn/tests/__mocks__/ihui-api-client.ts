// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Stub for @ihui/api-client - vitest mock
// Real package has "main": "./src/index.ts" with transitive deps on @ihui/types/@ihui/shared
// containing `typeof` type syntax that esbuild can't parse.
export function getPlazaList(_opts?: unknown) {
  return Promise.resolve({ success: true, data: { list: [], total: 0 } })
}
export function getAgentCategories(_opts?: unknown) {
  return Promise.resolve({ success: true, data: { agentCategory: [] } })
}
export function listConversations(_opts?: unknown) {
  return Promise.resolve({ success: true, data: { conversations: [] } })
}
export function deleteConversation(_id: string) {
  return Promise.resolve({ success: true })
}
export type AgentCategoryItem = { id: string; name: string }
export type ConversationDetail = Record<string, unknown>

/** WebSocket 通知推送消息类型 */
export interface WSNotification {
  type: 'notification'
  data: {
    type: string
    [key: string]: unknown
  }
}

/** Minimal WebSocketLike interface for chat-client tests */
export interface WebSocketLike {
  readyState: number
  url: string
  sent?: string[]
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: ((err: unknown) => void) | null
  send(data: string): void
  close(): void
}

export class WebSocketClient<T> {
  private _urlBuilder: () => string
  private _tokenProvider: () => string | null
  private _webSocketFactory: ((url: string) => WebSocketLike) | undefined
  private _ws: WebSocketLike | null = null
  private _handlers: {
    onOpen?: () => void
    onMessage?: (data: T) => void
    onClose?: () => void
    onError?: (e: unknown) => void
    onHistory?: (data: unknown) => void
  } | null = null
  private _status: string = 'idle'
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _disconnected: boolean = false

  constructor(
    opts: {
      urlBuilder: () => string
      tokenProvider: () => string | null
      webSocketFactory?: (url: string) => WebSocketLike
      maxReconnectDelay?: number
    },
    handlers: {
      onOpen?: () => void
      onMessage?: (data: T) => void
      onClose?: () => void
      onError?: (e: unknown) => void
    },
  ) {
    this._urlBuilder = opts.urlBuilder
    this._tokenProvider = opts.tokenProvider
    this._webSocketFactory = opts.webSocketFactory
    this._handlers = handlers
    this._disconnected = false
  }

  get status() {
    return this._status
  }

  connect(): void {
    const token = this._tokenProvider()
    if (!token) {
      this._status = 'error'
      this._handlers?.onError?.('no token')
      return
    }
    const ws = this._webSocketFactory?.(this._urlBuilder())
    if (!ws) return
    this._ws = ws
    this._status = 'connecting'
    ws.onopen = () => {
      this._status = 'open'
      this._handlers?.onOpen?.()
    }
    ws.onmessage = (e) => {
      try {
        this._handlers?.onMessage?.(JSON.parse(e.data as string) as T)
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      // Only auto-reconnect if not explicitly disconnected
      if (!this._disconnected) {
        this._status = 'reconnecting'
        this._handlers?.onClose?.()
        this._scheduleReconnect()
      } else {
        this._status = 'closed'
        this._handlers?.onClose?.()
      }
    }
    ws.onerror = (e) => {
      this._status = 'error'
      this._handlers?.onError?.(e)
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer)
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (!this._disconnected && this._status !== 'closed') {
        this._ws = null
        this.connect()
      }
    }, 1000) // initial reconnect delay
  }

  send(payload: string): boolean {
    if (this._ws && this._ws.readyState === 1) {
      this._ws.send(payload)
      return true
    }
    return false
  }

  disconnect(): void {
    this._disconnected = true
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._ws?.close()
    this._ws = null
    this._status = 'closed'
  }
}

export type WebSocketClientHandlers<T> = {
  onOpen?: () => void
  onMessage?: (data: T) => void
  onClose?: () => void
  onError?: (e: unknown) => void
}

/** createNotificationClient stub for useNotificationWebSocket tests */
export function createNotificationClient(
  _config: unknown,
  callbacks: {
    onOpen?: () => void
    onClose?: () => void
    onMessage?: (data: unknown) => void
  },
) {
  return {
    connect: () => {
      callbacks.onOpen?.()
    },
    disconnect: () => {
      callbacks.onClose?.()
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
