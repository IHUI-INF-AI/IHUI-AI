/**
 * 一次性采集所有启用信源,验证入库率。
 * 用法:cd apps/api && pnpm exec tsx scripts/collect-once.mts
 */
import { config } from 'dotenv'
config({ path: 'g:/IHUI-AI/apps/api/.env' })

// 动态 import 确保 dotenv 先执行
const { collectAllSources } = await import('../src/services/ai-feed-service.js')

console.log('开始采集所有启用信源...')
console.log(`DAILYHOT_API_URL=${process.env.DAILYHOT_API_URL}`)
console.log(`RSSHUB_URL=${process.env.RSSHUB_URL}`)
console.log('')

const result = await collectAllSources()

console.log('')
console.log('=== 采集结果 ===')
console.log(`总条数: ${result.totalItems}`)
console.log(`成功: ${result.details.filter(d => d.status === 'success').length}`)
console.log(`失败: ${result.details.filter(d => d.status === 'failed').length}`)
console.log(`跳过: ${result.details.filter(d => d.status === 'skipped').length}`)
console.log('')
console.log('=== 明细 ===')
for (const d of result.details) {
  const icon = d.status === 'success' ? 'OK' : d.status === 'failed' ? 'XX' : 'SK'
  console.log(`  [${icon}] ${d.sourceCode.padEnd(22)} ${d.status.padEnd(8)} count=${d.count} ${d.error ?? ''}`)
}

process.exit(0)
