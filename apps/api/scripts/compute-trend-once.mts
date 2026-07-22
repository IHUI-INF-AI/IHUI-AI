/**
 * 手动触发趋势信号计算(基于 7/14 天快照)。
 * 用法:cd apps/api && pnpm exec tsx scripts/compute-trend-once.mts
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

console.log('触发趋势信号计算...')
const { computeTrendSignals } = await import('../src/services/ai-feed-service.js')
const result = await computeTrendSignals()

console.log('')
console.log('=== 趋势信号计算结果 ===')
console.log(`processedItems: ${result.processedItems}`)

process.exit(0)
