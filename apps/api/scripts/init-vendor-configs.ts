/**
 * AI 厂商配置初始化脚本（R4 重构产物）。
 *
 * 用法：
 *   pnpm --filter @ihui/api tsx scripts/init-vendor-configs.ts
 *
 * 行为：
 * 1. 读取 FALLBACK_VENDORS（与重构前 VENDORS 一致）
 * 2. 写入 ai_vendor_configs 表（onConflictDoNothing 幂等）
 * 3. 打印初始化结果
 *
 * 适用场景：
 * - 首次部署后初始化
 * - 数据库 schema 迁移后回填默认数据
 * - DB 异常后的恢复
 */
import { db } from '../src/db/index.js'
import { aiVendorConfigs } from '@ihui/database'
import { FALLBACK_VENDORS } from '../src/services/ai-vendor-config-service.js'

async function main() {
  console.info('[init-vendor-configs] 开始初始化 AI 厂商配置...')
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const vendor of Object.values(FALLBACK_VENDORS)) {
    try {
      const [row] = await db
        .insert(aiVendorConfigs)
        .values({
          vendorCode: vendor.vendorCode,
          vendorName: vendor.vendorName,
          baseUrl: vendor.baseUrl,
          authType: vendor.authType,
          keyEnvName: vendor.keyEnvName,
          secretKeyEnvName: vendor.secretKeyEnvName,
          isEnabled: vendor.isEnabled,
          priority: vendor.priority,
        })
        .onConflictDoNothing({ target: aiVendorConfigs.vendorCode })
        .returning()

      if (row) {
        inserted++
        console.info(`  ✓ 已插入: ${vendor.vendorCode} (${vendor.vendorName})`)
      } else {
        skipped++
        console.info(`  - 已存在: ${vendor.vendorCode}`)
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ 失败: ${vendor.vendorCode} - ${msg}`)
    }
  }

  console.log(
    `[init-vendor-configs] 完成: 插入 ${inserted} 条，已存在 ${skipped} 条，失败 ${failed} 条`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[init-vendor-configs] 初始化异常:', err)
  process.exit(1)
})
