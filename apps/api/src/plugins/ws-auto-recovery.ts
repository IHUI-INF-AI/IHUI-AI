/** WebSocket 自动恢复统一抽象 - 监控/清理僵尸连接/触发恢复(迁移自 coze_zhs_py/websocket_auto_recovery.py) */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyInstance {
    wsAutoRecovery?: WsAutoRecoveryManager
  }
}

/** WebSocket 连接 Map:支持 id -> WebSocket(单端)或 id -> Set<WebSocket>(多端) */
export type WsConnectionMap = Map<string, WebSocket | Set<WebSocket>>

export interface WsPluginHooks {
  /** 返回当前连接 Map,供监控扫描僵尸连接 */
  getConnections(): WsConnectionMap
  /** 移除指定 id 的连接(由插件实现具体清理逻辑) */
  removeConnection(id: string): Promise<void>
  /** 可选:返回消息队列大小 */
  getQueueSize?(): number
  /** 可选:返回活跃 API 调用数 */
  getActiveApiCalls?(): number
  /** 可选:清理缓存钩子 */
  cleanup?(): Promise<void>
}

export interface WsAutoRecoveryOptions {
  maxRecoveryAttempts?: number
  healthCheckIntervalMs?: number
  serviceCheckIntervalMs?: number
  connectionCheckIntervalMs?: number
  memoryCheckIntervalMs?: number
  taskCheckIntervalMs?: number
  maxMemoryMb?: number
  maxInactiveMs?: number
  maxQueueSize?: number
  maxProcessingTasks?: number
}

export interface WsRecoveryStatus {
  startedAt: number | null
  pluginsRegistered: string[]
  recoveryAttempts: number
  lastRecoveryReason: string | null
  lastRecoveryAt: number | null
  monitoringActive: boolean
  totalConnectionsTracked: number
  lastHealthCheckAt: number | null
  lastMemoryMb: number | null
  lastQueueSize: number
  lastProcessingTasks: number
  consecutiveErrors: number
}

const WS_CLOSING = 2
const WS_CLOSED = 3

/** 提取 Map 中所有 WebSocket(兼容单 socket 与 Set<WebSocket> 两种存储) */
function flattenSockets(map: WsConnectionMap): WebSocket[] {
  const out: WebSocket[] = []
  for (const v of map.values()) {
    if (v instanceof Set) {
      for (const ws of v) out.push(ws)
    } else {
      out.push(v)
    }
  }
  return out
}

/** 判断 WebSocket 是否处于僵尸状态(CLOSING / CLOSED) */
function isZombie(ws: WebSocket): boolean {
  return ws.readyState === WS_CLOSING || ws.readyState === WS_CLOSED
}

/** 判断 Map 中某 id 的所有连接是否都已僵尸(Set 类型要求全部僵尸才清理) */
function isAllStale(v: WebSocket | Set<WebSocket>): boolean {
  if (v instanceof Set) {
    if (v.size === 0) return false
    for (const ws of v) {
      if (!isZombie(ws)) return false
    }
    return true
  }
  return isZombie(v)
}

export class WsAutoRecoveryManager {
  private fastify: FastifyInstance | null = null
  private plugins = new Map<string, WsPluginHooks>()
  private options: Required<WsAutoRecoveryOptions>
  private timers: NodeJS.Timeout[] = []
  private lastActivityAt = Date.now()
  private startedAt: number | null = null
  private recoveryAttempts = 0
  private lastRecoveryReason: string | null = null
  private lastRecoveryAt: number | null = null
  private lastHealthCheckAt: number | null = null
  private lastMemoryMb: number | null = null
  private lastQueueSize = 0
  private lastProcessingTasks = 0
  private consecutiveErrors = 0

  constructor(options: WsAutoRecoveryOptions = {}) {
    this.options = {
      maxRecoveryAttempts: options.maxRecoveryAttempts ?? 5,
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 60_000,
      serviceCheckIntervalMs: options.serviceCheckIntervalMs ?? 30_000,
      connectionCheckIntervalMs: options.connectionCheckIntervalMs ?? 120_000,
      memoryCheckIntervalMs: options.memoryCheckIntervalMs ?? 300_000,
      taskCheckIntervalMs: options.taskCheckIntervalMs ?? 180_000,
      maxMemoryMb: options.maxMemoryMb ?? 2048,
      maxInactiveMs: options.maxInactiveMs ?? 900_000,
      maxQueueSize: options.maxQueueSize ?? 100,
      maxProcessingTasks: options.maxProcessingTasks ?? 500,
    }
  }

