/**
 * Clawdbot System - 系统服务
 *
 * 配置管理、监控、日志收集。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface SystemConfig {
  [key: string]: unknown
}

export interface SystemMetrics {
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
  cpuUsage: NodeJS.CpuUsage
  timestamp: number
}

export interface LogEntry {
  id: string
  level: 'debug' | 'info' | 'warn' | 'error'
  source: string
  message: string
  data?: unknown
  timestamp: number
}

export class SystemService extends EventEmitter {
  private config: SystemConfig = {}
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private startTime = Date.now()

  setConfig(key: string, value: unknown): void {
    const oldValue = this.config[key]
    this.config[key] = value
    logger.info({ key, oldValue: !!oldValue }, '[System] Config updated')
    this.emit('configChanged', { key, value, oldValue })
  }

  getConfig(key: string): unknown {
    return this.config[key]
  }

  getAllConfig(): SystemConfig {
    return { ...this.config }
  }

  log(level: LogEntry['level'], source: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      level,
      source,
      message,
      data,
      timestamp: Date.now(),
    }
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) this.logs.shift()
    this.emit('log', entry)
  }

  getLogs(filter?: { level?: LogEntry['level']; source?: string; limit?: number }): LogEntry[] {
    let results = [...this.logs]
    if (filter?.level) results = results.filter((l) => l.level === filter.level)
    if (filter?.source) results = results.filter((l) => l.source === filter.source)
    return results.slice(-(filter?.limit ?? 100))
  }

  getMetrics(): SystemMetrics {
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      timestamp: Date.now(),
    }
  }

  getHealth() {
    return {
      status: 'healthy' as const,
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      logsCount: this.logs.length,
      configKeys: Object.keys(this.config).length,
    }
  }

  clearLogs(): number {
    const count = this.logs.length
    this.logs = []
    return count
  }
}

let instance: SystemService | null = null

export function getSystemService(): SystemService {
  if (!instance) instance = new SystemService()
  return instance
}
