import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export interface AnalyticsRecord {
  id: string
  botId: string
  sessionId: string
  intent: string
  success: boolean
  latencyMs: number
  timestamp: number
}

export interface AnalyticsSummary {
  totalCalls: number
  successCount: number
  failedCount: number
  successRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  topIntents: Array<{ intent: string; count: number }>
  callsByBot: Array<{ botId: string; count: number }>
}

export class AnalyticsError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'not_found',
  ) {
    super(message)
    this.name = 'AnalyticsError'
  }
}

const MAX_RECORDS = 10_000

export class AnalyticsService extends EventEmitter {
  private readonly records: AnalyticsRecord[] = []

  record(input: Omit<AnalyticsRecord, 'id' | 'timestamp'>): AnalyticsRecord {
    const full: AnalyticsRecord = {
      ...input,
      id: `an_${crypto.randomUUID()}`,
      timestamp: Date.now(),
    }
    this.records.push(full)
    if (this.records.length > MAX_RECORDS) this.records.shift()
    this.emit('recorded', full)
    return full
  }

  query(filter?: { botId?: string; intent?: string; since?: number }): AnalyticsRecord[] {
    let result = this.records
    if (filter?.botId) result = result.filter((r) => r.botId === filter.botId)
    if (filter?.intent) result = result.filter((r) => r.intent === filter.intent)
    if (filter?.since) result = result.filter((r) => r.timestamp >= filter.since!)
    return result
  }

  getSummary(since?: number): AnalyticsSummary {
    const records = since ? this.records.filter((r) => r.timestamp >= since) : this.records
    const total = records.length
    if (total === 0) {
      return {
        totalCalls: 0,
        successCount: 0,
        failedCount: 0,
        successRate: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        topIntents: [],
        callsByBot: [],
      }
    }
    const successCount = records.filter((r) => r.success).length
    const latencies = records.map((r) => r.latencyMs).sort((a, b) => a - b)
    const p95Idx = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1)
    const intentMap = new Map<string, number>()
    const botMap = new Map<string, number>()
    for (const r of records) {
      intentMap.set(r.intent, (intentMap.get(r.intent) ?? 0) + 1)
      botMap.set(r.botId, (botMap.get(r.botId) ?? 0) + 1)
    }
    return {
      totalCalls: total,
      successCount,
      failedCount: total - successCount,
      successRate: (successCount / total) * 100,
      avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p95LatencyMs: latencies[p95Idx] ?? 0,
      topIntents: Array.from(intentMap.entries())
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      callsByBot: Array.from(botMap.entries())
        .map(([botId, count]) => ({ botId, count }))
        .sort((a, b) => b.count - a.count),
    }
  }

  getTodaySummary(): AnalyticsSummary {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return this.getSummary(startOfDay.getTime())
  }

  clear(): void {
    const count = this.records.length
    this.records.length = 0
    logger.info({ count }, '[Analytics] Cleared')
    this.emit('cleared', count)
  }
}

let instance: AnalyticsService | null = null

export function getAnalyticsService(): AnalyticsService {
  if (!instance) instance = new AnalyticsService()
  return instance
}
