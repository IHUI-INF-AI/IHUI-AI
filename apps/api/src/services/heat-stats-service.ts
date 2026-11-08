// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 热度统计聚合服务（backing service for heat-stats-hourly 定时任务）。
 * 迁移自旧架构 app/tasks/heat_stats_task.py。
 *
 * 每小时聚合 Agent 使用次数，写入 agent_heat_stats 表。
 * 使用 upsert 语义：同一 agent + 同一日期只保留一行，hitCount 累加。
 *
 * 同步侧采用「水位增量」：当日 agent_heat_stats 的累计命中数只在超过
 * 上次已同步值时补差额，重复执行同一小时为 0 增量，避免 usage_count 逐小时膨胀。
 */

import { sql, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentHeatStats, agents, systemConfigs } from '@ihui/database'

export interface HeatStatsResult {
  dateStr: string
  aggregatedAgents: number
  totalHits: number
}

/** 当日每个 agent 的累计命中数（dateStr 为 YYYY-MM-DD）。 */
export interface DailyAgentHits {
  agentId: string
  totalHits: number
}

/**
 * 聚合与同步所需的数据源接口。
 * 抽出为可注入的端口，便于用假时钟 + 种子行验证幂等性，而不依赖真实 DB。
 */
export interface HeatStatsSyncStore {
  /** 读取某日 agent_heat_stats 的按 agent 累计命中数。 */
  readDailyTotals(dateStr: string): Promise<DailyAgentHits[]>
  /** 读取该日已同步进 agents.usage_count 的命中数水位。 */
  readSyncedTotals(dateStr: string): Promise<Record<string, number>>
  /** 将增量原子地累加到 agents.usage_count，并推进水位。 */
  applyUsageDeltas(dateStr: string, deltas: Record<string, number>): Promise<void>
}

export interface AggregateHeatStatsOptions {
  /** 假时钟注入点；缺省为当前时间。 */
  now?: Date
  /** 数据源注入点；缺省走真实 DB。 */
  store?: HeatStatsSyncStore
}

/** 内部水位行在 system_configs 中的键（非公开配置）。 */
const SYNC_WATERMARK_KEY = 'internal:heat-stats-usage-sync'
const SYNC_WATERMARK_CATEGORY = 'internal'

interface SyncWatermark {
  dateStr: string
  totals: Record<string, number>
}

/**
 * 聚合上一小时的 Agent 调用热度。
 *
 * 1. 以当前时间计算日期字符串（YYYY-MM-DD）
 * 2. 从 agent_heat_stats 统计当日各 agent 的累计命中数
 * 3. 只把「累计命中数 - 已同步水位」的正增量同步到 agents.usage_count
 */
export async function aggregateHeatStats(
  options: AggregateHeatStatsOptions = {},
): Promise<HeatStatsResult> {
  const now = options.now ?? new Date()
  const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const store = options.store ?? createDbStore()

  const rows = await store.readDailyTotals(dateStr)
  const totals: Record<string, number> = {}
  let totalHits = 0
  for (const row of rows) {
    totals[row.agentId] = (totals[row.agentId] ?? 0) + row.totalHits
    totalHits += row.totalHits
  }

  const synced = await store.readSyncedTotals(dateStr)
  const deltas = computeUsageDeltas(totals, synced)
  await store.applyUsageDeltas(dateStr, deltas)

  return {
    dateStr,
    aggregatedAgents: rows.length,
    totalHits,
  }
}

/**
 * 计算需要补进 usage_count 的增量。
 *
 * 只在当日累计命中数超过已同步水位时返回差额：同一小时重复执行得到 0，
 * 连续小时只补本小时新增，避免旧实现（每小时无条件加当日全量）的成倍膨胀。
 */
export function computeUsageDeltas(
  totals: Readonly<Record<string, number>>,
  synced: Readonly<Record<string, number>>,
): Record<string, number> {
  const deltas: Record<string, number> = {}
  for (const [agentId, total] of Object.entries(totals)) {
    const delta = total - (synced[agentId] ?? 0)
    if (delta > 0) deltas[agentId] = delta
  }
  return deltas
}

function parseWatermark(raw: string | null | undefined): SyncWatermark | null {
  if (!raw) return null
  const parsed = JSON.parse(raw) as { dateStr?: unknown; totals?: unknown }
  if (
    typeof parsed.dateStr !== 'string' ||
    typeof parsed.totals !== 'object' ||
    parsed.totals === null ||
    Array.isArray(parsed.totals)
  ) {
    throw new Error('heat-stats 同步水位格式非法：缺少 dateStr 或 totals')
  }
  const totals: Record<string, number> = {}
  for (const [agentId, value] of Object.entries(parsed.totals as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`heat-stats 同步水位格式非法：agent=${agentId} 的计数不是有限数`)
    }
    totals[agentId] = value
  }
  return { dateStr: parsed.dateStr, totals }
}

function createDbStore(): HeatStatsSyncStore {
  return {
    async readDailyTotals(dateStr) {
      const rows = await db
        .select({
          agentId: agentHeatStats.agentId,
          totalHits: sql<number>`coalesce(sum(${agentHeatStats.hitCount}), 0)::int`,
        })
        .from(agentHeatStats)
        .where(eq(agentHeatStats.dateStr, dateStr))
        .groupBy(agentHeatStats.agentId)
      return rows.map((row) => ({ agentId: row.agentId, totalHits: row.totalHits }))
    },

    async readSyncedTotals(dateStr) {
      const [row] = await db
        .select({ value: systemConfigs.value })
        .from(systemConfigs)
        .where(eq(systemConfigs.key, SYNC_WATERMARK_KEY))
        .limit(1)
      const watermark = parseWatermark(row?.value)
      if (!watermark || watermark.dateStr !== dateStr) return {}
      return watermark.totals
    },

    async applyUsageDeltas(dateStr, deltas) {
      const agentIds = Object.keys(deltas)
      if (agentIds.length === 0) return
      await db.transaction(async (tx) => {
        // 先保证水位行存在，随后在同一事务内加锁读改写，避免并发 tick 双加。
        await tx
          .insert(systemConfigs)
          .values({
            key: SYNC_WATERMARK_KEY,
            value: JSON.stringify({ dateStr: '', totals: {} }),
            type: 'json',
            category: SYNC_WATERMARK_CATEGORY,
            description: 'heat-stats-hourly 同步 agents.usage_count 的水位（内部使用）',
            isPublic: false,
          })
          .onConflictDoNothing({ target: systemConfigs.key })

        const [locked] = await tx
          .select({ value: systemConfigs.value })
          .from(systemConfigs)
          .where(eq(systemConfigs.key, SYNC_WATERMARK_KEY))
          .for('update')

        const watermark = parseWatermark(locked?.value)
        const totals = watermark?.dateStr === dateStr ? watermark.totals : {}

        for (const agentId of agentIds) {
          const delta = deltas[agentId] ?? 0
          if (delta === 0) continue
          await tx
            .update(agents)
            .set({
              usageCount: sql`${agents.usageCount} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(agents.agentId, agentId))
          totals[agentId] = (totals[agentId] ?? 0) + delta
        }

        await tx
          .update(systemConfigs)
          .set({
            value: JSON.stringify({ dateStr, totals }),
            updatedAt: new Date(),
          })
          .where(eq(systemConfigs.key, SYNC_WATERMARK_KEY))
      })
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
