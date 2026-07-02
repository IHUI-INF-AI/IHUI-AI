// P22: 一键清理 client/ 运行时产物和临时文件
// 用法:
//   npm run clean              # 默认: 清理运行时产物 + 临时日志
//   npm run clean -- --archive # 同时清理 30 天前的 _archive 目录
import { rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

const ROOT = process.cwd()

// 要删除的目录（运行时产物）
const DIRS = [
  'pw-output',
  'screenshots',
  'test-results',
  'storybook-static',
  'audit',
  '.ruff_cache',
  'dist',
  'dist-ssr',
  '.vite',
  '.cache',
  'coverage',
  '.nyc_output',
  'playwright-report',
  'e2e-reports',
]

// 要删除的文件（临时日志/报告，不含通配符）
const FILES = [
  'eslint-report.json',
  'eslint-non-unused.txt',
  'eslint-unused-vars.txt',
  'e2e_failed_list.txt',
  'e2e_full_log.txt',
  'test-output.json',
  'temp_style.scss',
  'curl-mock.html',
  'curl-out.html',
]

// _archive 目录的清理配置
// 设计意图: docs/_archive/commit-messages-YYYY-MM-DD/ 是按日期归档的,
//   30 天前的归档可安全删除 (避免 _archive 无限增长)
const ARCHIVE_CONFIG = {
  // 扫描的 _archive 根目录
  roots: [
    join(ROOT, 'docs/_archive'),
  ],
  // 30 天前的归档子目录 (commit-messages-YYYY-MM-DD 格式)
  // 命名约定: docs/_archive/<category>/commit-messages-YYYY-MM-DD/
  ageDays: 30,
  // 排除规则: 不清理这些子目录 (即使超龄也保留)
  protectedNames: [],
}

const includeArchive = process.argv.includes('--archive')

let removed = 0

// 安全删除：捕获权限错误继续执行
function safeRemove(path, isDir = false) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    return true
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'ENOTEMPTY') {
      console.warn(`⚠ 跳过（被占用）: ${path}`)
      return false
    }
    throw e
  }
}

// 解析归档子目录的日期 (commit-messages-YYYY-MM-DD 格式)
function parseArchiveDate(dirName) {
  const m = dirName.match(/^commit-messages-(\d{4}-\d{2}-\d{2})$/)
  if (!m) return null
  const d = new Date(m[1] + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  return d
}

// 清理超龄的 _archive 子目录
function cleanArchiveRoots() {
  if (!includeArchive) return
  const now = Date.now()
  const ageMs = ARCHIVE_CONFIG.ageDays * 24 * 60 * 60 * 1000
  for (const root of ARCHIVE_CONFIG.roots) {
    if (!existsSync(root)) continue
    // 遍历 _archive 的子目录 (例如 commit-messages-* / api-platform-* 等)
    for (const sub of readdirSync(root, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue
      const subPath = join(root, sub.name)
      // 遍历子目录下的归档条目
      for (const entry of readdirSync(subPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (ARCHIVE_CONFIG.protectedNames.includes(entry.name)) {
          console.log(`⊘ 保护 (白名单): ${basename(root)}/${sub.name}/${entry.name}`)
          continue
        }
        const date = parseArchiveDate(entry.name)
        if (!date) {
          // 不符合命名约定, 跳过
          continue
        }
        const ageMsActual = now - date.getTime()
        if (ageMsActual > ageMs) {
          const path = join(subPath, entry.name)
          if (safeRemove(path, true)) {
            const ageDays = Math.floor(ageMsActual / (24 * 60 * 60 * 1000))
            console.log(`✓ 清理超龄归档 (${ageDays}天前): ${basename(root)}/${sub.name}/${entry.name}`)
            removed++
          }
        }
      }
    }
  }
}

// 删除目录
for (const dir of DIRS) {
  const p = join(ROOT, dir)
  if (existsSync(p)) {
    if (safeRemove(p, true)) {
      console.log(`✓ 删除目录: ${dir}`)
      removed++
    }
  }
}

// 删除文件
for (const f of FILES) {
  const p = join(ROOT, f)
  if (existsSync(p)) {
    if (safeRemove(p)) {
      console.log(`✓ 删除文件: ${f}`)
      removed++
    }
  }
}

// 删除根目录下所有 .log 文件
try {
  for (const entry of readdirSync(ROOT)) {
    if (entry.endsWith('.log')) {
      const p = join(ROOT, entry)
      if (safeRemove(p)) {
        console.log(`✓ 删除日志: ${entry}`)
        removed++
      }
    }
  }
} catch {
  // 忽略读取错误
}

// 清理超龄归档
cleanArchiveRoots()

console.log(`\n清理完成: 共删除 ${removed} 项`)
if (!includeArchive) {
  console.log(`提示: npm run clean -- --archive 可同时清理 30 天前的 _archive 子目录`)
}
