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
  totalCost: number
  records: CostRecord[]
}

export class AICostTracker {
  private readonly pricing = new Map<string, ModelPricing>()
  private readonly store = new Map<string, UserAggregate>()

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
    agg.records.push(full)
    agg.totalCost += cost
    logger.info('记录 AI 调用成本', { userId: record.userId, model: record.model, cost })
    return full
  }

  async getMonthlySpend(userId: string): Promise<number> {
    return this.getOrCreate(userId).totalCost
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
      totalCost: a.totalCost,
    }))
    all.sort((a, b) => b.totalCost - a.totalCost)
    return all.slice(0, limit)
  }

  private getOrCreate(userId: string): UserAggregate {
    let agg = this.store.get(userId)
    if (!agg) {
      agg = { userId, totalCost: 0, records: [] }
      this.store.set(userId, agg)
    }
    return agg
  }
}
