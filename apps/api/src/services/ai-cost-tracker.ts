import { logger } from '../utils/logger.js'

export interface CostRecord {
  id: string
  userId: string
  model: string
  promptTokens: number
  completionTokens: number
  cost: number
  timestamp: Date
}

export interface CostBudget {
  userId: string
  monthlyLimit: number
  currentSpend: number
  alertThreshold: number
}

export interface ModelPricing {
  model: string
  inputPer1k: number
  outputPer1k: number
}

export class CostTrackerError extends Error {
  constructor(
    message: string,
    readonly code: 'no_pricing' | 'invalid_input',
  ) {
    super(message)
    this.name = 'CostTrackerError'
  }
}

interface UserAggregate {
  userId: string
  /** 整数分累加,避免浮点精度漂移 */
  totalCostCents: number
  records: CostRecord[]
}

/** P0 修复:store 最大用户数(LRU 淘汰最久未访问) */
const MAX_USERS = 1000
/** P0 修复:每用户 records 数组最大长度(超过时丢弃最旧的) */
const MAX_RECORDS_PER_USER = 1000

/** 简单 LRU Map(无外部依赖,利用 Map 插入顺序实现 LRU) */
class LRUCache<K, V> {
  private readonly map = new Map<K, V>()
  private readonly max: number

  constructor(max: number) {
    this.max = max
  }

  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v)
    }
    return v
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.max) {
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
    this.map.set(key, value)
  }

  values(): IterableIterator<V> {
    return this.map.values()
  }
}

export class AICostTracker {
  private readonly pricing = new Map<string, ModelPricing>()
  private readonly store = new LRUCache<string, UserAggregate>(MAX_USERS)

  constructor(pricing: ModelPricing[]) {
    for (const p of pricing) this.pricing.set(p.model, p)
  }

  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const p = this.pricing.get(model)
    if (!p) throw new CostTrackerError(`未找到模型定价: ${model}`, 'no_pricing')
    return (promptTokens / 1000) * p.inputPer1k + (completionTokens / 1000) * p.outputPer1k
  }

  async record(record: Omit<CostRecord, 'id' | 'cost' | 'timestamp'>): Promise<CostRecord> {
    const cost = this.calculateCost(record.model, record.promptTokens, record.completionTokens)
    const full: CostRecord = {
      ...record,
      id: crypto.randomUUID(),
      cost,
      timestamp: new Date(),
    }
    const agg = this.getOrCreate(record.userId)
    // P0 修复:records 数组限制最大长度,超过时丢弃最旧的
    if (agg.records.length >= MAX_RECORDS_PER_USER) {
      agg.records.shift()
    }
    agg.records.push(full)
    // P0 修复:用整数分累加,避免浮点精度漂移
    agg.totalCostCents += Math.round(cost * 100)
    logger.info('记录 AI 调用成本', { userId: record.userId, model: record.model, cost })
    return full
  }

  async getMonthlySpend(userId: string): Promise<number> {
    return this.getOrCreate(userId).totalCostCents / 100
  }

  async checkBudget(
    userId: string,
    budget: CostBudget,
  ): Promise<{ exceeded: boolean; alert: boolean; remaining: number }> {
    const spend = await this.getMonthlySpend(userId)
    return {
      exceeded: spend >= budget.monthlyLimit,
      alert: spend >= budget.monthlyLimit * budget.alertThreshold,
      remaining: budget.monthlyLimit - spend,
    }
  }

  async getTopUsers(limit = 10): Promise<Array<{ userId: string; totalCost: number }>> {
    const all = Array.from(this.store.values()).map((a) => ({
      userId: a.userId,
      totalCost: a.totalCostCents / 100,
    }))
    all.sort((a, b) => b.totalCost - a.totalCost)
    return all.slice(0, limit)
  }

  private getOrCreate(userId: string): UserAggregate {
    let agg = this.store.get(userId)
    if (!agg) {
      agg = { userId, totalCostCents: 0, records: [] }
      this.store.set(userId, agg)
    }
    return agg
  }
}
