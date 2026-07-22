/**
 * 并行 LLM 分类批处理(并发 10,加速 10 倍)。
 * 用法:cd apps/api && pnpm exec tsx scripts/llm-batch-parallel.mts [limit] [concurrency]
 *
 * 用原生 SQL(与 check-llm-pending.mts / check-category-distribution.mts 一致),
 * 不依赖 @ihui/database 的 schema 导入路径。
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

import { createDb } from '@ihui/database'
import { sql } from 'drizzle-orm'

const limit = Number(process.argv[2] ?? 100)
const concurrency = Number(process.argv[3] ?? 10)

console.log(`并行 LLM 分类批处理,limit=${limit}, concurrency=${concurrency}`)
console.log(`AI_SERVICE_URL=${process.env.AI_SERVICE_URL}`)

const db = createDb(process.env.DATABASE_URL!)

// === 复用 ai-feed-service.ts 的常量与逻辑(保持分类一致性)===

const CATEGORY_PROMPT = `你是 AI 资讯分类器。只返回一个类别名,不要任何其他内容(不要解释、不要 HTML、不要 markdown、不要标点)。
可选类别(5 选 1):
- ai-models: AI 模型发布/升级/评测(如 GPT/Claude/Gemini/Llama 新版本)
- ai-products: AI 产品/应用/平台(如 ChatGPT/Cursor/Copilot 新功能)
- industry: AI 行业动态(融资/收购/IPO/政策/监管)
- paper: 学术论文(arXiv/研究/NeurIPS/ICML/ICLR)
- tip: AI 技巧/教程/实践(how-to/最佳实践/入门)`

const VALID_CATEGORIES = new Set(['ai-models', 'ai-products', 'industry', 'paper', 'tip'])

function isValidCategory(value: string): boolean {
  return VALID_CATEGORIES.has(value.trim().toLowerCase())
}

function extractCategory(llmOutput: string): string | null {
  const match = llmOutput.match(/\b(ai-models|ai-products|industry|paper|tip)\b/i)
  return match?.[1]?.toLowerCase() ?? null
}

function inferCategoryByTitle(title: string, sourceCode?: string): string {
  if (sourceCode && sourceCode.startsWith('arxiv')) return 'paper'
  const lower = title.toLowerCase()
  if (/论文|paper|arxiv|research|研究|emnlp|neurips|icml|iclr|cvpr/.test(lower)) return 'paper'
  if (/融资|收购|ipo|funding|acquisition|市场|行业|政策|监管|ipo|上市/.test(lower)) return 'industry'
  if (/教程|技巧|实践|guide|tutorial|tip|best practice|最佳实践|how-to|入门/.test(lower)) return 'tip'
  if (/产品|应用|上线|product|app|platform|chatgpt|cursor|copilot|agent|智能体|机器人|机器人|平台|workspace|服务/.test(lower)) return 'ai-products'
  if (/发布|推出|升级|launch|release|announce|gpt|claude|gemini|llama|mistral|qwen|deepseek|kimi|moonshot|glm|混元|hunyuan|模型|llm|foundation model|vlm|多模态|推理|reasoning/.test(lower)) return 'ai-models'
  return 'ai-models'
}

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
        error_message?: string
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

// === 主逻辑(原生 SQL)===

interface FeedItem {
  id: string
  source_code: string
  title: string
  summary: string | null
}

const pendingRes = await db.execute(sql`
  SELECT id, source_code, title, summary
  FROM ai_feed_hot_item
  WHERE llm_processed_at IS NULL
  ORDER BY last_seen_at DESC
  LIMIT ${limit}
`)
const pending: FeedItem[] = (pendingRes as any).rows ?? (pendingRes as any[])

console.log(`选中 ${pending.length} 条待处理`)

if (pending.length === 0) {
  console.log('无待处理条目')
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
        const llmContent = `信源: ${item.source_code}\n标题: ${item.title}`
        const llmResult = await callLlm(CATEGORY_PROMPT, llmContent, { temperature: 0 })
        const extracted = llmResult ? extractCategory(llmResult) : null
        let category: string
        if (extracted) {
          category = extracted
        } else if (llmResult && isValidCategory(llmResult)) {
          category = llmResult.toLowerCase()
        } else {
          category = inferCategoryByTitle(item.title, item.source_code)
        }
        return { item, category, ok: true }
      } catch (e) {
        return { item, category: inferCategoryByTitle(item.title, item.source_code), ok: false, err: (e as Error).message }
      }
    }),
  )

  for (const r of results) {
    await db.execute(sql`
      UPDATE ai_feed_hot_item
      SET llm_category = ${r.category},
          llm_summary = COALESCE(${r.item.summary}, llm_summary),
          llm_processed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${r.item.id}
    `)
    if (r.ok) processed++
    else failed++
  }
  console.log(`[chunk ${ci + 1}/${chunks.length}] 完成 ${results.length} 条(成功 ${processed}, 失败 ${failed})`)
}

console.log('')
console.log('=== 并行 LLM 批处理结果 ===')
console.log(`processedItems: ${processed}`)
console.log(`failed: ${failed}`)
console.log(`total: ${pending.length}`)

process.exit(0)
