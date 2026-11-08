// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 热度统计聚合服务（backing service for heat-stats-hourly 定时任务）。
 * 迁移自旧架构 app/tasks/heat_stats_task.py。
 *
 * 每小时只做**读侧聚合**（返回当日 agent_heat_stats 汇总），不再回写 agents.usage_count。
 * usage_count 的真值是 recordAgentUse 的逐次 +1；agent_heat_stats.hitCount 是它的当日快照，
 * 每小时把当日全量再加一遍会形成 ×24 的复利膨胀（F-262，修复前当日每跑一次再涨一份）。
 * 日键统一走 bizDayKey（Asia/Shanghai），不再用 UTC 的 toISOString().slice(0,10)。
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentHeatStats } from '@ihui/database'
import { bizDayKey } from '../utils/biz-day.js'

export interface HeatStatsResult {
  dateStr: string
  aggregatedAgents: number
  totalHits: number
}

/**
 * 聚合当日的 Agent 调用热度（只读）。
 *
 * 实现策略：
 * 1. 以 bizDayKey 计算上海当日日期（YYYY-MM-DD）
 * 2. 从 agent_heat_stats 读当日汇总（agent 数 / 当日命中总数）
 * 3. **不回写 agents.usage_count**：该列由 recordAgentUse 逐次维护，heat 表只是当日快照
 *
 * F-262：此前这里每小时执行 `usage_count = usage_count + 当日 hit 总和`，
 * 同一天每跑一次就再累加一份全量，数值按小时膨胀，且与 recordAgentUse 双重计数。
 */
export async function aggregateHeatStats(): Promise<HeatStatsResult> {
  const now = new Date()
  const dateStr = bizDayKey(now)

  // 统计当日 agent_heat_stats 的 Agent 数量与总命中数
  const statsResult = await db
    .select({
      agentCount: sql<number>`count(*)::int`,
      totalHits: sql<number>`coalesce(sum(${agentHeatStats.hitCount}), 0)::bigint::int`,
    })
    .from(agentHeatStats)
    .where(sql`${agentHeatStats.dateStr} = ${dateStr}`)

  const aggregatedAgents = statsResult[0]?.agentCount ?? 0
  const totalHits = statsResult[0]?.totalHits ?? 0

  return {
    dateStr,
    aggregatedAgents,
    totalHits,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
