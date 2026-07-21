/**
 * 全量并发重跑 ai_feed_hot_item 的 LLM 分类(走真实 ai-service /api/llm/complete)。
 *
 * 流程:
 * 1. 重置所有 1660 条 llmProcessedAt = null + llmCategory = null
 * 2. 5 路并发调用 processLlmBatch(每路 100 条循环)
 * 3. 进度日志(每 50 条打印一次)
 * 4. 完成后统计全库分类分布
 *
 * 用法:pnpm --filter @ihui/api exec tsx scripts/reprocess-all-llm.mts
 *
 * 预计耗时(5 路并发,每条 ~25s):1660 / 5 * 25s ≈ 8300s ≈ 2.3 小时
 */
import 'dotenv/config'
import { eq, isNull, desc, sql } from 'drizzle-orm'
import { createDb, aiFeedHotItem } from '@ihui/database'
import { processLlmBatch } from '../src/services/ai-feed-service.js'

const db = createDb(process.env.DATABASE_URL!)
const CONCURRENCY = 5

async function main() {
  // 1. 统计当前待处理条数
  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiFeedHotItem)
  const total = totalRows[0]?.count ?? 0
  console.log(`=== 全量重跑 LLM 分类 ===`)
  console.log(`总条目数: ${total}`)

  // 2. 重置所有条目的 llmProcessedAt = null + llmCategory = null
  console.log(`\n=== 1. 重置所有 ${total} 条 llmProcessedAt = null + llmCategory = null ===`)
  const resetStart = Date.now()
  await db
    .update(aiFeedHotItem)
    .set({ llmProcessedAt: null, llmCategory: null, updatedAt: new Date() })
  console.log(`重置完成,耗时 ${((Date.now() - resetStart) / 1000).toFixed(1)}s`)

  // 3. 5 路并发调用 processLlmBatch
  console.log(`\n=== 2. ${CONCURRENCY} 路并发调用 processLlmBatch(每路 100 条循环) ===`)
  const startTs = Date.now()
  let totalProcessed = 0
  let lastLogTs = Date.now()

  async function worker(workerId: number) {
    let localCount = 0
    while (true) {
      const result = await processLlmBatch(100)
      if (result.processedItems === 0) break
      localCount += result.processedItems
      totalProcessed += result.processedItems
      const now = Date.now()
      // 每 50 条或每 30s 打印一次进度
      if (totalProcessed % 50 < 100 || now - lastLogTs > 30_000) {
        const elapsed = ((now - startTs) / 1000).toFixed(1)
        const rate = (totalProcessed / ((now - startTs) / 1000)).toFixed(2)
        console.log(
          `[${elapsed}s] worker ${workerId}: 已处理 ${localCount} 条 | 总计 ${totalProcessed}/${total} | 速率 ${rate}/s`,
        )
        lastLogTs = now
      }
    }
    console.log(`worker ${workerId} 完成,处理 ${localCount} 条`)
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  await Promise.all(workers)

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1)
  console.log(`\n=== 3. 全部完成 ===`)
  console.log(`总处理: ${totalProcessed} 条,耗时 ${elapsed}s`)

  // 4. 全库分类分布统计
  console.log(`\n=== 4. 全库分类分布 ===`)
  const distRows = await db
    .select({
      category: aiFeedHotItem.llmCategory,
      count: sql<number>`count(*)::int`,
    })
    .from(aiFeedHotItem)
    .groupBy(aiFeedHotItem.llmCategory)
  for (const r of distRows) {
    console.log(`  ${r.category ?? 'NULL'}: ${r.count}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 异常:', e)
  process.exit(1)
})
