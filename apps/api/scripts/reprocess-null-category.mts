/**
 * 串行重处理 llm_category IS NULL 的条目。
 *
 * 背景:全量重跑脚本被 ai-service 崩溃中断,988 条 LLM 失败 + 关键词降级也没匹配
 * 导致 llm_category 为 NULL。此脚本:
 *   1. 把 llm_category IS NULL 的条目的 llm_processedAt 重置为 null
 *   2. 2 路 worker 并发调用 processLlmBatch(降低打挂 ai-service 概率)
 *   3. 输出最终分布
 *
 * 速率估算:988 条 × 25s/条 / 4 worker ≈ 6175s ≈ 1.7 小时
 * (step-3.7-flash 推理模型 ~25s/条,不加 max_tokens 让 reasoning 完成)
 */
import 'dotenv/config'
import { createDb, aiFeedHotItem } from '@ihui/database'
import { isNull, sql } from 'drizzle-orm'
import { processLlmBatch } from '../src/services/ai-feed-service.js'

const db = createDb(process.env.DATABASE_URL!)
const CONCURRENCY = 4

async function main() {
  console.log('=== 重处理 llm_category IS NULL 的条目 ===\n')

  // 1. 统计当前 NULL 数量
  const before = await db.execute(
    sql`SELECT COUNT(*)::int AS c FROM ai_feed_hot_item WHERE llm_category IS NULL`,
  )
  const nullCount = (before[0] as { c: number }).c
  console.log(`当前 llm_category IS NULL 条数: ${nullCount}`)

  if (nullCount === 0) {
    console.log('无 NULL 条目,跳过')
    return
  }

  // 2. reset 这些条目的 llm_processed_at = null(让 processLlmBatch 能查到它们)
  console.log(`\n重置 ${nullCount} 条的 llm_processed_at = null ...`)
  const resetResult = await db
    .update(aiFeedHotItem)
    .set({ llmProcessedAt: null, updatedAt: new Date() })
    .where(isNull(aiFeedHotItem.llmCategory))
    .returning({ id: aiFeedHotItem.id })
  console.log(`重置完成,影响 ${resetResult.length} 条`)

  // 3. 2 路 worker 并发处理
  console.log(`\n=== ${CONCURRENCY} 路 worker 并发处理 ===`)
  let totalProcessed = 0
  const startTime = Date.now()
  let lastPrint = startTime

  async function worker(workerId: number) {
    let localCount = 0
    while (true) {
      const result = await processLlmBatch(50)
      if (result.processedItems === 0) break
      localCount += result.processedItems
      totalProcessed += result.processedItems
      const now = Date.now()
      if (now - lastPrint > 15000 || result.processedItems < 50) {
        const elapsed = ((now - startTime) / 1000).toFixed(1)
        const rate = (totalProcessed / ((now - startTime) / 1000)).toFixed(2)
        console.log(
          `[${elapsed}s] worker ${workerId}: 本地 ${localCount} 条 | 总计 ${totalProcessed}/${nullCount} | 速率 ${rate}/s`,
        )
        lastPrint = now
      }
    }
    console.log(`worker ${workerId} 完成,本地处理 ${localCount} 条`)
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n=== 全部完成,耗时 ${totalTime}s,处理 ${totalProcessed} 条 ===\n`)

  // 4. 输出最终分布
  console.log('=== 最终分布 ===')
  const finalDist = await db.execute(
    sql`SELECT llm_category, COUNT(*)::int AS c FROM ai_feed_hot_item GROUP BY llm_category ORDER BY COUNT(*) DESC`,
  )
  for (const r of finalDist) {
    console.log(`  ${(r as { llm_category: string | null }).llm_category ?? 'NULL'}: ${(r as { c: number }).c}`)
  }

  // 5. 按信源 × category 分布
  console.log('\n=== 按信源 × category 分布 ===')
  const bySource = await db.execute(
    sql`SELECT source_code, llm_category, COUNT(*)::int AS c FROM ai_feed_hot_item GROUP BY source_code, llm_category ORDER BY source_code, COUNT(*) DESC`,
  )
  const srcMap = new Map<string, Array<{ cat: string | null; c: number }>>()
  for (const r of bySource) {
    const row = r as { source_code: string; llm_category: string | null; c: number }
    const arr = srcMap.get(row.source_code) ?? []
    arr.push({ cat: row.llm_category, c: row.c })
    srcMap.set(row.source_code, arr)
  }
  for (const [src, cats] of srcMap) {
    const total = cats.reduce((s, x) => s + x.c, 0)
    const summary = cats.map((c) => `${c.cat ?? 'NULL'}:${c.c}`).join(', ')
    console.log(`  ${src.padEnd(28)} (${total}): ${summary}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
