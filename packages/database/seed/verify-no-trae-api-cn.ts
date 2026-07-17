import { createDb } from '../src/client.js'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

async function verify() {
  console.log('=== 验证数据库 trae-api-cn URL 残留 ===')
  const result = await db.execute(sql`
    SELECT 'lessons' AS t, COUNT(*)::int AS cnt FROM lessons WHERE cover_image LIKE '%trae-api-cn%'
    UNION ALL
    SELECT 'news_articles', COUNT(*)::int FROM news_articles WHERE cover_image LIKE '%trae-api-cn%'
    UNION ALL
    SELECT 'live_channels', COUNT(*)::int FROM live_channels WHERE cover_image LIKE '%trae-api-cn%'
    UNION ALL
    SELECT 'circles', COUNT(*)::int FROM circles WHERE cover_image LIKE '%trae-api-cn%'
  `)
  console.log('残留统计:', result)

  const lessonsWithRealUrl = await db.execute(sql`
    SELECT title, cover_image FROM lessons WHERE cover_image NOT LIKE '%trae-api-cn%' ORDER BY sort DESC LIMIT 5
  `)
  console.log('\n课程前5条(已用真实 URL):')
  for (const r of lessonsWithRealUrl as unknown as Array<{ title: string; cover_image: string }>) {
    console.log(`  ${r.title.slice(0, 30)}... → ${r.cover_image.slice(0, 80)}...`)
  }

  process.exit(0)
}

verify().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
