import { createDb } from '../src/client.js'
import { lessons } from '../src/schema/learn.js'
import { resources } from '../src/schema/resource.js'
import { liveChannels } from '../src/schema/live.js'
import { circles } from '../src/schema/community.js'
import { newsArticles } from '../src/schema/news.js'
import { eq } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

const CDN_URLS = {
  openai1:
    'https://images.ctfassets.net/kftzwdyauwt9/3T0kxQLJk1VcXVxMwXF97J/4345df401f2b08ed6a1eef88c9588d2e/OAI_ChatGPTWork_ModelBlog_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
  anthropic1:
    'https://cdn.sanity.io/images/4zrzovbb/website/2039cc549c023bc855671308211d20d3382828a9-2880x1620.jpg',
  moonshot1: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/01-open-world.png',
  moonshot2: 'https://statics.moonshot.cn/kimi-blogs/kimi-k3/game-cases/02-strategy.png',
  tencent1:
    'https://static.www.tencent.com/uploads/2026/07/06/10c8b5b34b4793c92e448b2656379b6e.png!article.cover',
}

// 已知的虚构 URL(需替换为真实 URL)
const FAKE_URLS = [
  'https://images.ctfassets.net/kftzwdyauwt9/6OYZfXcZTVSfRoJ1edMr1B/c0a5a5a1a6a8a8b3c9d0c5b8a8b9c9d9/OAI_Research_OpenGraph_16x9_1200x630.png?w=1600&h=900&fit=fill',
  'https://cdn.sanity.io/images/4zrzovbb/website/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2-1920x1080.jpg',
]

const urlPool = Object.values(CDN_URLS)
let counter = 0
function nextUrl() {
  const u = urlPool[counter % urlPool.length]
  counter++
  return u
}

async function updateTable(tableName: string, table: any, idCol: any, coverCol: any) {
  const rows = await db.select({ id: idCol, cover: coverCol }).from(table)
  let updated = 0
  for (const r of rows) {
    if (!r.cover) continue
    const c = r.cover as string
    const isPicsum = c.includes('picsum.photos')
    const isFake = FAKE_URLS.some((f) => c.includes(f.substring(0, 80)))
    if (isPicsum || isFake) {
      const newUrl = nextUrl()
      await db.update(table).set({ coverImage: newUrl }).where(eq(idCol, r.id))
      updated++
      console.log(
        `  [${tableName}] ${r.id} ${isFake ? '[FAKE]' : '[picsum]'} -> ${newUrl.substring(0, 60)}...`,
      )
    }
  }
  console.log(`${tableName}: updated ${updated} / ${rows.length}`)
}

async function main() {
  console.log('=== 批量替换 picsum.photos URL ===\n')
  await updateTable('lessons', lessons, lessons.id, lessons.coverImage)
  await updateTable('live_channels', liveChannels, liveChannels.id, liveChannels.coverImage)
  await updateTable('news_articles', newsArticles, newsArticles.id, newsArticles.coverImage)
  await updateTable('circles', circles, circles.id, circles.coverImage)
  await updateTable('resources', resources, resources.id, resources.coverImage)
  console.log('\n=== 完成 ===')
  process.exit(0)
}

main().catch((e) => {
  console.error('失败:', e)
  process.exit(1)
})
