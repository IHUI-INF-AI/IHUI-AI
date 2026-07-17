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

/**
 * WebSocket 子集接口(跨端适配)。
 *
 * 标准浏览器 `WebSocket` 与 Taro `Taro.connectSocket` 等非标准实现,
 * 只需满足此接口即可被 `WebSocketClient` 使用。
 *
 * 注意:`OPEN/CONNECTING/CLOSING/CLOSED` 在标准 `WebSocket` 上是构造器静态属性,
 * 实例上不一定存在,故设为可选;readyState 比较请使用模块级常量 `WS_OPEN` / `WS_CONNECTING`。
 */
export interface WebSocketLike {
  readonly readyState: number
  readonly OPEN?: number
  readonly CONNECTING?: number
  readonly CLOSING?: number
  readonly CLOSED?: number
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: ((err: unknown) => void) | null
  send(data: string): void
  close(): void
}

/** WebSocket readyState 数字常量(与标准 WebSocket 一致,避免直接引用全局 WebSocket) */
const WS_CONNECTING = 0
const WS_OPEN = 1

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
  /**
   * WebSocket 工厂(依赖注入点)。
   *
   * 用于非标准 WebSocket 环境(如 Taro 小程序 weapp 无全局 `WebSocket`),
   * 各端可注入适配器(如包装 `Taro.connectSocket`)。不传时走默认 `new WebSocket()`。
   */
  webSocketFactory?: (url: string) => WebSocketLike
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
  private ws: WebSocketLike | null = null
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
    // 提供了 webSocketFactory 时跳过全局 WebSocket 检查(factory 可能不依赖全局 WebSocket)
    if (!this.options.webSocketFactory && typeof WebSocket === 'undefined') return
    if (this.ws && (this.ws.readyState === WS_OPEN || this.ws.readyState === WS_CONNECTING)) {
      return
    }

    let ws: WebSocketLike
    try {
      ws = this.options.webSocketFactory
        ? this.options.webSocketFactory(this.options.urlBuilder(token))
        : (new WebSocket(this.options.urlBuilder(token)) as unknown as WebSocketLike)
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
    if (this.ws && this.ws.readyState === WS_OPEN) {
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

  private startHeartbeat(ws: WebSocketLike): void {
    const interval = this.options.heartbeatInterval ?? 30000
    const heartbeatMessage = this.options.heartbeatMessage ?? (() => 'ping')
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => {
      if (ws.readyState === WS_OPEN) {
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
