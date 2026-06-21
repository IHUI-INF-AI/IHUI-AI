// P22: 一键清理 client/ 运行时产物和临时文件
// 用法: npm run clean
import { rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

let removed = 0

// 安全删除：捕获权限错误继续执行
function safeRemove(path, isDir = false) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    return true
  } catch (e) {
    // EPERM/EBUSY: 文件被占用，跳过
    if (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'ENOTEMPTY') {
      console.warn(`⚠ 跳过（被占用）: ${path}`)
      return false
    }
    throw e
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

console.log(`\n清理完成: 共删除 ${removed} 项`)

