import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })
import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL!)

const result: any = await db.execute(sql`
  SELECT
    COUNT(*)::int AS pending_total,
    COUNT(*) FILTER (WHERE llm_category IS NULL)::int AS no_category,
    COUNT(*) FILTER (WHERE llm_processed_at IS NULL)::int AS no_processed_at
  FROM ai_feed_hot_item
`)
const rows = Array.isArray(result) ? result : result.rows
console.log('待 LLM 处理统计:', rows[0])

const bySource: any = await db.execute(sql`
  SELECT source_code, COUNT(*)::int AS pending
  FROM ai_feed_hot_item
  WHERE llm_processed_at IS NULL
  GROUP BY source_code
  ORDER BY pending DESC
`)
const bySourceRows = Array.isArray(bySource) ? bySource : bySource.rows
console.log('\n按信源分布:')
bySourceRows.forEach((r: any) => console.log(`  ${r.source_code.padEnd(22)} ${r.pending}`))

process.exit(0)
