import Taro from '@tarojs/taro'

export interface WsCallbacks {
  onMessage?: (data: unknown) => void
  onError?: (err: unknown) => void
  onOpen?: () => void
  onClose?: (res: Taro.SocketTask.OnCloseCallbackResult) => void
}

interface WsMessage {
  event: string
  [key: string]: unknown
}

class WebSocketManager {
  private ws: Taro.SocketTask | null = null
  private url: string | null = null
  private userUuid: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatInterval = 30000
  private isManualClose = false
  private callbacks: WsCallbacks = {}

  connect(url: string, userUuid: string, callbacks: WsCallbacks = {}): void {
    if (!url || !userUuid) {
      console.error('[websocket] 连接失败：缺少必要参数')
      return
    }
    this.url = url
    this.userUuid = userUuid
    this.isManualClose = false
    this.reconnectAttempts = 0
    this.callbacks = callbacks
    this.doConnect()
  }

  private doConnect(): void {
    if (this.ws && this.ws.readyState === 1) return

    Taro.connectSocket({ url: this.url as string })
      .then((task) => {
        this.ws = task
        task.onOpen(() => {
          this.reconnectAttempts = 0
          this.sendJoinSystemRoom()
          this.startHeartbeat()
          this.callbacks.onOpen?.()
        })
        task.onMessage((res) => this.handleMessage(res))
        task.onError((err) => this.handleError(err))
        task.onClose((res) => this.handleClose(res))
      })
      .catch((err) => this.handleError(err))
  }

  private handleMessage(res: { data: string | unknown }): void {
    try {
      let data: unknown = res.data
      if (typeof data === 'string') {
        data = JSON.parse(data) as WsMessage
      }
      const msg = data as WsMessage
      if (msg?.event === 'pong') return
      this.callbacks.onMessage?.(data)
    } catch (e) {
      console.error('[websocket] 消息解析失败', e)
    }
  }

  sendJoinSystemRoom(): void {
    if (!this.ws || this.ws.readyState !== 1 || !this.userUuid) return
    this.send({ event: 'join_system_room', user_uuid: this.userUuid })
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.send({ event: 'ping' })
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  send(message: unknown): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false
    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message)
      this.ws.send({
        data,
        fail: (err) => console.error('[websocket] 发送失败', err),
      })
      return true
    } catch (e) {
      console.error('[websocket] 发送异常', e)
      return false
    }
  }

  private handleError(err: unknown): void {
    this.callbacks.onError?.(err)
    if (!this.isManualClose) this.scheduleReconnect()
  }

  private handleClose(res: Taro.SocketTask.OnCloseCallbackResult): void {
    this.stopHeartbeat()
    this.callbacks.onClose?.(res)
    if (!this.isManualClose) this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    const delay = this.reconnectInterval * this.reconnectAttempts
    this.reconnectTimer = setTimeout(() => {
      if (!this.isManualClose) this.doConnect()
    }, delay)
  }

  close(): void {
    this.isManualClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close({})
      } catch (e) {
        console.error('[websocket] 关闭异常', e)
      }
      this.ws = null
    }
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === 1
  }
}

const websocketManager = new WebSocketManager()
export default websocketManager
