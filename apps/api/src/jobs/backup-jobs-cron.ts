// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据库备份定时调度(2026-09-16 立,补强 V)。
 *
 * node-cron 按 backup_settings.cronExpr 调度 runBackupCronTick(内部读 enabled)。
 * settings 更新后调用 restartBackupCron() 重载表达式;启停成对接入 src/index.ts。
 */
import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../utils/logger.js'
import { getBackupSettings, runBackupCronTick } from '../services/backup-jobs-service.js'

let scheduledTask: ScheduledTask | null = null

/**
 * 按表达式建任务(先 validate 再 schedule)。
 * 失败(非法表达式/创建抛错)返回 null 且 **不改动** scheduledTask,
 * 调用方可据此保留旧调度,避免"新表达式不合法 ⇒ 把自己停掉 ⇒ 永久停摆"。
 */
function scheduleWith(expr: string): ScheduledTask | null {
  if (!cron.validate(expr)) {
    logger.error('[backup] cron 表达式非法,拒绝调度(保留既有调度)', { cronExpr: expr })
    return null
  }
  try {
    const task = cron.schedule(
      expr,
      async () => {
        try {
          const ok = await runBackupCronTick()
          if (!ok) logger.info('[backup] 定时 tick:未启用或执行失败(见日志)')
        } catch (e) {
          logger.error('[backup] 定时 tick 异常', { err: e instanceof Error ? e.message : String(e) })
        }
      },
      { timezone: 'Asia/Shanghai' },
    )
    logger.info(`[backup] cron scheduler started (cron: "${expr}" Asia/Shanghai)`)
    return task
  } catch (e) {
    logger.error('[backup] cron 调度创建失败,保留既有调度', {
      cronExpr: expr,
      err: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** 启动调度(读 settings.cronExpr;enabled=false 时仅记录不调度)。 */
export async function startBackupCronScheduler(): Promise<void> {
  if (scheduledTask) return
  const settings = await getBackupSettings().catch((e) => {
    logger.error('[backup] 读取备份配置失败,调度器未启动', {
      err: e instanceof Error ? e.message : String(e),
    })
    return null
  })
  if (!settings?.enabled) {
    logger.info('[backup] 定时备份未启用,跳过调度(startBackupCronScheduler 仍可手动调用)')
    return
  }
  const task = scheduleWith(settings.cronExpr)
  if (!task) {
    // 库里已有非法表达式(历史脏数据)时:显式告警,而不是静默无调度。
    logger.error('[backup] 调度器未启动:backup_settings.cronExpr 非法,请 PATCH /api/admin/backup-jobs/settings 修正')
    return
  }
  scheduledTask = task
}

/**
 * settings 更新后重载表达式(PATCH settings 接线处调用)。
 * 顺序:先读配置 → 先建新任务成功 → 才停旧任务;任一步失败都保留旧任务继续跑。
 */
export async function restartBackupCron(): Promise<void> {
  const settings = await getBackupSettings().catch((e) => {
    logger.error('[backup] 重载调度失败:读取备份配置异常,保留既有调度', {
      err: e instanceof Error ? e.message : String(e),
    })
    return null
  })
  // 读不到配置时不停旧任务:停掉就再也没人拉起来。
  if (!settings) return
  if (!settings.enabled) {
    stopBackupCronScheduler()
    return
  }
  const next = scheduleWith(settings.cronExpr)
  if (!next) return // 非法表达式/创建失败:保留旧任务继续跑,避免停摆
  const prev = scheduledTask
  scheduledTask = next
  if (prev) {
    prev.stop()
    logger.info('[backup] cron scheduler restarted')
  }
}

export function stopBackupCronScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('[backup] cron scheduler stopped')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
