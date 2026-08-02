/**
 * ai-cost-tracker calculateCostCents 整数运算修复单测(2026-08-02 立)。
 *
 * 验证 commit bec24044b1 / ef76a13a26 修复的 Bug 3:
 * - 整数(分)运算无浮点累加精度丢失
 * - 大额累加精度正确
 * - 边界值(0 / 极大 / 0 价格 / 极小价格)正确
 * - 与旧 calculateCost() 返回值一致性(分 === Math.round(元 * 100))
 *
 * 测试模式:vi.mock logger + 直接 new AICostTracker(纯计算类,无 Redis/DB 依赖)。
 * 测试文件豁免 any(AGENTS.md §3),本文件用精确类型。
 */
import { describe, it, expect, vi } from 'vitest'
import { AICostTracker, CostTrackerError, type ModelPricing } from '../src/services/ai-cost-tracker.js'

// mock logger 避免 record() 调用时输出日志污染测试输出
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const PRICING: ModelPricing[] = [
  { model: 'basic', inputPer1k: 0.01, outputPer1k: 0.01 },
  { model: 'free', inputPer1k: 0, outputPer1k: 0 },
  { model: 'tiny', inputPer1k: 0.005, outputPer1k: 0.005 },
  { model: 'consistency', inputPer1k: 0.01, outputPer1k: 0.02 },
]

function makeTracker(): AICostTracker {
  return new AICostTracker(PRICING)
}

describe('AICostTracker.calculateCostCents 整数运算修复', () => {
  it('case 1: 基本整数运算(1000 tokens * 0.01 元/1k → 1 分)', () => {
    const tracker = makeTracker()
    expect(tracker.calculateCostCents('basic', 1000, 0)).toBe(1)
    expect(tracker.calculateCostCents('basic', 0, 1000)).toBe(1)
    expect(tracker.calculateCostCents('basic', 1000, 1000)).toBe(2)
  })

  it('case 2: 大额累加无浮点精度丢失(10000 次 record)', async () => {
    const tracker = makeTracker()
    const userId = 'user-acc'
    // 每次 1000 tokens * 0.01 元/1k = 1 分;10000 次累加 = 10000 分 = 100 元
    for (let i = 0; i < 10000; i++) {
      await tracker.record({ userId, model: 'basic', promptTokens: 1000, completionTokens: 0 })
    }
    // 旧浮点算法可能产生 99.99999999999999 漂移;整数算法严格 === 100
    expect(await tracker.getMonthlySpend(userId)).toBe(100)
  })

  it('case 3: 0 tokens 返回 0', () => {
    const tracker = makeTracker()
    expect(tracker.calculateCostCents('basic', 0, 0)).toBe(0)
  })

  it('case 4: 极大 tokens(1e9)不溢出,结果在安全整数范围', () => {
    const tracker = makeTracker()
    const cents = tracker.calculateCostCents('basic', 1e9, 1e9)
    expect(cents).toBe(2000000)
    expect(Number.isSafeInteger(cents)).toBe(true)
  })

  it('case 5: 0 价格返回 0', () => {
    const tracker = makeTracker()
    expect(tracker.calculateCostCents('free', 1000, 1000)).toBe(0)
    expect(tracker.calculateCostCents('free', 1e9, 1e9)).toBe(0)
  })

  it('case 6: 极小价格(0.005 元/1k)精度正确', () => {
    const tracker = makeTracker()
    // inputPer1kCents = Math.round(0.005 * 100) = Math.round(0.5) = 1;1000 tokens → 1 分
    expect(tracker.calculateCostCents('tiny', 1000, 0)).toBe(1)
    expect(tracker.calculateCostCents('tiny', 1000, 1000)).toBe(2)
  })

  it('case 7: calculateCostCents 与 calculateCost*100 一致性(整数分价格 + 1000 倍数 tokens)', () => {
    const tracker = makeTracker()
    const promptTokens = 1000
    const completionTokens = 1000
    const cents = tracker.calculateCostCents('consistency', promptTokens, completionTokens)
    const yuan = tracker.calculateCost('consistency', promptTokens, completionTokens)
    // 价格 * 100 是整数 + tokens 是 1000 倍数 → 新旧算法严格一致
    expect(cents).toBe(Math.round(yuan * 100))
    expect(cents).toBe(3) // 1 分(input) + 2 分(output)
  })

  it('case 8: record() 后 totalCostCents 整数累加正确', async () => {
    const tracker = makeTracker()
    const userId = 'user-record'
    await tracker.record({ userId, model: 'basic', promptTokens: 1000, completionTokens: 0 })
    expect(await tracker.getMonthlySpend(userId)).toBe(0.01)
    await tracker.record({ userId, model: 'basic', promptTokens: 1000, completionTokens: 0 })
    expect(await tracker.getMonthlySpend(userId)).toBe(0.02)
    // 第三次累加:整数分相加(1+1+1=3 分),getMonthlySpend = 0.03 无 0.030000000000000002 漂移
    await tracker.record({ userId, model: 'basic', promptTokens: 1000, completionTokens: 0 })
    expect(await tracker.getMonthlySpend(userId)).toBe(0.03)
  })

  it('case 9: 未知模型抛 CostTrackerError(no_pricing)', () => {
    const tracker = makeTracker()
    expect(() => tracker.calculateCostCents('unknown', 1000, 0)).toThrow(CostTrackerError)
    expect(() => tracker.calculateCostCents('unknown', 1000, 0)).toThrow(/未找到模型定价/)
  })
})
