/**
 * 手动触发标题翻译批处理(中→英)。
 * 用法:cd apps/api && pnpm exec tsx scripts/translate-titles-once.mts [limit]
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

const limit = Number(process.argv[2] ?? 50)
console.log(`触发标题翻译批处理,limit=${limit}...`)
console.log(`AI_SERVICE_URL=${process.env.AI_SERVICE_URL}`)

const { translateTitles } = await import('../src/services/ai-feed-service.js')
const result = await translateTitles(limit)

console.log('')
console.log('=== 翻译批处理结果 ===')
console.log(`processedItems: ${result.processedItems}`)
console.log(`details: ${result.details}`)

process.exit(0)
