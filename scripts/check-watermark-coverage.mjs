#!/usr/bin/env node
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 溯源水印覆盖守门(blocking)
 *
 * 背景: CI 的 `node scripts/watermark.mjs verify` 要求所有可注入源文件携带完整水印。
 * 历史上多次出现新增文件未注入水印 -> 本地提交通过、CI 红(Provenance watermark check)。
 * 本脚本把该检查前移到 pre-commit, 且只针对 **git 已跟踪文件**, 避免本地未跟踪的
 * 构建产物/草稿文件造成误报(CI 检出时同样只看跟踪文件, 判定口径一致)。
 *
 * 判定: `watermark.mjs list-uncovered` 输出(未覆盖 + 残迹) ∩ `git ls-files`。
 *
 * 用法:
 *   node scripts/check-watermark-coverage.mjs
 * 跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = join(ROOT)

if (process.env.HUSKY_SKIP_WATERMARK_GUARD === '1') {
  console.log('[skip] HUSKY_SKIP_WATERMARK_GUARD=1, 跳过溯源水印覆盖守门')
  process.exit(0)
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

let uncovered
try {
  uncovered = run('node', ['scripts/watermark.mjs', 'list-uncovered'])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
} catch (e) {
  console.error('[watermark-coverage] 无法获取未覆盖清单:', e.message)
  process.exit(1)
}

if (uncovered.length === 0) {
  console.log('[watermark-coverage] ✅ 全部源文件均已携带完整溯源水印')
  process.exit(0)
}

const tracked = new Set(
  run('git', ['ls-files'])
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
)

const missing = uncovered.filter((f) => tracked.has(f))
if (missing.length === 0) {
  console.log('[watermark-coverage] ✅ 已跟踪文件水印完整(其余为未跟踪本地产物,不计入)')
  process.exit(0)
}

console.error(`[watermark-coverage] ❌ ${missing.length} 个已跟踪文件缺失溯源水印(会导致 CI 红):`)
for (const f of missing.slice(0, 30)) console.error('  - ' + f)
if (missing.length > 30) console.error(`  ... 其余 ${missing.length - 30} 个`)
console.error('')
console.error('  修复: node scripts/watermark.mjs inject <file>   (逐个)')
console.error('        或先列出全部: node scripts/watermark.mjs list-uncovered')
console.error('  跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...')
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
