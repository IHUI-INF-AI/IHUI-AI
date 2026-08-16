/**
 * Clawdbot Gateway - AI 网关
 *
 * 多模型路由、负载均衡、故障转移。
 */
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { logger } from './logger.js'
import {
  getModelManager,
  type ModelCompletionRequest,
  type ModelCompletionResponse,
} from './models.js'
import { generateCompactId } from '../../utils/crypto-random.js'

export interface GatewayConfig {
  wsUrl?: string
  reconnect?: {
    enabled: boolean
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  heartbeat?: { enabled: boolean; interval: number; timeout: number }
  messageQueue?: { maxSize: number; flushInterval: number }
  routing?: {
    strategy: 'round_robin' | 'least_latency' | 'cost_optimized' | 'failover'
    fallbackModels?: string[]
  }
}

export interface GatewayMessage {
  id: string
  type: 'chat' | 'command' | 'event' | 'system' | 'tool_call' | 'tool_result'
  channel: string
  channelType: string
  userId: string
  content: string
  metadata?: Record<string, unknown>
  replyTo?: string
  timestamp: number
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

const DEFAULT_CONFIG: GatewayConfig = {
  reconnect: { enabled: true, maxRetries: 5, retryDelay: 1000, backoffMultiplier: 2 },
  heartbeat: { enabled: true, interval: 30000, timeout: 5000 },
  messageQueue: { maxSize: 1000, flushInterval: 100 },
  routing: { strategy: 'failover' },
}

export class ClawdbotGateway extends EventEmitter {
  private config: GatewayConfig = DEFAULT_CONFIG
  private state: ConnectionState = 'disconnected'
  private modelRouterIndex = 0
  /** 运行时延迟统计(非持久化数据,重启后重新采集) */
  private latencyStats = new Map<string, number[]>()
  private connected = false
  private wsClient: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private manuallyDisconnected = false

  configure(config: Partial<GatewayConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 推导 WebSocket URL:
   *   config.wsUrl > env AI_SERVICE_WS_URL > 从 AI_SERVICE_URL 转 ws/wss + /gateway
   * 不硬编码端口,默认跟随 AI_SERVICE_URL(8803)。
   */
  private resolveWsUrl(): string {
    if (this.config.wsUrl) return this.config.wsUrl
    const envWs = process.env.AI_SERVICE_WS_URL
    if (envWs) return envWs
    const baseUrl = (process.env.AI_SERVICE_URL ?? 'http://localhost:8803').replace(/\/$/, '')
    const wsBase = baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    return `${wsBase}/gateway`
  }

  /** 指数退避重连延迟:1s/2s/4s/8s/16s,最大 30s */
  private getReconnectDelay(): number {
    const base = this.config.reconnect?.retryDelay ?? 1000
    const multiplier = this.config.reconnect?.backoffMultiplier ?? 2
    const max = 30000
    const delay = base * Math.pow(multiplier, this.reconnectAttempts)
    return Math.min(delay, max)
  }

  async connect(): Promise<void> {
    if (this.connected) return
    this.manuallyDisconnected = false
    this.state = 'connecting'
    const url = this.resolveWsUrl()
    logger.info({ url }, '[Gateway] Connecting to ai-service via WebSocket')
    this.openSocket(url)
  }

  private openSocket(url: string): void {
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      logger.error({ url, err: err as Error }, '[Gateway] WebSocket 创建失败,触发重连')
      this.scheduleReconnect()
      return
    }
    this.wsClient = ws

    ws.on('open', () => {
      this.connected = true
      this.state = 'connected'
      this.reconnectAttempts = 0
      logger.info({ url }, '[Gateway] WebSocket connected')
      // 发送注册消息,告知 ai-service 本网关身份
      try {
        ws.send(
          JSON.stringify({
            type: 'system',
            event: 'register',
            source: 'clawdbot-gateway',
            timestamp: Date.now(),
          }),
        )
      } catch (err) {
        logger.warn({ err: err as Error }, '[Gateway] 注册消息发送失败')
      }
      this.emit('connected')
    })

    ws.on('message', (data) => {
      try {
        const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as Uint8Array)
        const parsed = JSON.parse(buf.toString('utf8')) as GatewayMessage
        logger.debug({ messageId: parsed.id, type: parsed.type }, '[Gateway] WS message received')
        this.emit('message', parsed)
      } catch (err) {
        logger.warn({ err: err as Error }, '[Gateway] 消息解析失败,忽略非 JSON 帧')
      }
    })

    ws.on('error', (err) => {
      logger.warn({ err }, '[Gateway] WebSocket error')
      // 不直接改 state;close 事件会跟着触发并处理重连
    })

    ws.on('close', (code, reason) => {
      this.connected = false
      this.wsClient = null
      logger.info({ code, reason: reason.toString() }, '[Gateway] WebSocket closed')
      this.emit('disconnected')
      if (!this.manuallyDisconnected) this.scheduleReconnect()
    })
  }

