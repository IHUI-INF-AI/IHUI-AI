/**
 * 文件清理服务。
 *
 * 迁移自旧架构 server/app/services/cleanup_service.py（FileCleanupService）。
 *
 * 设计：
 * - 定期清理 uploads/outputs 目录中的过期文件
 * - max_age: 文件最后修改时间超过 24 小时则删除
 * - max_size: 目录总大小超过 1024MB 时，按最久未访问顺序删除至阈值以下
 * - 由 scheduler-worker 每小时调度执行（BullMQ repeatable job）
 *
 * 零依赖实现，使用 node:fs 递归遍历。
 */

import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

/** 文件最大保留时长（小时）。 */
const MAX_AGE_HOURS = 24

/** 目录最大总大小（MB）。 */
const MAX_TOTAL_SIZE_MB = 1024

const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024

/** 待清理的目录列表。 */
const TARGET_DIRS = ['uploads', 'outputs']

export interface CleanupStats {
  uploadDir: string
  outputDir: string
  maxAgeHours: number
  maxSizeMb: number
  uploadsFiles: number
  uploadsSize: number
  outputsFiles: number
  outputsSize: number
}

export interface CleanupResult {
  scanned: number
  deletedByAge: number
  deletedBySize: number
  totalDeleted: number
  errors: string[]
}

interface FileEntry {
  path: string
  mtime: number
  size: number
}

/** 递归收集目录下所有文件（含子目录）。 */
function collectFiles(directory: string): FileEntry[] {
  if (!existsSync(directory)) return []
  const result: FileEntry[] = []
  const stack: string[] = [directory]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of entries) {
      const fullPath = join(dir, name)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          stack.push(fullPath)
        } else {
          result.push({ path: fullPath, mtime: stat.mtimeMs, size: stat.size })
        }
      } catch {
        /* 无法访问的文件跳过 */
      }
    }
  }
  return result
}

/** 计算目录总大小（字节）。 */
function getTotalSize(files: FileEntry[]): number {
  return files.reduce((sum, f) => sum + f.size, 0)
}

/** 删除单个文件，失败时记录错误。 */
function safeDelete(filePath: string, errors: string[]): boolean {
  try {
    unlinkSync(filePath)
    return true
  } catch (e) {
    errors.push(`${filePath}: ${(e as Error).message}`)
    return false
  }
}

/**
 * 执行一轮文件清理。
 *
 * 对 uploads 与 outputs 目录分别：
 * 1. 删除超过 max_age 的过期文件
 * 2. 若总大小仍超 max_size，按最旧优先删除至阈值以下
 *
 * @returns 清理统计 { scanned, deletedByAge, deletedBySize, totalDeleted, errors }
 */
export async function runFileCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    scanned: 0,
    deletedByAge: 0,
    deletedBySize: 0,
    totalDeleted: 0,
    errors: [],
  }

  const now = Date.now()
  const ageCutoff = now - MAX_AGE_MS

  for (const dir of TARGET_DIRS) {
    const files = collectFiles(dir)
    result.scanned += files.length

    // 1. 按时间清理过期文件
    for (const f of files) {
      if (f.mtime < ageCutoff) {
        if (safeDelete(f.path, result.errors)) {
          result.deletedByAge += 1
          f.size = 0 // 标记已删，避免后续重复计入
        }
      }
    }

    // 2. 按大小清理（重新收集未删除文件）
    const remaining = collectFiles(dir)
    let totalSize = getTotalSize(remaining)
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      // 按最旧优先排序
      remaining.sort((a, b) => a.mtime - b.mtime)
      for (const f of remaining) {
        if (totalSize <= MAX_TOTAL_SIZE_BYTES) break
        if (safeDelete(f.path, result.errors)) {
          totalSize -= f.size
          result.deletedBySize += 1
        }
      }
    }
  }

  result.totalDeleted = result.deletedByAge + result.deletedBySize
  return result
}

/** 获取清理服务配置与当前目录状态统计（供监控端点使用）。 */
export function getCleanupStats(): CleanupStats {
  const uploads = collectFiles('uploads')
  const outputs = collectFiles('outputs')
  return {
    uploadDir: 'uploads',
    outputDir: 'outputs',
    maxAgeHours: MAX_AGE_HOURS,
    maxSizeMb: MAX_TOTAL_SIZE_MB,
    uploadsFiles: uploads.length,
    uploadsSize: getTotalSize(uploads),
    outputsFiles: outputs.length,
    outputsSize: getTotalSize(outputs),
  }
}
