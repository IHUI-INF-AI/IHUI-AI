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

/**
 * `branchConversation` 的替身 —— 与真实出口 `packages/api-client/src/endpoints/chat.ts`
 * 逐字对齐的那一层只有两件事:URL 形状(`POST /api/chat/conversations/:id/branch`,
 * id 走 encodeURIComponent)与信封语义(`{ code, message, data }`,`code === 0` 才算成功)。
 *
 * 刻意**不**写成"恒返回成功"的常量桩:接线用例断言的是"真调用发生了、请求体带 messageId、
 * 返回信封里 id 是字符串",所以这里必须真的过 fetch。成功/失败两种结果由用例自己 stub 的
 * 全局 fetch 决定,替身不参与编造 —— 否则测的就只是替身。
 */
export interface BranchConversationResult {
  conversation: {
    id: string
    userId?: string
    title?: string
    model?: string
    createdAt?: string
    updatedAt?: string
    [key: string]: unknown
  }
}

/** 与 `@ihui/types` 的 ApiResult 同形(此处内联,避免 mock 依赖真实类型包)。 */
export type BranchConversationApiResult =
  | { success: true; data: BranchConversationResult; error?: undefined; status?: number }
  | { success: false; error: string; status?: number; errorCode?: string }

export async function branchConversation(
  conversationId: string,
  messageId: string,
  _options?: { title?: string; model?: string },
): Promise<BranchConversationApiResult> {
  const base = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8802'
  const url = `${base}/api/chat/conversations/${encodeURIComponent(conversationId)}/branch`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  })
  const json = (await res.json()) as { code?: number; message?: string; data?: unknown }
  if (!res.ok || json.code !== 0 || !json.data) {
    return {
      success: false,
      error: typeof json.message === 'string' ? json.message : `HTTP ${res.status}`,
      status: res.status,
    }
  }
  return { success: true, data: json.data as BranchConversationResult, status: res.status }
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
