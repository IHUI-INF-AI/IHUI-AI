/**
 * 手动触发 LLM 分类批处理(后台异步)。
 * 用法:cd apps/api && pnpm exec tsx scripts/llm-batch-once.mts [limit]
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

const limit = Number(process.argv[2] ?? 20)
console.log(`触发 LLM 分类批处理,limit=${limit}...`)
console.log(`AI_SERVICE_URL=${process.env.AI_SERVICE_URL}`)

const { processLlmBatch } = await import('../src/services/ai-feed-service.js')
const result = await processLlmBatch(limit)

console.log('')
console.log('=== LLM 批处理结果 ===')
console.log(`processedItems: ${result.processedItems}`)
console.log(`details: ${result.details}`)

process.exit(0)
