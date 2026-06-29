import { websocketService, type WebSocketStatus } from './websocket'
import { logger } from './logger'
import type { MonitoringMetric, AnomalyDetection, PerformanceSnapshot } from '@/services/tourMonitoringService'
import type { AlertInstance } from '@/services/tourAlertService'

/**
 * 监控WebSocket消息接口
 * @description 定义WebSocket消息的结构
 */
export interface MonitoringWebSocketMessage {
  /** 消息类型 */
  type: 'metric' | 'anomaly' | 'alert' | 'snapshot' | 'config_update'
  /** 消息负载 */
  payload: unknown
  /** 时间戳 */
  timestamp: number
}

/**
 * 监控事件处理器接口
 * @description 定义各类监控事件的回调函数
 */
export interface MonitoringEventHandlers {
  /** 指标数据回调 */
  onMetric?: (metric: MonitoringMetric) => void
  /** 异常检测回调 */
  onAnomaly?: (anomaly: AnomalyDetection) => void
  /** 告警回调 */
  onAlert?: (alert: AlertInstance) => void
  /** 性能快照回调 */
  onSnapshot?: (snapshot: PerformanceSnapshot) => void
  /** 配置更新回调 */
  onConfigUpdate?: (config: unknown) => void
  /** 连接状态变化回调 */
  onStatusChange?: (status: WebSocketStatus) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

/**
 * 监控WebSocket服务类
 * @description 提供实时监控数据的WebSocket连接和事件处理
 * @example
 * ```ts
 * import { monitoringWebSocket } from '@/utils/monitoring-websocket'
 *
 * // 连接WebSocket
 * await monitoringWebSocket.connect('wss://api.example.com/monitoring', 'your-token')
 *
 * // 设置事件处理器
 * monitoringWebSocket.setHandlers({
 *   onMetric: (metric) => console.log('收到指标:', metric),
 *   onAnomaly: (anomaly) => console.log('检测到异常:', anomaly),
 *   onAlert: (alert) => console.log('收到告警:', alert),
 * })
 *
 * // 请求快照
 * monitoringWebSocket.requestSnapshot()
 *
 * // 断开连接
 * monitoringWebSocket.disconnect()
 * ```
 */
class MonitoringWebSocketService {
  private connected = false
  private handlers: MonitoringEventHandlers = {}
  private unsubscribers: (() => void)[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private lastUrl = ''
  private lastToken = ''

  /**
   * 连接WebSocket服务
   * @param url - WebSocket服务地址
   * @param token - 认证令牌（可选）
   */
  async connect(url: string, token?: string): Promise<void> {
    if (this.connected) {
      logger.warn('[MonitoringWS] Already connected')
      return
    }

    this.lastUrl = url
    this.lastToken = token || ''

    try {
      await websocketService.connect(url, token)
      this.connected = true
      this.setupHandlers()
      this.startHeartbeat()
      logger.info('[MonitoringWS] Monitoring WebSocket connected')
    } catch (error) {
      logger.error('[MonitoringWS] Connection failed:', error)
      this.handlers.onError?.(error as Error)
      throw error
    }
  }

  private setupHandlers(): void {
    const unsubStatus = websocketService.onStatusChange((status) => {
      this.handlers.onStatusChange?.(status)
      if (status === 'disconnected' || status === 'error') {
        this.connected = false
        this.scheduleReconnect()
      }
    })
    this.unsubscribers.push(unsubStatus)

    const unsubMetric = websocketService.on('monitoring:metric', (data) => {
      this.handlers.onMetric?.(data as MonitoringMetric)
    })
    this.unsubscribers.push(unsubMetric)

    const unsubAnomaly = websocketService.on('monitoring:anomaly', (data) => {
      this.handlers.onAnomaly?.(data as AnomalyDetection)
    })
    this.unsubscribers.push(unsubAnomaly)

    const unsubAlert = websocketService.on('monitoring:alert', (data) => {
      this.handlers.onAlert?.(data as AlertInstance)
    })
    this.unsubscribers.push(unsubAlert)

    const unsubSnapshot = websocketService.on('monitoring:snapshot', (data) => {
      this.handlers.onSnapshot?.(data as PerformanceSnapshot)
    })
    this.unsubscribers.push(unsubSnapshot)

    const unsubConfig = websocketService.on('monitoring:config_update', (data) => {
      this.handlers.onConfigUpdate?.(data)
    })
    this.unsubscribers.push(unsubConfig)
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        websocketService.send('monitoring:heartbeat', { timestamp: Date.now() })
      }
    }, 30000)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.connected) {
        this.connect(this.getLastUrl(), this.getLastToken()).catch(() => {
          this.scheduleReconnect()
        })
      }
    }, 5000)
  }

  private getLastUrl(): string {
    return this.lastUrl
  }

  private getLastToken(): string | undefined {
    return this.lastToken
  }

  /**
   * 设置事件处理器
   * @param handlers - 事件处理器对象
   */
  setHandlers(handlers: MonitoringEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }
  }

  /**
   * 订阅特定事件
   * @param event - 事件名称
   * @param handler - 事件处理函数
   * @returns 取消订阅函数
   */
  subscribe(event: keyof MonitoringEventHandlers, handler: (data: unknown) => void): () => void {
    const eventMap: Record<string, string> = {
      onMetric: 'monitoring:metric',
      onAnomaly: 'monitoring:anomaly',
      onAlert: 'monitoring:alert',
      onSnapshot: 'monitoring:snapshot',
      onConfigUpdate: 'monitoring:config_update',
    }

    const wsEvent = eventMap[event]
    if (wsEvent) {
      return websocketService.on(wsEvent, handler)
    }

    return () => {}
  }

  /**
   * 请求性能快照
   */
  requestSnapshot(): void {
    if (!this.connected) return
    websocketService.send('monitoring:request_snapshot', { timestamp: Date.now() })
  }

  /**
   * 确认异常
   * @param anomalyId - 异常ID
   */
  acknowledgeAnomaly(anomalyId: string): void {
    if (!this.connected) return
    websocketService.send('monitoring:acknowledge_anomaly', { anomalyId, timestamp: Date.now() })
  }

  /**
   * 确认告警
   * @param alertId - 告警ID
   */
  acknowledgeAlert(alertId: string): void {
    if (!this.connected) return
    websocketService.send('monitoring:acknowledge_alert', { alertId, timestamp: Date.now() })
  }

  /**
   * 更新配置
   * @param config - 配置对象
   */
  updateConfig(config: unknown): void {
    if (!this.connected) return
    websocketService.send('monitoring:update_config', { config, timestamp: Date.now() })
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.unsubscribers.forEach((unsub) => unsub())
    this.unsubscribers = []

    websocketService.disconnect()
    this.connected = false
    logger.info('[MonitoringWS] Monitoring WebSocket disconnected')
  }

  /**
   * 检查是否已连接
   * @returns 连接状态
   */
  isConnected(): boolean {
    return this.connected
  }
}

export const monitoringWebSocket = new MonitoringWebSocketService()
