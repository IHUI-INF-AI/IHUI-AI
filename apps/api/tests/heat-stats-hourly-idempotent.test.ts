// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-262 回归：heat-stats-hourly 每小时重复累加当日全量 hit，agents.usage_count 逐日膨胀。
 *
 * 用假时钟 + 内存种子行驱动真实 aggregateHeatStats，覆盖：
 *  - 同一小时重复执行两次：命中只累加一次；
 *  - 连续小时：只补新增差额，早前小时不重复计入；
 *  - 跨日：水位按日期重置，新一日只累加自己的命中。
 */

import { describe, expect, it } from 'vitest'
import {
  aggregateHeatStats,
  type DailyAgentHits,
  type HeatStatsSyncStore,
} from '../src/services/heat-stats-service.js'

const AGENT_A = '11111111-1111-4111-8111-111111111111'
const AGENT_B = '22222222-2222-4222-8222-222222222222'
const DAY_1 = '2026-11-08'
const DAY_2 = '2026-11-09'

/** 内存版数据源：agent_heat_stats 种子行 + agents.usage_count + 同步水位。 */
class FakeHeatStatsStore implements HeatStatsSyncStore {
  private daily: DailyAgentHits[] = []
  private readonly usageCounts = new Map<string, number>([
    [AGENT_A, 0],
    [AGENT_B, 0],
  ])
  private watermarkDate: string | null = null
  private watermark: Record<string, number> = {}

  /** 覆盖当日 agent_heat_stats 的按 agent 累计命中数（模拟日表被持续累加）。 */
  setDayHits(hits: Record<string, number>): void {
    this.daily = Object.entries(hits).map(([agentId, totalHits]) => ({ agentId, totalHits }))
  }

  usageCountOf(agentId: string): number {
    return this.usageCounts.get(agentId) ?? 0
  }

  async readDailyTotals(_dateStr: string): Promise<DailyAgentHits[]> {
    return this.daily.map((row) => ({ ...row }))
  }

  async readSyncedTotals(dateStr: string): Promise<Record<string, number>> {
    if (this.watermarkDate !== dateStr) return {}
    return { ...this.watermark }
  }

  async applyUsageDeltas(dateStr: string, deltas: Record<string, number>): Promise<void> {
    if (this.watermarkDate !== dateStr) {
      this.watermarkDate = dateStr
      this.watermark = {}
    }
    for (const [agentId, delta] of Object.entries(deltas)) {
      this.usageCounts.set(agentId, (this.usageCounts.get(agentId) ?? 0) + delta)
      this.watermark[agentId] = (this.watermark[agentId] ?? 0) + delta
    }
  }
}

function clock(day: string, hour: number, minute = 0): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, date!, hour, minute, 0))
}

describe('heat-stats-hourly 幂等（F-262）', () => {
  it('同一小时重复执行两次，命中只累加一次', async () => {
    const store = new FakeHeatStatsStore()
    store.setDayHits({ [AGENT_A]: 10, [AGENT_B]: 4 })

    const first = await aggregateHeatStats({ now: clock(DAY_1, 10), store })
    const second = await aggregateHeatStats({ now: clock(DAY_1, 10, 30), store })

    expect(first.dateStr).toBe(DAY_1)
    expect(first.totalHits).toBe(14)
    expect(second.totalHits).toBe(14)
    expect(store.usageCountOf(AGENT_A)).toBe(10)
    expect(store.usageCountOf(AGENT_B)).toBe(4)
  })

  it('连续小时只补新增命中，早前小时不重复计入', async () => {
    const store = new FakeHeatStatsStore()

    // 10 点：当日累计 10
    store.setDayHits({ [AGENT_A]: 10 })
    await aggregateHeatStats({ now: clock(DAY_1, 10), store })
    expect(store.usageCountOf(AGENT_A)).toBe(10)

    // 11 点：当日累计涨到 25（本小时新增 15）
    store.setDayHits({ [AGENT_A]: 25 })
    const hourly = await aggregateHeatStats({ now: clock(DAY_1, 11), store })

    expect(hourly.aggregatedAgents).toBe(1)
    expect(hourly.totalHits).toBe(25)
    expect(store.usageCountOf(AGENT_A)).toBe(25)
  })

  it('跨日重置水位，新一日只累加自己的命中', async () => {
    const store = new FakeHeatStatsStore()

    store.setDayHits({ [AGENT_A]: 10 })
    await aggregateHeatStats({ now: clock(DAY_1, 23), store })

    store.setDayHits({ [AGENT_A]: 3 })
    await aggregateHeatStats({ now: clock(DAY_2, 1), store })

    expect(store.usageCountOf(AGENT_A)).toBe(13)
  })
})
