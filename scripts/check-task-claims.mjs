#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-task-claims.mjs — 扫描 PROJECT_PLAN.md 任务认领状态
 *
 * 三态分类(AGENTS.md §1 任务认领机制配套):
 *   - 无人认领: `- [ ]` 开头(不含"进行中")
 *   - 进行中:   `- [ ]（进行中）` 开头(全角括号)
 *   - 已完成:   `- [x]` 开头
 *
 * 用法:
 *   node scripts/check-task-claims.mjs             # 人类可读汇总
 *   node scripts/check-task-claims.mjs --json      # JSON 输出
 *   node scripts/check-task-claims.mjs --unclaimed  # 只列无人认领
 *   node scripts/check-task-claims.mjs --in-progress # 只列进行中
 *
 * 2026-09-23 立, AGENTS.md §1 任务认领机制配套
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PLAN_PATH = resolve(ROOT, 'PROJECT_PLAN.md')

/**
 * 扫描 PROJECT_PLAN.md 内容,按三态分类任务行。
 * @param {string} content - PROJECT_PLAN.md 文件内容
 * @returns {{ unclaimed: Array<{line:number,text:string}>, inProgress: Array<{line:number,text:string}>, completed: Array<{line:number,text:string}> }}
 */
function scanTasks(content) {
  const lines = content.split('\n')
  const unclaimed = []
  const inProgress = []
  const completed = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()

    // 已完成: - [x] ...
    if (/^- \[x\]/.test(trimmed)) {
      completed.push({ line: i + 1, text: trimmed.replace(/^- \[x\]\s*/, '').slice(0, 120) })
      continue
    }

    // 进行中: - [ ]（进行中） ... (全角括号)
    if (/^- \[ \]（进行中）/.test(trimmed)) {
      inProgress.push({ line: i + 1, text: trimmed.replace(/^- \[ \]（进行中）\s*/, '').slice(0, 120) })
      continue
    }

    // 无人认领: - [ ] ... (不含"进行中")
    if (/^- \[ \]/.test(trimmed)) {
      unclaimed.push({ line: i + 1, text: trimmed.replace(/^- \[ \]\s*/, '').slice(0, 120) })
      continue
    }
  }

  return { unclaimed, inProgress, completed }
}

function main() {
  const args = process.argv.slice(2)
  const content = readFileSync(PLAN_PATH, 'utf-8')
  const { unclaimed, inProgress, completed } = scanTasks(content)

  if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          unclaimed,
          inProgress,
          completed,
          totals: {
            unclaimed: unclaimed.length,
            inProgress: inProgress.length,
            completed: completed.length,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  if (args.includes('--unclaimed')) {
    console.log(`无人认领任务 (${unclaimed.length}):`)
    for (const t of unclaimed) console.log(`  L${t.line}: ${t.text}`)
    return
  }

  if (args.includes('--in-progress')) {
    console.log(`进行中任务 (${inProgress.length}):`)
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    return
  }

  // 默认: 汇总
  console.log('='.repeat(60))
  console.log('  PROJECT_PLAN.md 任务认领状态')
  console.log('='.repeat(60))
  console.log()
  console.log(`  无人认领:  ${unclaimed.length}`)
  console.log(`  进行中:    ${inProgress.length}`)
  console.log(`  已完成:    ${completed.length}`)
  console.log(`  合计:      ${unclaimed.length + inProgress.length + completed.length}`)
  console.log()

  if (inProgress.length > 0) {
    console.log('─ 进行中 ─')
    for (const t of inProgress) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  }

  if (unclaimed.length > 0 && unclaimed.length <= 30) {
    console.log('─ 无人认领 ─')
    for (const t of unclaimed) console.log(`  L${t.line}: ${t.text}`)
    console.log()
  } else if (unclaimed.length > 30) {
    console.log(`─ 无人认领 (${unclaimed.length} 项,前 15) ─`)
    for (const t of unclaimed.slice(0, 15)) console.log(`  L${t.line}: ${t.text}`)
    console.log(`  ... 还有 ${unclaimed.length - 15} 项`)
    console.log()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = { scanTasks }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
