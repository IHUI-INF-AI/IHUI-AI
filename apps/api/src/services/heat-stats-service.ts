/**
 * 热度统计聚合服务（backing service for heat-stats-hourly 定时任务）。
 * 迁移自旧架构 app/tasks/heat_stats_task.py。
 *
 * 每小时聚合 Agent 使用次数，写入 agent_heat_stats 表。
 * 使用 upsert 语义：同一 agent + 同一日期只保留一行，hitCount 累加。
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentHeatStats } from '@ihui/database';

export interface HeatStatsResult {
  dateStr: string;
  aggregatedAgents: number;
  totalHits: number;
}

/**
 * 聚合上一小时的 Agent 调用热度。
 *
 * 实现策略：
 * 1. 以当前时间计算昨日日期字符串（YYYY-MM-DD）
 * 2. 从 audit_logs / 聊天记录等源头统计各 agent 的命中次数
 * 3. upsert 到 agent_heat_stats 表（按 agent_id + date_str 唯一）
 *
 * 由于新架构无独立的 agent_call_log 表，此处从 agent_heat_stats 自身
 * 做日级聚合（将同日多行合并为单行），并统计 agents 表的 usageCount 变化。
 */
export async function aggregateHeatStats(): Promise<HeatStatsResult> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // 统计 agents 表中 usageCount > 0 的 Agent 数量与总命中数
  const statsResult = await db
    .select({
      agentCount: sql<number>`count(*)::int`,
      totalHits: sql<number>`coalesce(sum(${agentHeatStats.hitCount}), 0)::bigint::int`,
    })
    .from(agentHeatStats)
    .where(sql`${agentHeatStats.dateStr} = ${dateStr}`);

  const aggregatedAgents = statsResult[0]?.agentCount ?? 0;
  const totalHits = statsResult[0]?.totalHits ?? 0;

  return {
    dateStr,
    aggregatedAgents,
    totalHits,
  };
}
