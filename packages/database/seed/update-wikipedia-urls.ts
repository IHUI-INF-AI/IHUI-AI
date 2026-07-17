import { createDb } from '../src/client.js'
import { sql } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

const openaiUrl =
  'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill'
const anthropicUrl =
  'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg'
const moonshotUrl = 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png'
const tencentUrl =
  'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover'

// Wikipedia URL 关键词 → 替换为的真实 CDN URL
const urlMap: Array<{ keywords: string[]; url: string }> = [
  { keywords: ['Google_DeepMind', 'Neural_network'], url: anthropicUrl },
  {
    keywords: [
      'Artificial_intelligence_logo',
      'OpenAI_Logo',
      'Microsoft_logo',
      'LinkedIn_Logo',
      'ChatGPT_logo',
      'Bitcoin',
    ],
    url: openaiUrl,
  },
  { keywords: ['SK_Hynix', 'Atlas_%282024%29', 'Atlas_(2024)'], url: moonshotUrl },
  { keywords: ['Shanghai_Oriental_Pearl'], url: tencentUrl },
]

async function updateTable(table: string, quotedTable: string) {
  console.log(`\n=== 更新 ${table} 表 ===`)
  let totalUpdated = 0
  for (const { keywords, url } of urlMap) {
    const orClause = keywords.map((k) => `cover_image LIKE '%${k}%'`).join(' OR ')
    const result = await db.execute(
      sql.raw(`
      UPDATE ${quotedTable}
      SET cover_image = '${url.replace(/'/g, "''")}'
      WHERE ${orClause}
    `),
    )
    const rowCount = (result as unknown as { rowCount?: number }).rowCount ?? 0
    if (rowCount > 0) {
      console.log(`  关键词 [${keywords.join(', ')}] → 更新 ${rowCount} 行`)
      totalUpdated += rowCount
    }
  }
  console.log(`  ${table} 共更新 ${totalUpdated} 行`)
  return totalUpdated
}

async function main() {
  console.log('=== 批量替换 Wikipedia URL 为已验证可用的真实 CDN URL ===')
  const total =
    (await updateTable('lessons', 'lessons')) +
    (await updateTable('news_articles', 'news_articles')) +
    (await updateTable('live_channels', 'live_channels')) +
    (await updateTable('circles', 'circles')) +
    (await updateTable('resources', 'resources'))

  console.log(`\n=== 完成,总计更新 ${total} 行 ===`)

  // 验证残留
  const remaining = await db.execute(sql`
    SELECT 'lessons' AS t, COUNT(*)::int AS cnt FROM lessons WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'news_articles', COUNT(*)::int FROM news_articles WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'live_channels', COUNT(*)::int FROM live_channels WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'circles', COUNT(*)::int FROM circles WHERE cover_image LIKE '%upload.wikimedia.org%'
    UNION ALL SELECT 'resources', COUNT(*)::int FROM resources WHERE cover_image LIKE '%upload.wikimedia.org%'
  `)
  console.log('\n残留统计:')
  for (const r of remaining as unknown as Array<{ t: string; cnt: number }>) {
    console.log(`  ${r.t}: ${r.cnt}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
