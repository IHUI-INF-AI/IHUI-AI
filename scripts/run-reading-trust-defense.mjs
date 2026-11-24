#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * run-reading-trust-defense.mjs —— 四道元门的统一调度入口(2026-11-07)
 *
 * 为什么要有它:2026-11-07 已经有四条线在 `scripts/` 上并行改门。新增的四道元门**不**
 * 各自去抢 hook 接线点(那会造出第五次撞车),而是由一个 dispatcher 统一跑,CI 只引用
 * 这一个入口。口径:
 *   · 某道门 exit 2 = 未判定(不是通过);本入口照样返回非 0,并把"未判定"原样打印;
 *   · 某道门 exit 1 = 判红;本入口返回 1;
 *   · 全部 0 = 通过。
 * 本入口**不做任何阈值/豁免处理**,也不吞子进程输出。
 *
 * 用法:node scripts/run-reading-trust-defense.mjs [--list]
 * 运行形态:CI 作业直接调用(见 `.github/workflows/reading-trust-defense.yml`)。
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CHECKS = [
  { name: 'A 面规格静态扫描', script: 'scripts/check-face-spec-hardcode.mjs', args: [] },
  { name: 'B 空输入保护盘点', script: 'scripts/check-face-empty-guard-coverage.mjs', args: [] },
  { name: 'C 派生件钉面一致性', script: 'scripts/check-generated-pin-face.mjs', args: [] },
  { name: 'D 门属主声明', script: 'scripts/check-gate-owner-declaration.mjs', args: [] },
]

function main() {
  if (process.argv.includes('--list')) {
    for (const c of CHECKS) console.log(`${c.name}\t${c.script}`)
    return
  }

  const failed = []
  const undetermined = []
  for (const c of CHECKS) {
    console.log(`\n=== ${c.name} :: node ${c.script} ${c.args.join(' ')}`.trimEnd())
    const r = spawnSync(process.execPath, [resolve(ROOT, c.script), ...c.args], { cwd: ROOT, stdio: 'inherit', timeout: 180000, windowsHide: true })
    if (r.error) {
      console.error(`未判定:${c.script} 无法执行(${r.error.message})`)
      undetermined.push(c.script)
      continue
    }
    if (r.status === 0) continue
    if (r.status === 2) undetermined.push(c.script)
    else failed.push(c.script)
  }

  console.log('\n=== reading-trust defense 汇总')
  console.log(`判红:${failed.length ? failed.join(', ') : '(无)'}`)
  console.log(`未判定:${undetermined.length ? undetermined.join(', ') : '(无)'}`)
  if (failed.length > 0) process.exit(1)
  if (undetermined.length > 0) process.exit(2)
  console.log('四道元门全部 exit 0')
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
