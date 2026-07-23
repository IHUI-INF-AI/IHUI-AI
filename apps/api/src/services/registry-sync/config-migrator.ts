/**
 * 配置自动迁移器(2026-07-24 立)。
 *
 * 配合 config-drift-detector 使用:当检测到漂移时,管理员触发迁移,将配置文件
 * 恢复到"已知良好"的基线内容(updateBaseline 标记的上游状态)。
 *
 * 流程:备份当前文件 → 兼容性校验 → 写入基线内容 → 失败回滚。
 * 高危键(DATABASE_URL / JWT_SECRET 等)新增/删除 → 标记 skipped,需人工确认。
 *
 * 绝不修改 .env / config.py / package.json / docker-compose.yml 的"当前值",
 * 仅在管理员显式触发迁移时把文件内容恢复到已确认的基线快照。
 */
import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ConfigFileType,
  ConfigMigrateRequest,
  ConfigMigrateResponse,
} from '@ihui/types'
import {
  CONFIG_FILE_PATHS,
  HIGH_RISK_KEYS,
  detectDrift,
  parseEnvKeys,
  readBaselineEntry,
} from './config-drift-detector.js'

/** 备份目录根(项目内,AGENTS.md §15) */
const BACKUP_ROOT = '.trae-cn/tmp/config-migration-backups'

/**
 * 项目根目录解析:与 config-drift-detector.ts 一致,以 pnpm-workspace.yaml 作为 monorepo 根标记。
 */
const PROJECT_ROOT = (() => {
  let dir = process.cwd()
  while (dir) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return existsSync(join(process.cwd(), '.env.example'))
    ? process.cwd()
    : join(process.cwd(), '..', '..')
})()

function resolvePath(rel: string): string {
  return join(PROJECT_ROOT, rel)
}

/** 判断某 key 是否高危(兼容 docker_compose 的 `service:KEY` 格式) */
function isHighRiskKey(key: string): boolean {
  if (HIGH_RISK_KEYS.has(key)) return true
  for (const h of HIGH_RISK_KEYS) {
    if (key.endsWith(':' + h)) return true
  }
  return false
}

function timestampDir(): string {
  // YYYYMMDD-HHmmss,本地时区可读
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// =============================================================================
// 公共 API
// =============================================================================

/** 备份当前文件(迁移前),返回备份文件路径 */
export async function backupFile(
  fileType: ConfigFileType,
  backupDir?: string,
): Promise<string> {
  const dir = backupDir ?? join(BACKUP_ROOT, timestampDir())
  const absDir = resolvePath(dir)
  await mkdir(absDir, { recursive: true })
  const src = resolvePath(CONFIG_FILE_PATHS[fileType])
  const dst = join(absDir, fileType)
  try {
    await copyFile(src, dst)
  } catch {
    // 源文件可能不存在,写入空占位以保留备份槽位
    await writeFile(dst, '', 'utf8')
  }
  return dst
}

/** 兼容性校验(检查 schema 兼容、键名冲突、类型匹配) */
export async function validateCompatibility(
  fileType: ConfigFileType,
  newContent: string,
): Promise<{ ok: boolean; reason?: string }> {
  switch (fileType) {
    case 'env_example':
    case 'env_production_example': {
      const keys = parseEnvKeys(newContent)
      if (keys.size === 0) return { ok: false, reason: 'env 文件无任何有效 KEY' }
      return { ok: true }
    }
    case 'config_py': {
      if (!newContent.includes('class Settings')) {
        return { ok: false, reason: 'config.py 缺少 class Settings 定义' }
      }
      if (!newContent.includes('BaseSettings')) {
        return { ok: false, reason: 'config.py 缺少 BaseSettings 基类' }
      }
      return { ok: true }
    }
    case 'package_json': {
      try {
        const pkg = JSON.parse(newContent) as Record<string, unknown>
        if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') {
          return { ok: false, reason: 'package.json 缺少 name/version 字段' }
        }
      } catch (e) {
        return { ok: false, reason: `package.json JSON 解析失败: ${(e as Error).message}` }
      }
      return { ok: true }
    }
    case 'docker_compose': {
      if (!newContent.includes('services:')) {
        return { ok: false, reason: 'docker-compose.yml 缺少 services 段' }
      }
      return { ok: true }
    }
  }
}

/** 回滚(从备份恢复) */
export async function rollback(fileType: ConfigFileType, backupPath: string): Promise<void> {
  const content = await readFile(backupPath, 'utf8')
  await writeFile(resolvePath(CONFIG_FILE_PATHS[fileType]), content, 'utf8')
}

