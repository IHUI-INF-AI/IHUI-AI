// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createDb } from '../src/client.js'
import { lessons } from '../src/schema/learn.js'
import { resources } from '../src/schema/resource.js'
import { liveChannels } from '../src/schema/live.js'
import { circles } from '../src/schema/community.js'
import { newsArticles } from '../src/schema/news.js'
import { eq } from 'drizzle-orm'
import {
  DOMESTIC_IMAGE_POOL,
  isOverseasImageUrl,
} from '../../shared/src/constants/image-source-pool.js'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// 替换目标 = 境内可达图源池唯一真相源(packages/shared/src/constants/image-source-pool.ts)。
// 旧版这里的 5 条"真实 CDN"里有 2 条是境外域(images.ctfassets.net / cdn.sanity.io),
// 直接跑它等于换个境外源,不解决国内移动网络可达性 —— 故整池改引同一份境内常量。
const urlPool = [...DOMESTIC_IMAGE_POOL]
let counter = 0
function nextUrl() {
  const u = urlPool[counter % urlPool.length]
  counter++
  return u
}

async function updateTable<TTable extends PgTable>(
  tableName: string,
  table: TTable,
  idCol: PgColumn,
  coverCol: PgColumn,
) {
  const rows = await db.select({ id: idCol, cover: coverCol }).from(table)
  let updated = 0
  for (const r of rows) {
    if (!r.cover) continue
    const c = r.cover as string
    if (isOverseasImageUrl(c)) {
      const newUrl = nextUrl()
      await db.update(table).set({ coverImage: newUrl }).where(eq(idCol, r.id))
      updated++
      console.log(`  [${tableName}] ${r.id} [overseas] -> ${newUrl.substring(0, 60)}...`)
    }
  }
  console.log(`${tableName}: updated ${updated} / ${rows.length}`)
}

async function main() {
  console.log('=== 批量替换境外图片 URL → 境内可达图源池 ===\n')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
