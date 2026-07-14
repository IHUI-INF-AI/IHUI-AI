import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface DependencyCheck {
  name: string
  status: HealthStatus
  latencyMs: number
  message?: string
  checkedAt: number
}

export interface HealthReport {
  status: HealthStatus
  uptime: number
  timestamp: number
  dependencies: DependencyCheck[]
}

export class HealthError extends Error {
  constructor(
    message: string,
    readonly code: 'check_failed' | 'not_found',
  ) {
    super(message)
    this.name = 'HealthError'
  }
}

export type DependencyChecker = () => Promise<{ status: HealthStatus; message?: string }>

export class HealthChecker extends EventEmitter {
  private readonly checkers = new Map<string, DependencyChecker>()
  private readonly startTime = Date.now()
  private lastReport: HealthReport | null = null

  registerDependency(name: string, checker: DependencyChecker): void {
    this.checkers.set(name, checker)
    logger.info({ dep: name }, '[Health] Dependency registered')
  }

  unregisterDependency(name: string): boolean {
    return this.checkers.delete(name)
  }

  async checkDependency(name: string): Promise<DependencyCheck> {
    const checker = this.checkers.get(name)
    if (!checker) throw new HealthError(`依赖未注册: ${name}`, 'not_found')
    const start = Date.now()
    try {
      const result = await checker()
      return {
        name,
        status: result.status,
        latencyMs: Date.now() - start,
        message: result.message,
        checkedAt: Date.now(),
      }
    } catch (err) {
      return {
        name,
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: (err as Error).message,
        checkedAt: Date.now(),
      }
    }
  }

  async checkHealth(): Promise<HealthReport> {
    const results: DependencyCheck[] = []
    for (const name of this.checkers.keys()) {
      results.push(await this.checkDependency(name))
    }
    const status = this.aggregateStatus(results)
    const report: HealthReport = {
      status,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
      dependencies: results,
    }
    this.lastReport = report
    this.emit('checked', report)
    if (status !== 'healthy') this.emit('unhealthy', report)
    return report
  }

  private aggregateStatus(results: DependencyCheck[]): HealthStatus {
    if (results.length === 0) return 'healthy'
    if (results.some((r) => r.status === 'unhealthy')) return 'unhealthy'
    if (results.some((r) => r.status === 'degraded')) return 'degraded'
    return 'healthy'
  }

  isReady(): boolean {
    if (!this.lastReport) return false
    return this.lastReport.status !== 'unhealthy'
  }

  isLive(): boolean {
    return true
  }

  getDependencies(): string[] {
    return Array.from(this.checkers.keys())
  }

  getLastReport(): HealthReport | null {
    return this.lastReport
  }
}

let instance: HealthChecker | null = null

export function getHealthChecker(): HealthChecker {
  if (!instance) instance = new HealthChecker()
  return instance
}
