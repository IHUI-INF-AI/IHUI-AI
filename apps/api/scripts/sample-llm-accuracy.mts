/**
 * 抽样验证 LLM 真实分类准确率。
 *
 * 流程:
 * 1. 重置 50 条 ai_feed_hot_item 的 llmProcessedAt = null(覆盖 5 个类别 + 11 个原生 RSS 信源)
 * 2. 调用 ai-feed-service 的 processLlmBatch(50 条,走真实 LLM)
 * 3. 读取这 50 条的分类结果,输出分布 + 抽样展示
 * 4. 人工核对(输出 source_code/title/llm_category 三元组,肉眼判断)
 *
 * 用法:pnpm --filter @ihui/api exec tsx scripts/sample-llm-accuracy.mts
 */
import 'dotenv/config'
import { eq, isNull, desc, sql, inArray } from 'drizzle-orm'
import { createDb, aiFeedHotItem } from '@ihui/database'
import { processLlmBatch } from '../src/services/ai-feed-service.js'

const db = createDb(process.env.DATABASE_URL!)

async function main() {
  // 1. 重置 50 条的 llmProcessedAt(覆盖每个 sourceCode 各取 5 条)
  console.log('=== 1. 重置 50 条 llmProcessedAt = null(覆盖各信源) ===')
  const sources = [
    'google-deepmind',
    'huggingface-blog',
    'microsoft-research',
    'mit-tech-review',
    'techcrunch-ai',
    'the-verge-ai',
    'wired-ai',
    'arxiv-cs-ai',
    'arxiv-cs-cl',
    'hackernews',
    'github-trending',
  ]
  const resetIds: string[] = []
  for (const sourceCode of sources) {
    const rows = await db
      .select({ id: aiFeedHotItem.id })
      .from(aiFeedHotItem)
      .where(eq(aiFeedHotItem.sourceCode, sourceCode))
      .orderBy(desc(aiFeedHotItem.lastSeenAt))
      .limit(5)
    for (const r of rows) resetIds.push(r.id)
  }
  console.log(`选取 ${resetIds.length} 条(覆盖 ${sources.length} 个信源,每源 5 条)`)

  if (resetIds.length === 0) {
    console.error('❌ 没找到任何条目,退出')
    process.exit(1)
  }

  // 重置 llmProcessedAt = null,让 processLlmBatch 重新处理
  await db
    .update(aiFeedHotItem)
    .set({ llmProcessedAt: null, llmCategory: null })
    .where(inArray(aiFeedHotItem.id, resetIds))
  console.log(`已重置 ${resetIds.length} 条 llmProcessedAt = null`)

  // 2. 调用 processLlmBatch(50 条,走真实 LLM)
  console.log('\n=== 2. 调用 processLlmBatch(limit=100),真实 LLM 分类 ===')
  const startTs = Date.now()
  const result = await processLlmBatch(100)
  const elapsedSec = ((Date.now() - startTs) / 1000).toFixed(1)
  console.log(`处理完成: ${result.processedItems} 条,耗时 ${elapsedSec}s`)
  console.log(`详情: ${result.details}`)

  // 3. 读取这 50 条的分类结果
  console.log('\n=== 3. 50 条抽样分类结果(人工核对) ===')
  const rows = await db
    .select({
      id: aiFeedHotItem.id,
      sourceCode: aiFeedHotItem.sourceCode,
      title: aiFeedHotItem.title,
      llmCategory: aiFeedHotItem.llmCategory,
    })
    .from(aiFeedHotItem)
    .where(inArray(aiFeedHotItem.id, resetIds))
    .orderBy(aiFeedHotItem.sourceCode)

  // 按信源分组打印
  const bySource = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!bySource.has(r.sourceCode)) bySource.set(r.sourceCode, [])
    bySource.get(r.sourceCode)!.push(r)
  }
  for (const [src, items] of bySource) {
    console.log(`\n--- ${src} (${items.length} 条) ---`)
    for (const it of items) {
      console.log(`  [${it.llmCategory ?? 'NULL'}] ${it.title.slice(0, 100)}`)
    }
  }

  // 4. 分类分布统计
  console.log('\n=== 4. 分类分布 ===')
  const distRows = await db
    .select({
      category: aiFeedHotItem.llmCategory,
      count: sql<number>`count(*)::int`,
    })
    .from(aiFeedHotItem)
    .where(inArray(aiFeedHotItem.id, resetIds))
    .groupBy(aiFeedHotItem.llmCategory)
  for (const r of distRows) {
    console.log(`  ${r.category ?? 'NULL'}: ${r.count}`)
  }

  console.log('\n=== 5. 全库分类分布(参照) ===')
  const allRows = await db
    .select({
      category: aiFeedHotItem.llmCategory,
      count: sql<number>`count(*)::int`,
    })
    .from(aiFeedHotItem)
    .groupBy(aiFeedHotItem.llmCategory)
  for (const r of allRows) {
    console.log(`  ${r.category ?? 'NULL'}: ${r.count}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 异常:', e)
  process.exit(1)
})