  private scheduleReconnect(): void {
    if (this.manuallyDisconnected) return
    const maxRetries = this.config.reconnect?.maxRetries ?? 5
    if (this.reconnectAttempts >= maxRetries) {
      this.state = 'disconnected'
      logger.error({ attempts: this.reconnectAttempts }, '[Gateway] 重连次数耗尽,放弃')
      return
    }
    const delay = this.getReconnectDelay()
    this.state = 'reconnecting'
    this.reconnectAttempts++
    logger.info({ attempt: this.reconnectAttempts, delayMs: delay }, '[Gateway] 计划重连')
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket(this.resolveWsUrl())
    }, delay)
  }

  async disconnect(): Promise<void> {
    this.manuallyDisconnected = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.wsClient) {
      try {
        this.wsClient.close(1000, 'client disconnect')
      } catch {
        /* already closed */
      }
      this.wsClient = null
    }
    this.state = 'disconnected'
    this.connected = false
    logger.info('[Gateway] Disconnected')
    this.emit('disconnected')
  }

  /** 主动发送消息到 ai-service;未连接时返回 false */
  send(message: GatewayMessage | Record<string, unknown>): boolean {
    if (!this.connected || !this.wsClient) {
      logger.warn({ connected: this.connected }, '[Gateway] send 失败:未连接')
      return false
    }
    try {
      this.wsClient.send(JSON.stringify(message))
      return true
    } catch (err) {
      logger.error({ err: err as Error }, '[Gateway] send 异常')
      return false
    }
  }

  get isConnected(): boolean {
    return this.connected
  }

  get state_(): ConnectionState {
    return this.state
  }

  receiveMessage(message: Omit<GatewayMessage, 'id' | 'timestamp'>): GatewayMessage {
    const fullMessage: GatewayMessage = {
      ...message,
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成网关消息 ID
      id: generateCompactId('gw'),
      timestamp: Date.now(),
    }
    logger.debug(
      { messageId: fullMessage.id, type: fullMessage.type },
      '[Gateway] Message received',
    )
    this.emit('message', fullMessage)
    return fullMessage
  }

  async routeCompletion(request: ModelCompletionRequest): Promise<ModelCompletionResponse> {
    const modelManager = getModelManager()
    const strategy = this.config.routing?.strategy ?? 'failover'

    if (strategy === 'round_robin') {
      const models = modelManager.listEnabled()
      if (models.length === 0) throw new Error('No models available')
      const model = models[this.modelRouterIndex % models.length]!
      this.modelRouterIndex++
      return this.callWithFallback(model.id, request)
    }

    if (strategy === 'least_latency') {
      const fastest = this.getFastestModel()
      if (fastest) return this.callWithFallback(fastest, request)
    }

    if (strategy === 'cost_optimized') {
      const cheapest = modelManager
        .listEnabled()
        .sort((a, b) => (a.costPer1kTokens?.input ?? 0) - (b.costPer1kTokens?.input ?? 0))[0]
      if (cheapest) return this.callWithFallback(cheapest.id, request)
    }

    // failover (default)
    return this.callWithFallback(request.modelId ?? modelManager.getDefault()?.id ?? '', request)
  }

  private async callWithFallback(
    modelId: string,
    request: ModelCompletionRequest,
  ): Promise<ModelCompletionResponse> {
    const fallbacks = this.config.routing?.fallbackModels ?? []
    const candidates = [modelId, ...fallbacks].filter(Boolean)
    const modelManager = getModelManager()

    let lastError: Error | null = null
    for (const id of candidates) {
      const start = Date.now()
      try {
        const response = await modelManager.complete({ ...request, modelId: id })
        this.recordLatency(id, Date.now() - start)
        return response
      } catch (err) {
        lastError = err as Error
        logger.warn({ modelId: id, err: lastError }, '[Gateway] Model failed, trying fallback')
      }
    }
    throw lastError ?? new Error('All models failed')
  }

  private getFastestModel(): string | null {
    let fastest: string | null = null
    let lowestLatency = Infinity
    for (const [modelId, latencies] of this.latencyStats) {
      const avg = latencies.reduce((s, l) => s + l, 0) / latencies.length
      if (avg < lowestLatency) {
        lowestLatency = avg
        fastest = modelId
      }
    }
    return fastest
  }

  private recordLatency(modelId: string, latency: number): void {
    if (!this.latencyStats.has(modelId)) this.latencyStats.set(modelId, [])
    const stats = this.latencyStats.get(modelId)!
    stats.push(latency)
    if (stats.length > 10) stats.shift()
  }

  getStats() {
    return {
      connected: this.connected,
      state: this.state,
      activeChannels: 0,
      latencyStats: Array.from(this.latencyStats.entries()).map(([id, latencies]) => ({
        modelId: id,
        avgLatency: latencies.reduce((s, l) => s + l, 0) / latencies.length,
      })),
    }
  }
}

let instance: ClawdbotGateway | null = null

export function getClawdbotGateway(): ClawdbotGateway {
  if (!instance) instance = new ClawdbotGateway()
  return instance
}