  private log(level: 'info' | 'warn' | 'error' | 'fatal', msg: string, data?: unknown): void {
    const log = this.fastify?.log
    if (log) {
      const tag = `ws-auto-recovery: ${msg}`
      if (level === 'info') log.info({ data }, tag)
      else if (level === 'warn') log.warn({ data }, tag)
      else if (level === 'error') log.error({ data }, tag)
      else log.fatal({ data }, tag)
    } else if (level === 'error' || level === 'fatal') {
      console.error(`ws-auto-recovery: ${msg}`, data ?? '')
    }
  }

  setFastify(fastify: FastifyInstance): void {
    if (!this.fastify) {
      this.fastify = fastify
      const f = fastify as FastifyInstance & { wsAutoRecovery?: WsAutoRecoveryManager }
      if (!f.wsAutoRecovery) f.wsAutoRecovery = this
    }
  }

  registerPlugin(name: string, hooks: WsPluginHooks): void {
    this.plugins.set(name, hooks)
    this.log('info', `plugin registered: ${name}`)
    if (this.startedAt === null) {
      void this.startMonitoring()
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.startedAt !== null) return
    this.startedAt = Date.now()
    this.lastActivityAt = Date.now()

    const schedule = (fn: () => Promise<void>, ms: number): void => {
      this.timers.push(
        setInterval(() => {
          fn().catch((e) => {
            this.consecutiveErrors++
            this.log('warn', `monitor error: ${(e as Error).message}`)
            if (this.consecutiveErrors >= 3) {
              void this.triggerRecovery('consecutive monitor errors')
            }
          })
        }, ms),
      )
    }

    schedule(() => this.runHealthCheck(), this.options.healthCheckIntervalMs)
    schedule(() => this.runServiceCheck(), this.options.serviceCheckIntervalMs)
    schedule(() => this.runConnectionCheck(), this.options.connectionCheckIntervalMs)
    schedule(() => this.runMemoryCheck(), this.options.memoryCheckIntervalMs)
    schedule(() => this.runTaskCheck(), this.options.taskCheckIntervalMs)

    this.log('info', `monitoring started with ${this.plugins.size} plugin(s)`)
  }

  async stopMonitoring(): Promise<void> {
    for (const t of this.timers) clearInterval(t)
    this.timers = []
    this.startedAt = null
    this.log('info', 'monitoring stopped')
  }

  private async runHealthCheck(): Promise<void> {
    let totalConns = 0
    let totalQueue = 0
    let totalApiCalls = 0
    for (const hooks of this.plugins.values()) {
      const conns = hooks.getConnections()
      totalConns += flattenSockets(conns).length
      if (hooks.getQueueSize) totalQueue += hooks.getQueueSize() ?? 0
      if (hooks.getActiveApiCalls) totalApiCalls += hooks.getActiveApiCalls() ?? 0
    }
    this.lastHealthCheckAt = Date.now()
    this.lastQueueSize = totalQueue
    this.lastProcessingTasks = totalApiCalls
    this.consecutiveErrors = 0
    if (totalQueue > this.options.maxQueueSize) {
      this.log('warn', `queue size ${totalQueue} > ${this.options.maxQueueSize}`)
    }
    this.log(
      'info',
      `health check: conns=${totalConns} queue=${totalQueue} apiCalls=${totalApiCalls}`,
    )
  }

  private async runServiceCheck(): Promise<void> {
    const inactiveMs = Date.now() - this.lastActivityAt
    let hasConnections = false
    for (const hooks of this.plugins.values()) {
      if (hooks.getConnections().size > 0) {
        hasConnections = true
        break
      }
    }
    if (hasConnections && inactiveMs > this.options.maxInactiveMs) {
      this.log(
        'warn',
        `service inactive ${inactiveMs}ms with active connections, triggering recovery`,
      )
      await this.triggerRecovery('service inactive too long')
    }
  }

