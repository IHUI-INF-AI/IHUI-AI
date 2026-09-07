// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * PII 保留期清理任务（P0 隐私修复 / GDPR 最小化原则）。
 *
 * 背景：账号注销需删除权，但用户留下的行为/访问/崩溃数据若不按保留期清理，
 * 将持续留存可关联的 PII（ip / userAgent / 观看记录 / URL 等），违反「存储最小化」。
 *
 * 本任务按保留期滚动删除高敏、高增长、非核心业务所必需的日志类 PII：
 * - crash_reports          崩溃报告（含用户堆栈/device）  默认保留 90 天
 * - behavior_watch_records 观看行为记录（user_id + 标题）  默认保留 180 天
 * - visit_logs             访问埋点（ip + UA + 来源）     默认保留 180 天
 *
 * 每批限量删除(避免锁表/长事务)，批次间不 sleep（本地 delete 极快，量小）。
 * 幂等：重复运行只删到界点为止，不报错。开启/关停通过 ENABLE_PII_RETENTION 控制，
 * 保留天数通过 CRASH_RETENTION_DAYS / BEHAVIOR_RETENTION_DAYS / VISIT_RETENTION_DAYS 覆盖。
 */

import cron, { type ScheduledTask } from 'node-cron'
import { lt, inArray } from 'drizzle-orm'
import {
  crashReports,
  behaviorWatchRecords,
  visitLogs,
} from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

const BATCH_LIMIT = 1000

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function retentionOf(envKey: string, fallback: number): number {
  const raw = process.env[envKey]
  const n = raw ? Number(raw) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** 从单表按时间戳字段分批删除过期记录，返回删除行数。 */
async function purgeExpired(
  label: string,
  table: any,
  timestampCol: any,
  retentionDays: number,
): Promise<number> {
  let deleted = 0
  const cutoff = daysAgo(retentionDays)
  // 遍历主键批次：先取一批待删主键，再按主键删除，避免持锁过久 / 一删全表锁。
  while (true) {
    const rows = (await db
      .select({ id: table.id })
      .from(table)
      .where(lt(timestampCol, cutoff))
      .limit(BATCH_LIMIT)) as Array<{ id: string }>
    if (rows.length === 0) break
    await db.delete(table).where(inArray(table.id, rows.map((r) => r.id)))
    deleted += rows.length
  }
  if (deleted > 0) logger.info(`[pii-retention] ${label}: 清理 ${deleted} 条(保留 ${retentionDays} 天)`)
  return deleted
}

/**
 * 保留期清理入口：滚动删除过期 PII 日志类数据。
 * 每张表独立 try/catch，单表失败不阻塞其余。
 */
export async function runPiiRetentionCleanup(): Promise<
  Array<{ target: string; deleted: number; status: 'success' | 'error' }>
> {
  const jobs: Array<[string, any, any, number]> = [
    ['crash_reports', crashReports, crashReports.createdAt, retentionOf('CRASH_RETENTION_DAYS', 90)],
    ['behavior_watch_records', behaviorWatchRecords, behaviorWatchRecords.updatedAt, retentionOf('BEHAVIOR_RETENTION_DAYS', 180)],
    ['visit_logs', visitLogs, visitLogs.createdAt, retentionOf('VISIT_RETENTION_DAYS', 180)],
  ]
  const results = await Promise.all(
    jobs.map(async ([label, table, timestampCol, retentionDays]) => {
      try {
        const deleted = await purgeExpired(label, table, timestampCol, retentionDays)
        return { target: label, deleted, status: 'success' as const }
      } catch (err) {
        logger.warn(`[pii-retention] ${label} 清理失败(已跳过): ${(err as Error).message}`)
        return { target: label, deleted: 0, status: 'error' as const }
      }
    }),
  )
  return results
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

export function startPiiRetentionScheduler(): void {
  if (scheduledTask) return
  // 每天 03:30 (Asia/Shanghai) 跑一次，避开高峰与备份时段
  scheduledTask = cron.schedule(
    '30 3 * * *',
    async () => {
      try {
        const results = await runPiiRetentionCleanup()
        const ok = results.filter((r) => r.status === 'success').length
        logger.info(`[pii-retention] done: ${ok}/${results.length} targets ok`)
      } catch (err) {
        logger.error('[pii-retention] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[pii-retention] scheduler started (cron: "30 3 * * *" Asia/Shanghai)')
}

export function stopPiiRetentionScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}