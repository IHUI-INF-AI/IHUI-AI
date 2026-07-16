/**
 * 框架无关的 WebSocket 客户端(跨端共享)。
 *
 * 封装通用能力:token 注入、心跳、断线指数退避重连、消息类型守卫。
 * 不依赖任何框架(React/Vue/RN/Tauri 均可用),各端自行写薄包装层。
 *
 * 后端端点:GET /ws/notifications?token=<access_token>
 * 消息格式:{ type: 'notification', data: {...} }
 * 心跳:客户端发 'ping' 字符串,服务端回 'pong' 字符串
 */
import type { WSNotification } from '@ihui/types'

export interface WebSocketClientOptions<TMessage> {
  /** 构建 WS URL(接收当前 token) */
  urlBuilder: (token: string) => string
  /** 获取当前 access_token(返回 null 时不连接) */
  tokenProvider: () => string | null
  /** 消息类型守卫(过滤非法消息) */
  messageGuard: (data: unknown) => data is TMessage
  /** 心跳间隔(ms),默认 30000 */
  heartbeatInterval?: number
  /** 最大重连延迟(ms),默认 30000 */
  maxReconnectDelay?: number
  /** 心跳消息工厂,默认 () => 'ping' */
  heartbeatMessage?: () => string
}

export interface WebSocketClientHandlers<TMessage> {
  onMessage?: (msg: TMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: string) => void
}

/**
 * 跨端 WebSocket 客户端。
 *
 * 使用:
 * ```ts
 * const client = new WebSocketClient<WSNotification>({
 *   urlBuilder: (token) => `wss://api.example.com/ws/notifications?token=${token}`,
 *   tokenProvider: () => getToken(),
 *   messageGuard: isWSNotification,
 * }, {
 *   onMessage: (msg) => console.log('收到通知', msg),
 * })
 * client.connect()
 * ```
 */
export class WebSocketClient<TMessage = WSNotification> {
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private closedByUser = false
  private _isConnected = false

  constructor(
    private readonly options: WebSocketClientOptions<TMessage>,
    private readonly handlers: WebSocketClientHandlers<TMessage> = {},
  ) {}

  get isConnected(): boolean {
    return this._isConnected
  }

  /** 连接 WebSocket(若已连接则忽略) */
  connect(): void {
    const token = this.options.tokenProvider()
    if (!token || this.closedByUser) return
    if (typeof WebSocket === 'undefined') return
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(this.options.urlBuilder(token))
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e.message : 'WebSocket 连接失败')
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this._isConnected = true
      this.handlers.onOpen?.()
      this.startHeartbeat(ws)
    }

    // WebSocket onmessage 在 DOM(MessageEvent)和 RN(WebSocketMessageEvent)类型不同,
    // 用 any 兼容跨端(共享层代码需同时通过 web/RN/desktop/extension 的 typecheck)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ws.onmessage = (event: any) => {
      const raw = event?.data
      if (raw === 'pong' || raw === '"pong"') return
      if (typeof raw !== 'string') return
      try {
        const parsed = JSON.parse(raw) as unknown
        if (!this.options.messageGuard(parsed)) return
        this.handlers.onMessage?.(parsed)
      } catch {
        // 非 JSON 消息忽略
      }
    }

    ws.onclose = () => {
      this._isConnected = false
      this.handlers.onClose?.()
      this.clearTimers()
      if (!this.closedByUser) {
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      this.handlers.onError?.('WebSocket 连接错误')
    }
  }

  /** 主动断开(不触发重连) */
  disconnect(): void {
    this.closedByUser = true
    this.clearTimers()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    this._isConnected = false
  }

  /** 发送消息(仅当连接打开时) */
  send(data: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  /** token 刷新后重置连接(断开当前连接,用新 token 重连) */
  updateToken(): void {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    this.closedByUser = false
    this.reconnectAttempt = 0
    this.connect()
  }

  private startHeartbeat(ws: WebSocket): void {
    const interval = this.options.heartbeatInterval ?? 30000
    const heartbeatMessage = this.options.heartbeatMessage ?? (() => 'ping')
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(heartbeatMessage())
        } catch {
          // 心跳失败等 onclose 重连
        }
      }
    }, interval)
  }

  private scheduleReconnect(): void {
    const token = this.options.tokenProvider()
    if (!token) return
    const maxDelay = this.options.maxReconnectDelay ?? 30000
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, maxDelay)
    this.reconnectAttempt += 1
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

// ===================== 通知专用工厂 =====================

/** 类型守卫:判断数据是否为合法的 WSNotification 消息 */
export function isWSNotification(data: unknown): data is WSNotification {
  if (typeof data !== 'object' || data === null) return false
  const d = data as WSNotification
  return d.type === 'notification' && !!d.data
}

/**
 * 构建 WebSocket 通知客户端的 URL(与 web 端 buildWsUrl 一致)。
 * 根据当前页面协议自动选择 ws: / wss:。
 */
export function buildNotificationWsUrl(baseUrl: string, token: string): string {
  // baseUrl 形如 https://api.example.com 或 http://localhost:3000
  const url = new URL(baseUrl)
  const proto = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${url.host}/ws/notifications?token=${encodeURIComponent(token)}`
}

/**
 * 创建通知专用 WebSocket 客户端(预配置消息守卫 + 通知端点)。
 *
 * 各端只需提供 baseUrl + tokenProvider + handlers 即可:
 * ```ts
 * const client = createNotificationClient({
 *   baseUrl: 'https://api.example.com',
 *   tokenProvider: () => getToken(),
 * }, { onMessage: (msg) => ... })
 * ```
 */
export function createNotificationClient(
  config: { baseUrl: string; tokenProvider: () => string | null },
  handlers: WebSocketClientHandlers<WSNotification> = {},
  overrides: Partial<WebSocketClientOptions<WSNotification>> = {},
): WebSocketClient<WSNotification> {
  return new WebSocketClient<WSNotification>(
    {
      urlBuilder: (token) => buildNotificationWsUrl(config.baseUrl, token),
      tokenProvider: config.tokenProvider,
      messageGuard: isWSNotification,
      ...overrides,
    },
    handlers,
  )
}
