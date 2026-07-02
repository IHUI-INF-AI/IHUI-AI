#!/usr/bin/env node
/**
 * knip Configuration Hints 守门
 *
 * 目的: 在 pre-commit / CI 中快速检测 knip.json 配置错误
 *       (Configuration hints), 比完整 knip 扫描快 10 倍.
 *
 * 用法: node scripts/check-knip-hints.mjs
 *
 * 退出码:
 *   0 - 通过 (无 Configuration hints)
 *   1 - 发现 Configuration hints
 *
 * 与 scan:knip 的区别:
 *   scan:knip          - 完整扫描 (Configuration hints + Unused files/exports), 30-60 秒
 *   check:knip-hints   - 只检查 Configuration hints, 5-10 秒
 *                       适合 pre-commit hook (commit 时必跑)
 */
import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')

// 在 client/ 目录跑 knip, 输出到临时文件
let output = ''
try {
  output = execSync('npx knip --no-progress --reporter=knip', {
    cwd: clientRoot,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  // knip 在发现 unused files/exports 时退出码非 0, 但 Configuration hints 输出在 stdout
  output = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '')
}

// 提取 Configuration hints 段落
// knip 6 输出的 Configuration hints 格式:
//   Configuration hints (N)
//   <file>     knip.json  <message>
const hintsSection = output.match(/Configuration hints \(\d+\)[\s\S]*?(?=\n\n[A-Z]|\n*$)/m)
if (!hintsSection) {
  console.log('[OK] knip Configuration hints: 0 个 ✅')
  process.exit(0)
}

const lines = hintsSection[0].split('\n').filter((l) => l.trim() && l.includes('knip.json'))
if (lines.length === 0) {
  console.log('[OK] knip Configuration hints: 0 个 ✅')
  process.exit(0)
}

console.error('\n[FAIL] knip Configuration hints 不为 0:')
for (const line of lines) {
  console.error(`  ${line.trim()}`)
}
console.error('\n修复: 检查 client/knip.json 配置, 常见问题:')
console.error('  1. entry/project 在顶级, 应移到 workspaces.{} 块中')
console.error('  2. entry 列表中的文件被 project 模式匹配 (redundant entry pattern)')
console.error('  3. ignore/ignoreDependencies 中包含实际使用的文件/依赖')
console.error(' 4. project pattern 排除 entry 文件: 用 "!src/main.ts" 形式')
console.error('\n完整 knip 输出: npm run scan:knip')
process.exit(1)
