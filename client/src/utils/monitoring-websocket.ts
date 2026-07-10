type Listener = (data: any) => void

interface WebSocketHandlers {
  onMetric?: (data: any) => void
  onAnomaly?: (data: any) => void
  onAlert?: (data: any) => void
  onSnapshot?: (data: any) => void
  onStatusChange?: (status: string) => void
}

class MonitoringWebSocket {
  private listeners: Map<string, Set<Listener>> = new Map()
  private ws: WebSocket | null = null
  private handlers: WebSocketHandlers = {}

  connect(url: string, _token?: string): void {
    try {
      this.ws = new WebSocket(url)
      this.handlers.onStatusChange?.('connected')
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type && this.handlers.onMetric) {
            this.handlers.onMetric(data)
          }
        } catch {
          // ignore parse errors
        }
      }
      this.ws.onclose = () => {
        this.handlers.onStatusChange?.('disconnected')
      }
      this.ws.onerror = () => {
        this.handlers.onStatusChange?.('error')
      }
    } catch {
      this.handlers.onStatusChange?.('error')
    }
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }

  setHandlers(handlers: WebSocketHandlers): void {
    this.handlers = handlers
  }

  on(event: string, listener: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener)
  }

  off(event: string, listener: Listener): void {
    this.listeners.get(event)?.delete(listener)
  }

  addEventListener(event: string, listener: Listener): void {
    this.on(event, listener)
  }

  removeEventListener(event: string, listener: Listener): void {
    this.off(event, listener)
  }
}

export const monitoringWebSocket = new MonitoringWebSocket()
export default monitoringWebSocket
