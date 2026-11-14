// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 零价模型巡检调度(2026-11-14 立)。
 *
 * 背景:workbuddy 23 个模型 10-23 上架、11-13 才定价,期间 4198 次调用按 0 记账。
 * 上架接口已加"零价不可上架"护栏,本 job 负责兜住历史遗留与绕过接口直接改库的情况:
 * 每天 09:00(Asia/Shanghai)扫一次「已上架但零价」「近 7 天有调用但零价」,
 * 命中即 warn 日志(带漏计费金额与前 10 名),零命中只记 info。
 *
 * 形态照抄 jobs/hr-jobs-cron.ts:node-cron + start/stop 成对导出。
 * ENABLE_PRICING_GUARD=false 禁用。
 */
import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../utils/logger.js'
import { getUnpricedAlerts, syncConfigPricesFromPricing } from '../services/model-pricing-admin.js'
import { repricePlaceholderModels } from '../services/model-price-resolver.js'
import { upsertPricing } from '../services/pricing-service.js'
import { db } from '../db/index.js'

let task: ScheduledTask | null = null

export function startPricingGuardScheduler(): void {
  if (task) return
  if (process.env.ENABLE_PRICING_GUARD === 'false') {
    logger.info('[pricing-guard] ENABLE_PRICING_GUARD=false,跳过调度')
    return
  }
  task = cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        // 1) 先把占位价(1分/2分)与负价哨兵修正为权威价,拿不到权威价的下架。
        //    这一步必须排在配置价同步之前,否则占位价会被下一段当成"已有价"而放过。
        const repriced = await repricePlaceholderModels(
          db as unknown as { execute: (q: unknown) => Promise<unknown> },
          upsertPricing,
        )
        logger.info('[pricing-guard] 占位价重定价', {
          scanned: repriced.scanned,
          repriced: repriced.repriced,
          delisted: repriced.delisted.length,
          byTier: repriced.byTier,
        })
        // 2) 再以 ai_pricing 权威价回填配置零价行,否则会把"实际有价、配置为 0"
        //    的模型重复报成缺口(2026-11-14 实测 565 行属此类)。
        const synced = await syncConfigPricesFromPricing()
        logger.info('[pricing-guard] 配置价预同步', {
          scanned: synced.scanned,
          updated: synced.updated,
          skipped: synced.skipped,
        })
        // 3) 最后巡检
        const r = await getUnpricedAlerts(7)
        if (r.publishedUnpriced > 0 || r.callingUnpriced > 0) {
          logger.warn('[pricing-guard] 零价模型告警', {
            publishedUnpriced: r.publishedUnpriced,
            callingUnpriced: r.callingUnpriced,
            estimatedCostCents: r.estimatedCostCents,
            top: r.rows
              .slice(0, 10)
              .map((x) => `${x.modelId}: calls=${x.calls}, cost=${x.estimatedCostCents}`),
          })
        } else {
          logger.info('[pricing-guard] 零价巡检通过(无在架零价、无零价调用)')
        }
      } catch (e) {
        logger.error('[pricing-guard] tick 异常', {
          err: e instanceof Error ? e.message : String(e),
        })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[pricing-guard] cron started ("0 9 * * *" Asia/Shanghai)')
}

export function stopPricingGuardScheduler(): void {
  if (task) {
    task.stop()
    task = null
    logger.info('[pricing-guard] cron scheduler stopped')
  }
}
