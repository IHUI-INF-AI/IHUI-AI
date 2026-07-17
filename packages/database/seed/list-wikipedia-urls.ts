import { createDb } from '../src/client.js'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

async function main() {
  const result = await db.execute(sql`
    SELECT id, title, cover_image FROM news_articles WHERE cover_image LIKE '%upload.wikimedia.org%' LIMIT 20
  `)
  console.log('news_articles 残留 URL:')
  for (const r of result as unknown as Array<{ id: string; title: string; cover_image: string }>) {
    console.log(`  ${r.title.slice(0, 40)} → ${r.cover_image}`)
  }

  // 同时检查其他表
  const otherTables = await db.execute(sql`
    SELECT 'lessons' AS t, COUNT(*)::int AS cnt FROM lessons WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'live_channels', COUNT(*)::int FROM live_channels WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'circles', COUNT(*)::int FROM circles WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'resources', COUNT(*)::int FROM resources WHERE cover_image LIKE '%upload.wikimedia.org%'
  `)
  console.log('\n其他表残留:')
  for (const r of otherTables as unknown as Array<{ t: string; cnt: number }>) {
    console.log(`  ${r.t}: ${r.cnt}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