  private async runConnectionCheck(): Promise<void> {
    let cleaned = 0
    for (const [, hooks] of this.plugins) {
      const conns = hooks.getConnections()
      for (const [id, v] of conns) {
        if (isAllStale(v)) {
          await hooks.removeConnection(id).catch(() => {})
          cleaned++
        }
      }
    }
    if (cleaned > 0) {
      this.log('info', `cleaned ${cleaned} zombie connections`)
      this.lastActivityAt = Date.now()
    }
  }

  private async runMemoryCheck(): Promise<void> {
    const mem = process.memoryUsage()
    const rssMb = mem.rss / (1024 * 1024)
    this.lastMemoryMb = rssMb
    if (rssMb > this.options.maxMemoryMb) {
      this.log(
        'warn',
        `memory ${rssMb.toFixed(0)}MB > ${this.options.maxMemoryMb}MB, triggering cleanup`,
      )
      for (const [, hooks] of this.plugins) {
        if (hooks.cleanup) await hooks.cleanup().catch(() => {})
      }
      const gc = (global as { gc?: () => void }).gc
      if (gc) gc()
    }
  }

  private async runTaskCheck(): Promise<void> {
    let totalTasks = 0
    for (const hooks of this.plugins.values()) {
      if (hooks.getActiveApiCalls) totalTasks += hooks.getActiveApiCalls() ?? 0
    }
    if (totalTasks > this.options.maxProcessingTasks) {
      this.log(
        'warn',
        `processing tasks ${totalTasks} > ${this.options.maxProcessingTasks}, triggering cleanup`,
      )
      for (const [, hooks] of this.plugins) {
        if (hooks.cleanup) await hooks.cleanup().catch(() => {})
      }
    }
  }

  async triggerRecovery(reason: string): Promise<void> {
    if (this.recoveryAttempts >= this.options.maxRecoveryAttempts) {
      this.log(
        'fatal',
        `recovery attempts ${this.recoveryAttempts} >= max ${this.options.maxRecoveryAttempts}, manual intervention required`,
      )
      return
    }
    this.recoveryAttempts++
    this.lastRecoveryReason = reason
    this.lastRecoveryAt = Date.now()
    this.log('warn', `triggering recovery #${this.recoveryAttempts}: ${reason}`)

    for (const [, hooks] of this.plugins) {
      const conns = hooks.getConnections()
      for (const [id, v] of conns) {
        if (isAllStale(v)) {
          await hooks.removeConnection(id).catch(() => {})
        }
      }
      if (hooks.cleanup) await hooks.cleanup().catch(() => {})
    }
    this.consecutiveErrors = 0
  }

  getStatusReport(): WsRecoveryStatus {
    let totalConns = 0
    for (const hooks of this.plugins.values()) {
      totalConns += flattenSockets(hooks.getConnections()).length
    }
    return {
      startedAt: this.startedAt,
      pluginsRegistered: Array.from(this.plugins.keys()),
      recoveryAttempts: this.recoveryAttempts,
      lastRecoveryReason: this.lastRecoveryReason,
      lastRecoveryAt: this.lastRecoveryAt,
      monitoringActive: this.startedAt !== null,
      totalConnectionsTracked: totalConns,
      lastHealthCheckAt: this.lastHealthCheckAt,
      lastMemoryMb: this.lastMemoryMb,
      lastQueueSize: this.lastQueueSize,
      lastProcessingTasks: this.lastProcessingTasks,
      consecutiveErrors: this.consecutiveErrors,
    }
  }
}

let managerInstance: WsAutoRecoveryManager | null = null

export function getWsAutoRecoveryManager(options?: WsAutoRecoveryOptions): WsAutoRecoveryManager {
  if (!managerInstance) {
    managerInstance = new WsAutoRecoveryManager(options)
  }
  return managerInstance
}

const wsAutoRecoveryPlugin: FastifyPluginAsync<WsAutoRecoveryOptions> = async (fastify, opts) => {
  const manager = getWsAutoRecoveryManager(opts)
  manager.setFastify(fastify)
}

export default fp(wsAutoRecoveryPlugin, {
  name: 'ws-auto-recovery',
  fastify: '5.x',
})
