// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 零星保留策略清理作业(门 121 接线,2026-11-01 立)。
 *
 * 背景:下面四族的保留策略早就写在各自模块里,唯一缺的是触发点 —— 声明存在、执行从未发生:
 * - captchas                        过期验证码(db/captcha-queries.ts)
 * - api_key_shares                  已撤销 / 到期超 30 天的临时分享(services/api-key-share-service.ts)
 * - ai_relay_channel_daily_usage    USAGE_RETENTION_DAYS 天前的渠道日用量(services/channel-quota-service.ts)
 * - storage/cache                   带 .ttl sidecar 的过期文件缓存(services/storage-service.ts)
 *
 * 形态逐字照抄 jobs/pii-retention-cleanup.ts:node-cron + start/stop 成对导出,启动侧挂
 * index.ts 的 startBackgroundSchedulers(蓝绿活跃色独占那一支),关闭侧挂 shutdown 相位清单。
 * 四族合进**一枚**计时器:每天 05:30 (Asia/Shanghai) 跑一轮,错开既有 03:30 PII / 04:15
 * llm-purge / 04:30 archive / 04:45 审计证据与代码索引 / 05:00 vip-expire / 06:00 佣金结算。
 *
 * 批上界与各族的删除语义不在本层复述(见各自实现);本层只管"由谁在什么时候调"、
 * 逐族计数上报与单族失败不阻塞其余三族。
 */

import cron, { type ScheduledTask } from 'node-cron'
import { cleanupExpiredCaptchas } from '../db/captcha-queries.js'
import { cleanupExpired as cleanupExpiredShares } from '../services/api-key-share-service.js'
import { resetDailyQuota } from '../services/channel-quota-service.js'
import { cleanupCache } from '../services/storage-service.js'
import { logger } from '../utils/logger.js'

/** 本作业覆盖的保留策略目标(日志与用例断言共用的稳定标识)。 */
export type OpsRetentionTarget =
  'captchas' | 'api_key_shares' | 'ai_relay_channel_daily_usage' | 'storage_cache'

/** 单族运行结果:cleaned 为删除条数/清理文件数;失败族记 error 且不吞其余族。 */
export interface OpsRetentionTargetResult {
  target: OpsRetentionTarget
  cleaned: number
  status: 'success' | 'error'
}

/** 一轮跑完四族(顺序无关,各族自带批上界与短批即止)。 */
export async function runOpsRetentionCleanup(): Promise<OpsRetentionTargetResult[]> {
  const jobs: Array<[OpsRetentionTarget, () => number | Promise<number>]> = [
    ['captchas', cleanupExpiredCaptchas],
    ['api_key_shares', cleanupExpiredShares],
    ['ai_relay_channel_daily_usage', resetDailyQuota],
    ['storage_cache', cleanupCache],
  ]
  const results = await Promise.all(
    jobs.map(async ([target, run]): Promise<OpsRetentionTargetResult> => {
      try {
        return { target, cleaned: await run(), status: 'success' }
      } catch (err) {
        logger.warn(`[ops-retention] ${target} 清理失败(已跳过): ${(err as Error).message}`)
        return { target, cleaned: 0, status: 'error' }
      }
    }),
  )
  for (const r of results) {
    logger.info(`[ops-retention] ${r.target}: cleaned=${r.cleaned} status=${r.status}`)
  }
  return results
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

export function startOpsRetentionScheduler(): void {
  if (scheduledTask) return
  // 每天 05:30 (Asia/Shanghai) 一轮,四族共用这张日批面(不各开一枚计时器)
  scheduledTask = cron.schedule(
    '30 5 * * *',
    async () => {
      try {
        const results = await runOpsRetentionCleanup()
        const ok = results.filter((r) => r.status === 'success').length
        logger.info(`[ops-retention] done: ${ok}/${results.length} targets ok`)
      } catch (err) {
        logger.error('[ops-retention] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[ops-retention] scheduler started (cron: "30 5 * * *" Asia/Shanghai)')
}

export function stopOpsRetentionScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
