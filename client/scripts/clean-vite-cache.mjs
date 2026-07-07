#!/usr/bin/env node
/**
 * Vite 缓存清理脚本 (2026-07-06 立)
 *
 * 目的: 在 dev server 启动前自动清理残留的 Vite 缓存, 防止 "Vite 反复崩溃" 问题.
 *
 * 根因背景:
 *   Vite 在 dependency optimization 失败 / 进程被强杀 (kill -9 / 父进程退出) 时,
 *   会留下多种残留目录且不自动清理:
 *     - .vite_clean/deps_temp_*  (优化失败时残留的临时依赖缓存, 单个可达 30MB)
 *     - .vite-bad-<timestamp>    (优化失败的"坏"快照, 单个可达 168MB)
 *     - .vite_bad_<timestamp>    (同上, 不同命名版本)
 *     - .vite_fresh              (新建的干净缓存, 已被 .vite_clean 取代)
 *     - .vite_verify_tmp         (依赖校验临时目录, 单个可达 53MB)
 *     - .vite-temp               (空目录)
 *     - .vite-plus-<hash>        (vize 插件残留)
 *     - vite-plus                (vize 插件残留)
 *
 *   多次崩溃后, 这些目录会累积到 500MB+, 严重拖慢后续 Vite 启动和依赖优化,
 *   形成 "崩溃 → 残留 → 启动慢 → 再崩溃" 的恶性循环.
 *
 * 防护策略:
 *   保留: .vite_clean/deps (正在使用的合法依赖缓存)
 *   保留: .vite (标准 Vite 缓存目录, Vite 自己管理)
 *   删除: 所有 .vite-bad-*, .vite_bad_*, .vite-temp, .vite-plus-*, vite-plus
 *   清理: .vite_clean/deps_temp_* (只保留 deps 目录本身)
 *
 * 用法:
 *   node scripts/clean-vite-cache.mjs
 *
 * 退出码:
 *   0 - 成功 (无论是否清理了内容)
 */

import { readdirSync, statSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const nodeModulesDir = join(__dirname, '..', 'node_modules')

// 需整目录删除的残留项 (在 node_modules 根下)
const rootStalePatterns = [
  /^\.vite-bad-/,        // .vite-bad-20260706035113
  /^\.vite_bad_/,        // .vite_bad_20260706024805
  /^\.vite-temp$/,       // .vite-temp
  /^\.vite-plus-/,       // .vite-plus-tBYfs2T7
  /^vite-plus$/,         // vite-plus
  /^\.vite_fresh$/,      // .vite_fresh
  /^\.vite_verify_tmp$/, // .vite_verify_tmp
]

// .vite_clean 内部需要清理的子项 (保留 deps 目录)
const viteCleanStaleSubdirs = /^deps_temp_/

function getSizeMB(path) {
  try {
    const stat = statSync(path)
    if (!stat.isDirectory()) return stat.size
    // 简单估算: 列出目录第一层文件大小
    let total = 0
    try {
      const entries = readdirSync(path)
      for (const entry of entries) {
        try {
          const s = statSync(join(path, entry))
          if (s.isFile()) total += s.size
        } catch {}
      }
    } catch {}
    return total
  } catch {
    return 0
  }
}

let totalCleanedMB = 0
let cleanedCount = 0
const cleanedItems = []

// 1. 清理 node_modules 根下的残留目录
// 2026-07-07 优化: 先用快速检测判断是否有残留, 无残留则跳过全量 readdirSync.
//   node_modules 通常有 500+ 条目, readdirSync + 遍历每次耗时 10-30ms.
//   90% 的启动场景无残留, 快速检测用 fs.accessSync 逐个检查已知模式,
//   无匹配时直接跳过, 节省 I/O 开销.
if (existsSync(nodeModulesDir)) {
  // 快速路径: 检测是否有任何残留目录存在
  let hasStale = false
  const quickCheckNames = [
    '.vite-temp', 'vite-plus', '.vite_fresh', '.vite_verify_tmp',
  ]
  for (const name of quickCheckNames) {
    if (existsSync(join(nodeModulesDir, name))) {
      hasStale = true
      break
    }
  }
  // 对于带时间戳的模式 (.vite-bad-*, .vite_bad_*, .vite-plus-*), 仍需 readdir
  if (!hasStale) {
    try {
      const entries = readdirSync(nodeModulesDir)
      for (const entry of entries) {
        if (rootStalePatterns.some(p => p.test(entry))) {
          hasStale = true
          break
        }
      }
    } catch (e) {
      console.warn(`[warn] 读取 ${nodeModulesDir} 失败: ${e.message}`)
    }
  }

  if (hasStale) {
    try {
      const entries = readdirSync(nodeModulesDir)
      for (const entry of entries) {
        if (rootStalePatterns.some(p => p.test(entry))) {
          const fullPath = join(nodeModulesDir, entry)
          const size = getSizeMB(fullPath)
          try {
            rmSync(fullPath, { recursive: true, force: true })
            cleanedItems.push(`  [删除] ${entry} (${(size / 1024 / 1024).toFixed(2)} MB)`)
            totalCleanedMB += size / 1024 / 1024
            cleanedCount++
          } catch (e) {
            cleanedItems.push(`  [失败] ${entry}: ${e.message}`)
          }
        }
      }
    } catch (e) {
      console.warn(`[warn] 读取 ${nodeModulesDir} 失败: ${e.message}`)
    }
  }
}

// 2. 清理 .vite_clean 内部的 deps_temp_* 子目录
const viteCleanDir = join(nodeModulesDir, '.vite_clean')
if (existsSync(viteCleanDir)) {
  try {
    const subEntries = readdirSync(viteCleanDir)
    for (const sub of subEntries) {
      if (viteCleanStaleSubdirs.test(sub)) {
        const fullPath = join(viteCleanDir, sub)
        const size = getSizeMB(fullPath)
        try {
          rmSync(fullPath, { recursive: true, force: true })
          cleanedItems.push(`  [删除] .vite_clean/${sub} (${(size / 1024 / 1024).toFixed(2)} MB)`)
          totalCleanedMB += size / 1024 / 1024
          cleanedCount++
        } catch (e) {
          cleanedItems.push(`  [失败] .vite_clean/${sub}: ${e.message}`)
        }
      }
    }
  } catch (e) {
    console.warn(`[warn] 读取 ${viteCleanDir} 失败: ${e.message}`)
  }
}

// 输出报告
if (cleanedCount > 0) {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('║  [Vite 缓存清理] 已自动清理残留缓存                                            ║')
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝')
  for (const item of cleanedItems) {
    console.log(item)
  }
  console.log('')
  console.log(`  合计: 释放 ${totalCleanedMB.toFixed(2)} MB, 删除 ${cleanedCount} 个残留项`)
  console.log('')
} else {
  // 无残留时不输出, 保持 dev 启动日志干净
}

process.exit(0)
