// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件清理服务。
 *
 * 迁移自旧架构 server/app/services/cleanup_service.py（FileCleanupService）。
 *
 * 设计：
 * - 定期清理临时/中间产物目录(uploads/chunks、uploads/tmp、outputs)中的过期文件
 * - max_age: 文件最后修改时间超过 24 小时则删除
 * - max_size: 目录总大小超过 1024MB 时，按最久未访问顺序删除至阈值以下
 * - 由 scheduler-worker 每小时调度执行（BullMQ repeatable job）
 *
 * 零依赖实现，使用 node:fs/promises 单趟遍历 + 有界并发，避免阻塞事件循环。
 */

import type { Dirent } from 'node:fs'
import { readdir, stat, unlink } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

/** 文件最大保留时长（小时）。 */
const MAX_AGE_HOURS = 24

/** 目录最大总大小（MB）。 */
const MAX_TOTAL_SIZE_MB = 1024

const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024

/** 单批并发 stat 数（有界，避免一次性占用过多文件句柄）。 */
const STAT_CONCURRENCY = 16

/** errors 最多保留的条数：权限异常时可产生海量失败，无上限会撑爆内存。 */
const MAX_RECORDED_ERRORS = 100

/**
 * 待清理的目录列表(2026-11-08,修 F-549):只收临时/中间产物。
 * `uploads/public`(合并成品,静态白名单对外)与 `uploads/private` 是已持久化、
 * 被 files 表引用的交付物,绝不能被"过期/超容量"扫描误删。
 */
const TARGET_DIRS = ['uploads/chunks', 'uploads/tmp', 'outputs']

/** 持久化目录保护前缀(相对 cwd):即使未来误把 uploads 根加入扫描,也不得删这两处。 */
const PROTECTED_PREFIXES = ['uploads/public', 'uploads/private']

function isProtectedPath(filePath: string): boolean {
  // 按解析后的路径做前缀判定(带路径分隔符)，而不是字符串 includes/裸 startsWith，
  // 避免 uploads/public-backup 之类同前缀目录被误判为受保护(或反之漏保护)。
  const absolute = resolve(filePath)
  return PROTECTED_PREFIXES.some((prefix) => {
    const protectedRoot = resolve(prefix)
    return absolute === protectedRoot || absolute.startsWith(protectedRoot + sep)
  })
}

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

/**
 * 递归单趟遍历目录(异步 + 有界并发)：目录用 readdir(withFileTypes) 展开，
 * 文件并发 stat 后交给 visit 处理；exclude 命中的路径(含目录)整棵跳过。
 */
async function walkFiles(
  directory: string,
  visit: (entry: FileEntry) => Promise<void> | void,
  exclude: (absolutePath: string) => boolean = () => false,
): Promise<void> {
  const stack: string[] = [directory]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (let i = 0; i < entries.length; i += STAT_CONCURRENCY) {
      const batch = entries.slice(i, i + STAT_CONCURRENCY)
      const visited = await Promise.all(
        batch.map(async (entry) => {
          const fullPath = join(dir, entry.name)
          // 不跟随符号链接(既不下钻也不删除)，避免越出清理目录边界。
          if (!entry.isDirectory() && !entry.isFile()) return null
          if (exclude(fullPath)) return null
          if (entry.isDirectory()) return { kind: 'dir' as const, path: fullPath }
          try {
            const info = await stat(fullPath)
            return {
              kind: 'file' as const,
              entry: { path: fullPath, mtime: info.mtimeMs, size: info.size },
            }
          } catch {
            return null
          }
        }),
      )
      for (const item of visited) {
        if (!item) continue
        if (item.kind === 'dir') {
          stack.push(item.path)
        } else {
          await visit(item.entry)
        }
      }
    }
  }
}

/** 计算目录总大小（字节）。 */
function getTotalSize(files: FileEntry[]): number {
  return files.reduce((sum, f) => sum + f.size, 0)
}

/** 删除单个文件：失败只记录(限量)并 warn，不中断整轮清理。 */
async function safeDelete(filePath: string, errors: string[]): Promise<boolean> {
  try {
    await unlink(filePath)
    return true
  } catch (e) {
    if (errors.length < MAX_RECORDED_ERRORS) {
      errors.push(`${filePath}: ${(e as Error).message}`)
    }
    console.warn('[cleanup] 删除文件失败，已跳过', filePath, (e as Error).message)
    return false
  }
}

/**
 * 执行一轮文件清理。
 *
 * 对 TARGET_DIRS 中每个临时目录：单趟遍历时删除超过 max_age 的过期文件，
 * 并累计剩余文件；若总大小仍超 max_size，按最旧优先删除至阈值以下。
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
    const remaining: FileEntry[] = []
    let totalSize = 0

    // 1. 单趟遍历：边删过期文件边累计剩余文件与总大小(供容量清理使用)
    await walkFiles(
      dir,
      async (entry) => {
        result.scanned += 1
        if (entry.mtime < ageCutoff) {
          if (await safeDelete(entry.path, result.errors)) result.deletedByAge += 1
          return
        }
        remaining.push(entry)
        totalSize += entry.size
      },
      isProtectedPath,
    )

    // 2. 按大小清理：对未过期文件按最旧优先删除至阈值以下
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      remaining.sort((a, b) => a.mtime - b.mtime)
      for (const f of remaining) {
        if (totalSize <= MAX_TOTAL_SIZE_BYTES) break
        if (await safeDelete(f.path, result.errors)) {
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
export async function getCleanupStats(): Promise<CleanupStats> {
  const uploads: FileEntry[] = []
  await walkFiles('uploads', (entry) => {
    uploads.push(entry)
  })
  const outputs: FileEntry[] = []
  await walkFiles('outputs', (entry) => {
    outputs.push(entry)
  })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