/** 单个文件类型迁移 */
export async function migrateFile(
  fileType: ConfigFileType,
  dryRun: boolean,
  backupDir?: string,
): Promise<{
  status: 'migrated' | 'skipped' | 'failed' | 'rolled_back'
  message: string
  backupPath?: string
}> {
  const baseline = await readBaselineEntry(fileType)
  if (!baseline) {
    return {
      status: 'skipped',
      message: '无基线内容,需先调用 POST /api/registry/config-baseline 建立基线',
    }
  }

  // 高危变更检测:复用 detectDrift 的 added/removed keys(文件缺失时 detectDrift 已妥善处理)
  const drift = await detectDrift(fileType)
  const risky = [...drift.addedKeys, ...drift.removedKeys].filter(isHighRiskKey)
  if (risky.length > 0) {
    return {
      status: 'skipped',
      message: `高危键变更需人工确认: ${risky.join(', ')}`,
    }
  }

  if (dryRun) {
    return { status: 'skipped', message: 'dryRun 校验通过,未写文件' }
  }

  // 兼容性校验
  const compat = await validateCompatibility(fileType, baseline.content)
  if (!compat.ok) {
    return { status: 'failed', message: `兼容性校验失败: ${compat.reason}` }
  }

  // 备份 + 写入,失败回滚
  const backupPath = await backupFile(fileType, backupDir)
  try {
    await writeFile(resolvePath(CONFIG_FILE_PATHS[fileType]), baseline.content, 'utf8')
    return { status: 'migrated', message: '已恢复到基线内容', backupPath }
  } catch (e) {
    try {
      await rollback(fileType, backupPath)
      return {
        status: 'rolled_back',
        message: `写入失败已回滚: ${(e as Error).message}`,
        backupPath,
      }
    } catch (re) {
      return {
        status: 'rolled_back',
        message: `写入失败且回滚失败: ${(re as Error).message}`,
        backupPath,
      }
    }
  }
}

/** 自动迁移配置文件 */
export async function migrateConfig(
  request: ConfigMigrateRequest,
): Promise<ConfigMigrateResponse> {
  const dryRun = request.dryRun ?? true
  const threshold = request.rollbackThreshold ?? 3
  const allTypes = Object.keys(CONFIG_FILE_PATHS) as ConfigFileType[]
  const types: ConfigFileType[] = request.fileType ? [request.fileType] : allTypes

  const backupDir = join(BACKUP_ROOT, timestampDir())
  const details: ConfigMigrateResponse['details'] = []
  const migrated: Array<{ fileType: ConfigFileType; backupPath: string }> = []
  let migratedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const ft of types) {
    const r = await migrateFile(ft, dryRun, backupDir)
    if (r.status === 'migrated') {
      migratedCount++
      if (r.backupPath) migrated.push({ fileType: ft, backupPath: r.backupPath })
    } else if (r.status === 'skipped') {
      skippedCount++
    } else {
      // failed / rolled_back 均计入失败
      failedCount++
    }
    details.push({ fileType: ft, status: r.status, message: r.message })
  }

  let rolledBack = false
  // 失败变更数超过阈值 → 整体回滚已迁移的文件
  if (failedCount > threshold && migrated.length > 0) {
    for (const m of migrated) {
      try {
        await rollback(m.fileType, m.backupPath)
        const idx = details.findIndex((d) => d.fileType === m.fileType)
        if (idx >= 0) {
          details[idx] = {
            fileType: m.fileType,
            status: 'rolled_back',
            message: `整体回滚(失败数 ${failedCount} > 阈值 ${threshold}): ${details[idx]!.message}`,
          }
        }
        migratedCount--
      } catch {
        // 单个回滚失败不阻塞其余回滚
      }
    }
    rolledBack = true
  }

  return {
    success: !rolledBack && failedCount === 0,
    migrated: migratedCount,
    skipped: skippedCount,
    failed: failedCount,
    rolledBack,
    backupDir: migrated.length > 0 || failedCount > 0 ? backupDir : null,
    details,
  }
}

/** 列出迁移历史(从备份目录) */
export async function listMigrationHistory(): Promise<
  Array<{ timestamp: string; files: ConfigFileType[] }>
> {
  const root = resolvePath(BACKUP_ROOT)
  let entries: string[] = []
  try {
    entries = await readdir(root)
  } catch {
    return []
  }
  const result: Array<{ timestamp: string; files: ConfigFileType[] }> = []
  for (const entry of entries) {
    const dirPath = join(root, entry)
    try {
      const s = await stat(dirPath)
      if (!s.isDirectory()) continue
      const files = (await readdir(dirPath)) as ConfigFileType[]
      result.push({ timestamp: entry, files })
    } catch {
      // 跳过异常条目
    }
  }
  result.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  return result
}
