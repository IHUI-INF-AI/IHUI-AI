/**
 * 验证 LLM 分类分布与准确率(全量 1660 条重跑后)。
 *
 * 输出:
 *  - 总条数 / llm_category IS NULL 的条数(LLM 失败降级)
 *  - 按 llm_category 分组分布
 *  - 按 source_code × llm_category 分布(看信源与分类是否合理)
 *  - 抽样 30 条打印 title + source_code + llm_category(供人工核对)
 */
import { createDb, aiFeedHotItem } from '@ihui/database'
import { sql, eq, isNull, desc, count } from 'drizzle-orm'

const db = createDb(process.env.DATABASE_URL!)

async function main() {
  console.log('=== LLM 分类分布验证 ===\n')

  // 1. 总览
  const total = await db.select({ c: count() }).from(aiFeedHotItem)
  const nullCount = await db.select({ c: count() }).from(aiFeedHotItem).where(isNull(aiFeedHotItem.llmCategory))
  console.log(`总条数: ${total[0]?.c ?? 0}`)
  console.log(`llm_category IS NULL (LLM 失败降级为 inferCategoryByTitle 的不会落库为 null): ${nullCount[0]?.c ?? 0}`)

  // 2. 按 llm_category 分组
  console.log('\n=== 按 llm_category 分布 ===')
  const byCat = await db
    .select({ category: aiFeedHotItem.llmCategory, c: count() })
    .from(aiFeedHotItem)
    .groupBy(aiFeedHotItem.llmCategory)
    .orderBy(desc(count()))
  for (const r of byCat) {
    console.log(`  ${r.category ?? 'NULL'}: ${r.c}`)
  }

  // 3. 按 source_code × llm_category 分布(看信源与分类是否合理)
  console.log('\n=== 按 source_code × llm_category 分布(看信源与分类是否合理)===')
  const bySourceCat = await db
    .select({
      sourceCode: aiFeedHotItem.sourceCode,
      category: aiFeedHotItem.llmCategory,
      c: count(),
    })
    .from(aiFeedHotItem)
    .groupBy(aiFeedHotItem.sourceCode, aiFeedHotItem.llmCategory)
    .orderBy(aiFeedHotItem.sourceCode, desc(count()))
  // 按 source_code 聚合打印
  const bySource = new Map<string, Array<{ category: string | null; c: number }>>()
  for (const r of bySourceCat) {
    const arr = bySource.get(r.sourceCode) ?? []
    arr.push({ category: r.category, c: r.c })
    bySource.set(r.sourceCode, arr)
  }
  for (const [src, cats] of bySource) {
    const total = cats.reduce((s, x) => s + x.c, 0)
    const summary = cats.map((c) => `${c.category ?? 'NULL'}:${c.c}`).join(', ')
    console.log(`  ${src.padEnd(28)} (${total}): ${summary}`)
  }

  // 4. 抽样 30 条打印 title + source_code + llm_category
  console.log('\n=== 抽样 30 条(title + source + category)===')
  const sample = await db
    .select({
      title: aiFeedHotItem.title,
      sourceCode: aiFeedHotItem.sourceCode,
      category: aiFeedHotItem.llmCategory,
    })
    .from(aiFeedHotItem)
    .orderBy(desc(aiFeedHotItem.lastSeenAt))
    .limit(30)
  for (const r of sample) {
    console.log(`  [${(r.category ?? 'NULL').padEnd(12)}] [${r.sourceCode.padEnd(20)}] ${r.title.substring(0, 80)}`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
