/**
 * 启动钩子：AI 厂商配置自动初始化（R4 重构产物）。
 *
 * 职责：
 * - 服务启动后异步将 FALLBACK_VENDORS 写入 ai_vendor_configs（onConflictDoNothing 幂等）
 * - 数据库不可用 / 表不存在时静默降级（记录 warn 后继续）
 * - 不阻塞 listen，void 异步执行
 *
 * 启用方式：通过环境变量 ENABLE_VENDOR_INIT=false 可禁用（用于不需要此行为的实例）
 */
import { db } from '../db/index.js'
import { aiVendorConfigs } from '@ihui/database'
import { FALLBACK_VENDORS } from '../services/ai-vendor-config-service.js'
import type { FastifyBaseLogger } from 'fastify'

export async function initVendorConfigs(log: FastifyBaseLogger): Promise<void> {
  if (process.env.ENABLE_VENDOR_INIT === 'false') {
    log.info('[init-vendor-configs] 已通过 ENABLE_VENDOR_INIT=false 禁用')
    return
  }

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
      } else {
        skipped++
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      // 第一次启动时如果表未迁移会失败（42P01 relation does not exist），
      // 这种情况下 caller service 会自动 fallback 到 FALLBACK_VENDORS，不影响业务
      log.warn({ vendor: vendor.vendorCode, err: msg }, '厂商配置插入失败（fallback 已就绪）')
    }
  }

  log.info(
    { inserted, skipped, failed, total: Object.keys(FALLBACK_VENDORS).length },
    '[init-vendor-configs] AI 厂商配置初始化完成',
  )
}
