/**
 * Clawdbot Gateway - AI 网关
 *
 * 多模型路由、负载均衡、故障转移。
 */
import { EventEmitter } from 'node:events'
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

  configure(config: Partial<GatewayConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async connect(): Promise<void> {
    if (this.connected) return
    this.state = 'connecting'
    logger.info('[Gateway] Connecting')
    // 简化实现:未建立真实 WebSocket 连接到 ai-service
    // TODO: 需建立真实 WebSocket 连接到 ai-service(ws://localhost:8000/gateway)
    logger.warn('[Gateway] 简化实现:未建立真实 WebSocket 连接,仅标记为 connected')
    this.state = 'connected'
    this.connected = true
    this.emit('connected')
  }

  async disconnect(): Promise<void> {
    this.state = 'disconnected'
    this.connected = false
    logger.info('[Gateway] Disconnected')
    this.emit('disconnected')
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
