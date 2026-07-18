#!/usr/bin/env node
/**
 * 全量 TypeScript 类型检查脚本
 *
 * 用途：清除所有 .tsbuildinfo 增量缓存后强制全量 typecheck，
 *       防止增量缓存掩盖预存在错误（项目曾因 .tsbuildinfo 陈旧导致错误被掩盖）。
 *
 * 触发场景：
 *   - CI 定期全量检查（建议每周或发版前运行）
 *   - 手动怀疑缓存陈旧时运行
 *   - 升级 TypeScript / 调整 tsconfig.json 后运行
 *
 * 用法：pnpm typecheck:full
 */

import { readdirSync, statSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.turbo', '.git', '.pnpm-store', '.pnpm-cache'])

/**
 * 递归查找并删除所有 .tsbuildinfo 文件（排除依赖与构建缓存目录）。
 * @param {string} dir 当前扫描目录
 * @param {string[]} removed 已删除文件路径收集
 * @returns {string[]} 已删除文件路径列表
 */
function cleanTsbuildinfo(dir, removed = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return removed
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue
      cleanTsbuildinfo(full, removed)
    } else if (entry.endsWith('.tsbuildinfo')) {
      try {
        rmSync(full, { force: true })
        removed.push(full)
      } catch {
        /* 忽略删除失败（可能是 .next/cache 内的只读文件） */
      }
    }
  }
  return removed
}

console.log('[typecheck:full] 清除 .tsbuildinfo 增量缓存...')
const removed = cleanTsbuildinfo(ROOT)
if (removed.length === 0) {
  console.log('[typecheck:full] 未发现 .tsbuildinfo 文件，直接全量检查。')
} else {
  console.log(`[typecheck:full] 已删除 ${removed.length} 个 .tsbuildinfo 文件：`)
  for (const f of removed) {
    console.log(`  - ${f.replace(ROOT, '.')}`)
  }
}

console.log('\n[typecheck:full] 运行 pnpm -r run typecheck（串行，避免 turbo 多进程竞态）...')
console.log('[typecheck:full] 注意:apps/ai-service 的 mypy 为 informational,非阻塞(见上 ⚠️ 警告)')
// 使用 pnpm -r 递归串行运行，避免 turbo 并行/串行时的 .tsbuildinfo 与内存竞态
const result = spawnSync('pnpm -r run typecheck', {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})

if (result.status !== 0) {
  console.error(`\n[typecheck:full] 失败，退出码 ${result.status}`)
  process.exit(result.status ?? 1)
}

console.log('\n[typecheck:full] 全量类型检查通过。')
console.log('[typecheck:full] ⚠️ 注意:apps/ai-service 的 mypy 错误为 informational,不阻塞 push(Python 代码待后续修复)')
