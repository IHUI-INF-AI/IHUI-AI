/**
 * 一次性查询 AI 资讯各表当前状态:
 * - llm_processed_at IS NULL 数量(待分类)
 * - title_en IS NULL 数量(待翻译)
 * - ai_feed_snapshot 总数 + 按日期分布
 * - ai_feed_trend_signal 总数 + 按 trend_tag 分布
 * - ai_feed_hot_item 按 llm_category 分布
 *
 * 用法:cd apps/api && pnpm exec tsx scripts/check-all-status.mts
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL!)

console.log('=== AI 资讯各表状态 ===\n')

// 1. hot_item 待分类 + 待翻译
const pendingLlm: any = await db.execute(sql`
  SELECT
    COUNT(*) FILTER (WHERE llm_processed_at IS NULL)::int AS pending_llm,
    COUNT(*) FILTER (WHERE title_en IS NULL)::int AS pending_translate,
    COUNT(*)::int AS total
  FROM ai_feed_hot_item
`)
const pendingLlmRows = Array.isArray(pendingLlm) ? pendingLlm : pendingLlm.rows
console.log('ai_feed_hot_item:', JSON.stringify(pendingLlmRows[0]))

// 2. hot_item 按 llm_category 分布
const catDist: any = await db.execute(sql`
  SELECT COALESCE(llm_category, '(null)') AS category, COUNT(*)::int AS cnt
  FROM ai_feed_hot_item
  GROUP BY llm_category
  ORDER BY cnt DESC
`)
const catDistRows = Array.isArray(catDist) ? catDist : catDist.rows
console.log('\nllm_category 分布:')
for (const r of catDistRows) console.log(`  ${r.category}: ${r.cnt}`)

// 3. snapshot 总数 + 日期分布
const snapStats: any = await db.execute(sql`
  SELECT
    COUNT(*)::int AS total,
    COUNT(DISTINCT snapshot_date)::int AS unique_dates,
    COUNT(DISTINCT source_code)::int AS unique_sources
  FROM ai_feed_snapshot
`)
const snapStatsRows = Array.isArray(snapStats) ? snapStats : snapStats.rows
console.log('\nai_feed_snapshot:', JSON.stringify(snapStatsRows[0]))

const snapDates: any = await db.execute(sql`
  SELECT snapshot_date, COUNT(*)::int AS cnt
  FROM ai_feed_snapshot
  GROUP BY snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 10
`)
const snapDatesRows = Array.isArray(snapDates) ? snapDates : snapDates.rows
console.log('按日期分布:')
for (const r of snapDatesRows) console.log(`  ${r.snapshot_date}: ${r.cnt}`)

// 4. trend_signal 总数 + 按 tag 分布
const trendStats: any = await db.execute(sql`
  SELECT COALESCE(trend_tag, '(null)') AS tag, window_days, COUNT(*)::int AS cnt
  FROM ai_feed_trend_signal
  GROUP BY trend_tag, window_days
  ORDER BY window_days, tag
`)
const trendStatsRows = Array.isArray(trendStats) ? trendStats : trendStats.rows
console.log('\nai_feed_trend_signal 分布:')
if (trendStatsRows.length === 0) console.log('  (空)')
for (const r of trendStatsRows) console.log(`  [w${r.window_days}] ${r.tag}: ${r.cnt}`)

// 5. hot_item 按 trend_tag 分布(列表筛选实际读这个字段)
const hotTrendDist: any = await db.execute(sql`
  SELECT COALESCE(trend_tag, '(null)') AS tag, COUNT(*)::int AS cnt
  FROM ai_feed_hot_item
  GROUP BY trend_tag
  ORDER BY cnt DESC
`)
const hotTrendDistRows = Array.isArray(hotTrendDist) ? hotTrendDist : hotTrendDist.rows
console.log('\nai_feed_hot_item.trend_tag 分布:')
for (const r of hotTrendDistRows) console.log(`  ${r.tag}: ${r.cnt}`)

process.exit(0)
