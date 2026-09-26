// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据库备份作业服务(2026-09-16 立,深度对标补强 V,对标竞品 /backups + /s3/profiles)。
 *
 * 职责:
 * 1. runBackupNow — pg_dump | gzip 产物落地 + backup_jobs 记录 + 保留策略清理
 * 2. CRUD — 列表/设置(单行,无行自动建默认)/删除(记录+产物文件)
 * 3. runBackupCronTick — 定时调度入口(cron 由 backup-jobs-cron 驱动,读 enabled+cronExpr)
 *
 * 安全:
 * - name 白名单 [A-Za-z0-9_-]{1,64}(防 shell 注入/目录穿越)
 * - 全部产物路径 resolve 后必须 startWith backupDir(防穿越)
 * - 数据库口令经 PGPASSWORD 环境变量传子进程,不进 shell 字符串
 * - S3 远端上传留扩展点(backupDir 本地版完整可用,S3 凭据由运营配置后接入)
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { desc, eq, like } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { backupJobs, backupSettings, type BackupJob, type BackupSettings } from '@ihui/database'
import { logger } from '../utils/logger.js'

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

/** 读单行设置(无行自动建默认)。 */
export async function getBackupSettings(): Promise<BackupSettings> {
  const rows = await dbRead.select().from(backupSettings).limit(1)
  if (rows[0]) return rows[0] as BackupSettings
  const [created] = await db.insert(backupSettings).values({}).returning()
  return created as BackupSettings
}

export async function updateBackupSettings(patch: {
  enabled?: boolean
  cronExpr?: string
  keepCount?: number
  backupDir?: string
}): Promise<BackupSettings> {
  const current = await getBackupSettings()
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.enabled !== undefined) setData.enabled = patch.enabled
  if (patch.cronExpr !== undefined) setData.cronExpr = patch.cronExpr
  if (patch.keepCount !== undefined) setData.keepCount = patch.keepCount
  if (patch.backupDir !== undefined) setData.backupDir = patch.backupDir
  const [row] = await db
    .update(backupSettings)
    .set(setData)
    .where(eq(backupSettings.id, current.id))
    .returning()
  return row as BackupSettings
}

export async function listBackupJobs(limit = 50) {
  const rows = await dbRead
    .select()
    .from(backupJobs)
    .orderBy(desc(backupJobs.createdAt))
    .limit(Math.min(Math.max(1, limit), 200))
  return rows
}

/** 从 DATABASE_URL 解析 pg_dump 连接参数(不落日志)。 */
function parseDatabaseUrl(): {
  host: string
  port: string
  user: string
  dbname: string
  password: string
} | null {
  const raw = process.env.DATABASE_URL
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return null
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      dbname: decodeURIComponent(u.pathname.replace(/^\//, '')),
      password: decodeURIComponent(u.password ?? ''),
    }
  } catch {
    return null
  }
}

/** 保留策略:同前缀产物按 mtime 降序,删 keepCount 之外的文件与记录。 */
async function enforceRetention(dir: string, prefix: string, keepCount: number): Promise<void> {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.sql.gz'))
    .map((f) => {
      const p = path.join(dir, f)
      return { p, mtime: fs.statSync(p).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
  for (const stale of files.slice(Math.max(1, keepCount))) {
    try {
      fs.unlinkSync(stale.p)
    } catch {
      // 文件已清理/被外部移除,忽略
    }
    await db.delete(backupJobs).where(like(backupJobs.filePath, `%${stale.p}%`))
  }
}

/**
 * 执行一次备份(pg_dump | gzip)。
 * 返回作业行;内部异常落 failed 不抛出(调用方读返回值即可)。
 */
export async function runBackupNow(
  name: string,
  type: 'manual' | 'scheduled',
  createdBy: string,
): Promise<BackupJob | null> {
  // name 白名单校验(防 shell 注入/路径穿越;非法直接拒绝)
  if (!NAME_RE.test(name)) {
    logger.error('[backup] 非法备份名(仅允许 [A-Za-z0-9_-])', { name })
    return null
  }
  const conn = parseDatabaseUrl()
  if (!conn) {
    logger.error('[backup] DATABASE_URL 缺失或非 postgres 协议,备份无法执行')
    return null
  }
  const settings = await getBackupSettings()
  const dir = path.resolve(process.cwd(), settings.backupDir)
  fs.mkdirSync(dir, { recursive: true })

  const [job] = await db
    .insert(backupJobs)
    .values({ name, type, status: 'running', createdBy })
    .returning()
  if (!job) return null
  const startedAt = Date.now()

  try {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const fileName = `${name}-${stamp}.sql.gz`
    const filePath = path.join(dir, fileName)
    if (!filePath.startsWith(dir)) throw new Error('path_escape')

    const script = `pg_dump --host=${conn.host} --port=${conn.port} --username=${conn.user} --dbname=${conn.dbname} --no-password | gzip > "${filePath}"`
    await new Promise<void>((resolve, reject) => {
      execFile(
        'bash',
        ['-c', script],
        {
          timeout: 10 * 60_000,
          env: { ...process.env, PGPASSWORD: conn.password },
          maxBuffer: 8 * 1024 * 1024,
        },
        (err) => (err ? reject(err) : resolve()),
      )
    })
    const size = fs.statSync(filePath).size
    const durationMs = Date.now() - startedAt
    const [done] = await db
      .update(backupJobs)
      .set({
        status: 'succeeded',
        filePath,
        fileSizeBytes: size,
        durationMs,
        updatedAt: new Date(),
      })
      .where(eq(backupJobs.id, job.id))
      .returning()
    logger.info('[backup] 完成', { name, filePath, size, durationMs })
    await enforceRetention(dir, `${name}-`, settings.keepCount)
    return (done as Awaited<ReturnType<typeof listBackupJobs>>[number]) ?? null
  } catch (e) {
    const durationMs = Date.now() - startedAt
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .update(backupJobs)
      .set({ status: 'failed', error: msg.slice(0, 500), durationMs, updatedAt: new Date() })
      .where(eq(backupJobs.id, job.id))
    logger.error('[backup] 失败', { name, err: msg })
    return null
  }
}

export async function deleteBackupJob(
  id: string,
): Promise<{ deleted: boolean; fileRemoved: boolean }> {
  const [row] = await dbRead.select().from(backupJobs).where(eq(backupJobs.id, id)).limit(1)
  if (!row) return { deleted: false, fileRemoved: false }
  let fileRemoved = false
  if (row.filePath) {
    const settings = await getBackupSettings()
    const dir = path.resolve(process.cwd(), settings.backupDir)
    const p = path.resolve(row.filePath)
    if (p.startsWith(dir) && fs.existsSync(p)) {
      fs.unlinkSync(p)
      fileRemoved = true
    }
  }
  const removed = await db
    .delete(backupJobs)
    .where(eq(backupJobs.id, id))
    .returning({ id: backupJobs.id })
  return { deleted: removed.length > 0, fileRemoved }
}

/** 定时调度 tick(cron 驱动):读 enabled 决定是否执行。 */
export async function runBackupCronTick(): Promise<boolean> {
  const settings = await getBackupSettings()
  if (!settings.enabled) return false
  const r = await runBackupNow('scheduled-auto', 'scheduled', 'system')
  return r !== null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
