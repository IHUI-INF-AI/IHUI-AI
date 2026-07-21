import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL!)

const items: any[] = await db.execute(sql`
  SELECT source_code, COUNT(*)::int AS cnt
  FROM ai_feed_hot_item
  GROUP BY source_code
  ORDER BY cnt DESC
`) as any
const itemsList = Array.isArray(items) ? items : items.rows
console.log('=== 数据分布 ===')
itemsList.forEach((r: any) => console.log(`  ${r.source_code.padEnd(22)} ${r.cnt}`))

const total: any = await db.execute(sql`SELECT COUNT(*)::int AS total FROM ai_feed_hot_item`) as any
const totalList = Array.isArray(total) ? total : total.rows
console.log(`TOTAL: ${totalList[0].total}`)

const srcs: any = await db.execute(sql`
  SELECT source_code, source_type, endpoint, enabled
  FROM ai_feed_source
  ORDER BY source_code
`) as any
const srcsList = Array.isArray(srcs) ? srcs : srcs.rows
console.log(`\n=== 信源清单 (${srcsList.length}) ===`)
srcsList.forEach((s: any) => {
  const has = itemsList.find((i: any) => i.source_code === s.source_code)
  const status = has ? `OK ${has.cnt}` : `XX 0`
  console.log(`  ${s.source_code.padEnd(22)} ${s.source_type.padEnd(8)} en=${s.enabled ? 'Y' : 'N'} ${status.padEnd(10)} ${s.endpoint.substring(0, 70)}`)
})

process.exit(0)
