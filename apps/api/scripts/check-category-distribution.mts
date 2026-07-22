/**
 * 检查已分类条目的 5 类分布 + 抽样验证分类质量。
 * 用法:cd apps/api && node --import tsx scripts/check-category-distribution.mts
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })
import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL!)

// 1. 5 类分布统计
const dist: any = await db.execute(sql`
  SELECT llm_category, COUNT(*)::int AS cnt
  FROM ai_feed_hot_item
  WHERE llm_processed_at IS NOT NULL
  GROUP BY llm_category
  ORDER BY cnt DESC
`)
const distRows = Array.isArray(dist) ? dist : dist.rows
console.log('=== 已分类条目 5 类分布 ===')
distRows.forEach((r: any) => console.log(`  ${String(r.llm_category).padEnd(15)} ${r.cnt}`))
const total = distRows.reduce((s: number, r: any) => s + r.cnt, 0)
console.log(`  ${'总计'.padEnd(15)} ${total}`)

// 2. 抽样 10 条已分类条目,验证分类质量
const samples: any = await db.execute(sql`
  SELECT source_code, title, llm_category, llm_processed_at
  FROM ai_feed_hot_item
  WHERE llm_processed_at IS NOT NULL
  ORDER BY RANDOM()
  LIMIT 10
`)
const sampleRows = Array.isArray(samples) ? samples : samples.rows
console.log('\n=== 抽样 10 条已分类条目(验证质量) ===')
sampleRows.forEach((r: any, i: number) => {
  console.log(`\n[${i + 1}] [${r.llm_category}] ${r.source_code}`)
  console.log(`    ${r.title.slice(0, 120)}`)
})

// 3. 快照统计(用于 computeTrendSignals)
const snap: any = await db.execute(sql`
  SELECT COUNT(*)::int AS total_snapshots,
         COUNT(DISTINCT item_id)::int AS unique_items,
         COUNT(DISTINCT source_code)::int AS unique_sources,
         MIN(snapshot_date)::text AS earliest,
         MAX(snapshot_date)::text AS latest
  FROM ai_feed_snapshot
`)
const snapRows = Array.isArray(snap) ? snap : snap.rows
console.log('\n=== 快照统计(computeTrendSignals 依赖) ===')
console.log(snapRows[0])

// 4. 翻译统计
const trans: any = await db.execute(sql`
  SELECT COUNT(*) FILTER (WHERE title_en IS NOT NULL)::int AS translated,
         COUNT(*) FILTER (WHERE title_en IS NULL)::int AS pending_translation,
         COUNT(*)::int AS total
  FROM ai_feed_hot_item
`)
const transRows = Array.isArray(trans) ? trans : trans.rows
console.log('\n=== 翻译统计 ===')
console.log(transRows[0])

process.exit(0)
