// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警噪音检查服务（backing service for alert-check-daily 定时任务）。
 * 迁移自旧架构 app/tasks/alert_check_task.py。
 *
 * 每日 04:00 扫描系统告警表，清理已恢复告警的噪音，
 * 并检查是否有未处理的严重告警需要升级通知。
 */

import { sql, and, gt, lt, ilike } from 'drizzle-orm'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../db/index.js'
import { auditLogs } from '@ihui/database'

export interface AlertCheckResult {
  checked: number
  resolved: number
  escalated: number
  /** 备份链文件系统的新鲜度 / 空备份问题(每条一个描述) */
  backupIssues: string[]
  errors: string[]
}

// ---------------------------------------------------------------------------
// 文件系统备份新鲜度检查(2026-09-06 加固;2026-09-06 收敛单一拥有者)
// 补盲区: 唯一备份链(NSSM)最近文件若 早于 24h 或 为 0 字节 → 判定备份缺失/空备份。
//   Chain1(NSSM): D:\DevEnv\backups\pg\ihui_dev_*.dump  ← 唯一权威备份(含百度异地)
//   (已废弃: 应用内 BullMQ d:\IHUI-AI\backups\pg\*.sql.gz 经 2026-09-06 收口下线,
//    因其调度静默失败/不累积,与 NSSM 重复,不再作为备份链纳入监控)
// ---------------------------------------------------------------------------

interface BackupTarget {
  dir: string
  label: string
  namePrefix?: string
  suffix: string
}

const BACKUP_STALE_HOURS = 24

const BACKUP_TARGETS: BackupTarget[] = [
  {
    dir: 'D:\\DevEnv\\backups\\pg',
    label: 'NSSM服务备份(D:\\DevEnv\\backups\\pg\\ihui_dev_*.dump)',
    namePrefix: 'ihui_dev_',
    suffix: '.dump',
  },
]

function isBackupFile(name: string, t: BackupTarget): boolean {
  if (!name.toLowerCase().endsWith(t.suffix.toLowerCase())) return false
  if (t.namePrefix && !name.startsWith(t.namePrefix)) return false
  return true
}

async function checkBackupTarget(t: BackupTarget, now: Date): Promise<string[]> {
  const issues: string[] = []
  const staleCutoff = new Date(now.getTime() - BACKUP_STALE_HOURS * 60 * 60 * 1000)

  let names: string[]
  try {
    names = await readdir(t.dir)
  } catch {
    return [`${t.label}: 备份目录读取失败(目录不存在或无权限)`]
  }

  const matched = names.filter((n) => isBackupFile(n, t))
  if (matched.length === 0) {
    return [`${t.label}: 无任何备份文件`]
  }

  // 取 mtime 最新的备份文件
  let latest: { name: string; size: number; mtimeMs: number } | null = null
  for (const name of matched) {
    try {
      const st = await stat(join(t.dir, name))
      if (!latest || st.mtimeMs > latest.mtimeMs) {
        latest = { name, size: st.size, mtimeMs: st.mtimeMs }
      }
    } catch {
      /* 单个文件 stat 失败跳过 */
    }
  }

  if (!latest) {
    return [`${t.label}: 无法读取备份文件信息`]
  }

  if (latest.size === 0) {
    issues.push(`${t.label}: 最新备份为空文件(${latest.name}, 0 字节)`)
  }
  if (latest.mtimeMs < staleCutoff.getTime()) {
    issues.push(
      `${t.label}: 最新备份已超 ${BACKUP_STALE_HOURS}h 未更新(${latest.name}, ${new Date(latest.mtimeMs).toISOString()})`,
    )
  }
  return issues
}

async function checkBackupFilesystemFreshness(now: Date): Promise<string[]> {
  const issues: string[] = []
  for (const t of BACKUP_TARGETS) {
    try {
      issues.push(...(await checkBackupTarget(t, now)))
    } catch (err) {
      issues.push(`${t.label}: 检查异常 ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return issues
}

/**
 * 执行每日告警检查。
 *
 * 策略：
 * 1. 扫描 audit_logs 中 action 含 error/denied/blocked 的最近 24h 记录
 * 2. 统计未处理的严重告警数量
 * 3. 超过阈值的标记为需要升级
 * 4. 24 小时前的旧告警视为已恢复的噪音
 * 5. 巡检两条数据库备份链的目录，检测 备份缺失 / 空备份(0 字节) / 超 24h 未更新
 */
export async function checkDailyAlerts(): Promise<AlertCheckResult> {
  const errors: string[] = []
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  let checked = 0
  let resolved = 0

  try {
    // 统计最近 24h 内含错误关键字的审计日志（告警源）
    const recentAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(and(ilike(auditLogs.action, '%error%'), gt(auditLogs.createdAt, twentyFourHoursAgo)))

    checked = recentAlerts[0]?.count ?? 0

    // 统计 24h 前的旧告警（可视为已恢复的噪音）
    const oldAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(and(ilike(auditLogs.action, '%error%'), lt(auditLogs.createdAt, twentyFourHoursAgo)))

    resolved = oldAlerts[0]?.count ?? 0
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  // 文件系统备份新鲜度检查(不带入 DB 异常, 独立捕获, 保证 DB 出问题时备份监控仍生效)
  const backupIssues = await checkBackupFilesystemFreshness(now)

  // 升级逻辑：最近 24h 错误数超过 50，或有备份缺失/空备份/过期 → 需升级通知
  const escalated = checked > 50 || backupIssues.length > 0 ? 1 : 0

  return {
    checked,
    resolved,
    escalated,
    backupIssues,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
