/**
 * 生成 AI 资讯每日快照(写入 ai_feed_snapshot 表)。
 * 用法:cd apps/api && pnpm exec tsx scripts/snapshot-once.mts
 *
 * 快照逻辑:
 * - 把当天所有 ai_feed_hot_item 的 (hot_value, rank) 写入 ai_feed_snapshot
 * - snapshotDate = 今天(YYYY-MM-DD)
 * - (sourceCode, platformItemId, snapshotDate) 三元组唯一,幂等 upsert
 *
 * computeTrendSignals 依赖快照数据:
 * - 需要 7/14 天窗口内的至少 2 个快照点才能计算趋势
 * - 今天生成第 1 个快照,明天 cron 生成第 2 个,才能计算趋势
 *
 * 建议集成到 ai-feed-process cron(在 computeTrendSignals 之前调用)。
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

console.log('生成 AI 资讯每日快照...')

const db = createDb(process.env.DATABASE_URL!)

// 生成今天的快照(幂等 upsert)
// 把所有 ai_feed_hot_item 的 (hot_value, rank) 写入 ai_feed_snapshot
const result = await db.execute(sql`
  INSERT INTO ai_feed_snapshot (source_code, platform_item_id, item_id, title, rank, hot_value, snapshot_date, captured_at, created_at, updated_at)
  SELECT
    h.source_code,
    h.platform_item_id,
    h.id,
    h.title,
    h.current_rank,
    h.current_hot,
    CURRENT_DATE,
    NOW(),
    NOW(),
    NOW()
  FROM ai_feed_hot_item h
  WHERE h.current_hot IS NOT NULL OR h.current_rank IS NOT NULL
  ON CONFLICT (source_code, platform_item_id, snapshot_date) DO UPDATE
  SET
    rank = EXCLUDED.rank,
    hot_value = EXCLUDED.hot_value,
    title = EXCLUDED.title,
    item_id = EXCLUDED.item_id,
    captured_at = NOW(),
    updated_at = NOW()
`)

console.log('')
console.log('=== 快照生成结果 ===')
console.log(`日期: ${new Date().toISOString().slice(0, 10)}`)
console.log(`已写入/更新: ${result.rowCount ?? 'N/A'} 条`)

// 查询快照总数
const stats: any = await db.execute(sql`
  SELECT
    COUNT(*)::int AS total,
    COUNT(DISTINCT snapshot_date)::int AS unique_dates,
    COUNT(DISTINCT source_code)::int AS unique_sources,
    MIN(snapshot_date) AS earliest,
    MAX(snapshot_date) AS latest
  FROM ai_feed_snapshot
`)
const statsList = Array.isArray(stats) ? stats : stats.rows
console.log('快照统计:', JSON.stringify(statsList[0], null, 2))

process.exit(0)
