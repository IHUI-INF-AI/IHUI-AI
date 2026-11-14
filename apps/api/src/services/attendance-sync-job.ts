// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 定时 job(2026-11-13 立,backing service for hr-attendance-sync-daily)。
 *
 * 与现有全局 cron 不同:考勤凭证按 userId+platform 唯一,故本 job
 * 遍历「启用了飞书/钉钉适配器的用户」逐个拉取,产出暂存批次(走人工裁决/确认)。
 *
 * 安全边界:
 *   · 全局开关 systemConfigs.key='sync:attendance:enabled'(默认 'false')。
 *     默认关:端点未实现前不让 cron 空跑/报错;核实端点后置 true 开闸。
 *   · 单用户/单平台失败只记日志、计入 errors,不中断整批(避免一人配置错拖垮全部)。
 *   · 端点未实现(501 NOT_IMPLEMENTED)按「跳过」处理,不当作失败告警。
 */

import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { imAdapters, systemConfigs } from '@ihui/database'
import { runSyncForKind } from './attendance-sync/sync-runner.js'
import { readSyncCursor, writeSyncCursor } from './attendance-sync/sync-cursor.js'
import { writeLastRunStatus } from './attendance-sync/sync-status.js'
import { feishuProvider } from './attendance-sync/feishu-provider.js'
import { isAppError } from '../errors/AppError.js'
import type { AttendanceProvider, SyncKind } from './attendance-sync/types.js'

/** MVP 同步范围:飞书打卡 + 飞书请假(design §9 P1-MVP) */
const MVP_PROVIDERS: ReadonlyArray<{ provider: AttendanceProvider; kinds: readonly SyncKind[] }> = [
  { provider: feishuProvider, kinds: ['attendance', 'leave'] },
]

export interface AttendanceSyncJobResult {
  enabled: boolean
  scannedUsers: number
  attempted: number
  syncedBatches: number
  skippedNotImplemented: number
  errors: string[]
}

const ENABLE_KEY = 'sync:attendance:enabled'

async function isSyncEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, ENABLE_KEY))
    .limit(1)
  return row?.value === 'true'
}

/** 本月 YYYY-MM(cron 每日跑,拉当月增量) */
function currentPeriodMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export async function runAttendanceSyncJob(): Promise<AttendanceSyncJobResult> {
  const errors: string[] = []
  const enabled = await isSyncEnabled()
  if (!enabled) {
    const disabled: AttendanceSyncJobResult = {
      enabled: false,
      scannedUsers: 0,
      attempted: 0,
      syncedBatches: 0,
      skippedNotImplemented: 0,
      errors,
    }
    await writeLastRunStatus(disabled).catch(() => {
      /* 状态写入失败不阻塞主流程(cron 日志已记运行结果) */
    })
    return disabled
  }

  // 遍历启用了飞书/钉钉适配器的用户(考勤凭证按 userId+platform 唯一)
  const adapters = await db
    .select({ userId: imAdapters.userId, platform: imAdapters.platform })
    .from(imAdapters)
    .where(eq(imAdapters.enabled, true))

  const mvpPlatforms = new Set(MVP_PROVIDERS.map((p) => p.provider.source))
  const candidateAdapters = adapters.filter((a) =>
    mvpPlatforms.has(a.platform as 'feishu' | 'dingtalk' | 'wecom'),
  )

  // 同一用户多平台去重:按 userId 聚合
  const userIds = [...new Set(candidateAdapters.map((a) => a.userId))]
  const periodMonth = currentPeriodMonth()

  let attempted = 0
  let syncedBatches = 0
  let skippedNotImplemented = 0

  for (const userId of userIds) {
    for (const { provider, kinds } of MVP_PROVIDERS) {
      if (provider.source !== 'feishu') continue // MVP 仅飞书;钉钉 provider 落地后放开
      for (const kind of kinds) {
        attempted++
        try {
          const cursor = await readSyncCursor(userId, provider.source, kind)
          const result = await runSyncForKind({
            provider,
            importKind: kind,
            periodMonth,
            userId,
            cursor,
          })
          if (result.nextCursor) {
            await writeSyncCursor(userId, provider.source, kind, result.nextCursor)
          }
          if (result.batchId) syncedBatches++
        } catch (err) {
          // 端点未实现 → 跳过(不告警,等核实端点后自然跑通)
          if (isAppError(err) && err.errorCode === 'SYNC_FEISHU_NOT_IMPLEMENTED') {
            skippedNotImplemented++
            continue
          }
          // 409 重复(同批数据已同步过)→ 正常,不计错误
          if (isAppError(err) && err.errorCode === 'IMPORT_DUPLICATE_FILE') continue
          // 适配器未启用/缺凭证 → 该平台配置问题,记日志跳过
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${provider.source}/${kind}/user=${userId}: ${msg}`)
        }
      }
    }
  }

  const result: AttendanceSyncJobResult = {
    enabled: true,
    scannedUsers: userIds.length,
    attempted,
    syncedBatches,
    skippedNotImplemented,
    errors,
  }
  // 写运维状态(最近一次运行);失败不阻塞主流程(cron 日志已记运行结果)
  await writeLastRunStatus(result).catch(() => {
    /* 最佳努力 */
  })
  return result
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
