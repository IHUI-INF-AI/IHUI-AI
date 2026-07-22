/**
 * 并行标题翻译批处理(并发 10,加速 10 倍)。
 * 用法:cd apps/api && pnpm exec tsx scripts/translate-titles-parallel.mts [limit] [concurrency]
 *
 * 用原生 SQL,不依赖 @ihui/database 的 schema 导入路径。
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const limit = Number(process.argv[2] ?? 100)
const concurrency = Number(process.argv[3] ?? 10)

console.log(`并行标题翻译批处理,limit=${limit}, concurrency=${concurrency}`)
console.log(`AI_SERVICE_URL=${process.env.AI_SERVICE_URL}`)

const db = createDb(process.env.DATABASE_URL!)

const TRANSLATE_PROMPT = '将以下中文标题翻译为英文，仅返回翻译结果，不要添加任何解释或引号。'

async function callLlm(
  prompt: string,
  content: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const baseUrl = process.env.AI_SERVICE_URL
  if (!baseUrl) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)
    try {
      const body: Record<string, unknown> = {
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content },
        ],
      }
      if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
      if (options.temperature !== undefined) body.temperature = options.temperature
      const res = await fetch(`${baseUrl}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        content?: string
        error?: boolean
        stub?: boolean
      }
      if (json.error) return null
      if (json.stub) return null
      const text = json.content ?? ''
      return text.trim() || null
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}

interface FeedItem {
  id: string
  title: string
}

const pendingRes = await db.execute(sql`
  SELECT id, title
  FROM ai_feed_hot_item
  WHERE title_en IS NULL
  LIMIT ${limit}
`)
const pending: FeedItem[] = (pendingRes as any).rows ?? (pendingRes as any[])

console.log(`选中 ${pending.length} 条待翻译`)

if (pending.length === 0) {
  console.log('无待翻译条目')
  process.exit(0)
}

let processed = 0
let failed = 0
const chunks: FeedItem[][] = []
for (let i = 0; i < pending.length; i += concurrency) {
  chunks.push(pending.slice(i, i + concurrency))
}

for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci]
  const results = await Promise.all(
    chunk.map(async (item) => {
      try {
        // 只翻译中文标题,英文标题直接用原标题
        const isChinese = /[\u4e00-\u9fa5]/.test(item.title)
        if (!isChinese) {
          return { item, titleEn: item.title, ok: true }
        }
        const llmResult = await callLlm(TRANSLATE_PROMPT, item.title, { temperature: 0 })
        const titleEn = llmResult || item.title
        return { item, titleEn, ok: !!llmResult }
      } catch (e) {
        return { item, titleEn: item.title, ok: false, err: (e as Error).message }
      }
    }),
  )

  for (const r of results) {
    await db.execute(sql`
      UPDATE ai_feed_hot_item
      SET title_en = ${r.titleEn},
          updated_at = NOW()
      WHERE id = ${r.item.id}
    `)
    if (r.ok) processed++
    else failed++
  }
  console.log(`[chunk ${ci + 1}/${chunks.length}] 完成 ${results.length} 条(成功 ${processed}, 失败 ${failed})`)
}

console.log('')
console.log('=== 并行翻译批处理结果 ===')
console.log(`processedItems: ${processed}`)
console.log(`failed: ${failed}`)
console.log(`total: ${pending.length}`)

process.exit(0)
