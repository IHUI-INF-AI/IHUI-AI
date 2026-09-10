#!/usr/bin/env node
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * GitHub Actions 步骤顺序守门(blocking)
 *
 * 规则: 同一 job 内, 若 `actions/setup-node` 使用 `cache: pnpm`, 则
 *       `pnpm/action-setup` 必须出现在它 **之前**。
 *
 * 原因: setup-node 的 pnpm 缓存功能需要 pnpm 已就绪, 否则报
 *       "Unable to locate executable file: pnpm" —— 2026-09-10 实测
 *       导致 mobile-apk-build / mobile-ios-ipa-build 两个 workflow 永久失败。
 *
 * 用法:
 *   node scripts/check-workflow-step-order.mjs
 * 跳过: HUSKY_SKIP_WORKFLOW_ORDER=1 git commit ...
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WF_DIR = join(ROOT, '.github', 'workflows')

if (process.env.HUSKY_SKIP_WORKFLOW_ORDER === '1') {
  console.log('[skip] HUSKY_SKIP_WORKFLOW_ORDER=1, 跳过 workflow 步骤顺序守门')
  process.exit(0)
}

const STEP_RE = /^(\s*)-\s+(?:name|uses):/
const JOB_RE = /^  ([A-Za-z0-9_-]+):\s*$/

const violations = []

for (const file of readdirSync(WF_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
  const abs = join(WF_DIR, file)
  const lines = readFileSync(abs, 'utf8').split('\n')
  const jobStarts = []
  lines.forEach((l, i) => {
    if (JOB_RE.test(l)) jobStarts.push(i)
  })
  for (let k = 0; k < jobStarts.length; k++) {
    const js = jobStarts[k]
    const je = k + 1 < jobStarts.length ? jobStarts[k + 1] : lines.length
    const starts = []
    for (let i = js; i < je; i++) if (STEP_RE.test(lines[i])) starts.push(i)
    let nodeLine = -1
    let pnpmLine = -1
    for (let b = 0; b < starts.length; b++) {
      const s = starts[b]
      const e = b + 1 < starts.length ? starts[b + 1] : je
      const body = lines.slice(s, e).join('\n')
      if (nodeLine < 0 && body.includes('actions/setup-node') && /cache:\s*['"]?pnpm/.test(body)) {
        nodeLine = s
      }
      if (pnpmLine < 0 && body.includes('pnpm/action-setup')) pnpmLine = s
    }
    if (nodeLine >= 0 && pnpmLine > nodeLine) {
      violations.push(`${relative(ROOT, abs).replaceAll('\\', '/')}:${nodeLine + 1} (setup-node cache:pnpm 在第 ${pnpmLine + 1} 行的 pnpm/action-setup 之前)`)
    }
  }
}

if (violations.length === 0) {
  console.log('[workflow-step-order] ✅ setup-node(cache: pnpm) 均位于 pnpm/action-setup 之后')
  process.exit(0)
}

console.error(`[workflow-step-order] ❌ ${violations.length} 处步骤顺序错误(会导致 "Unable to locate executable file: pnpm"):`)
for (const v of violations) console.error('  - ' + v)
console.error('')
console.error('  修复: 把 pnpm/action-setup 步骤移到 actions/setup-node 之前(同一 job 内)。')
console.error('  跳过: HUSKY_SKIP_WORKFLOW_ORDER=1 git commit ...')
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
