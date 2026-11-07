#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// bare-sentinel-register.mjs — IHUI-BARE-SENTINEL 常驻任务注册(机主 2026-10-18 授权)
// 幂等:/f 覆盖已存在任务;注册后立即启动并回读状态。
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TASK = 'IHUI-BARE-SENTINEL'
const DRY_RUN = process.argv.includes('--dry-run')
// 仓根由脚本自身位置推导(禁 process.cwd(),§15):本文件住 <repo>/scripts/。
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const VBS = join(REPO_ROOT, 'scripts', 'bare-sentinel-hidden.vbs')
const RUN = 'wscript.exe "' + VBS + '"'

// 2026-11-05 复核:旧版把 VBS 写死成 G:\IHUI-AI\…,而本机仓在 D: —— schtasks /create、/run、
// /query 全返回 0(实测),任务实际空转,末行仍自报 DONE。判据:目标启动器必须先存在于
// 本次推导出的仓根下;找不到 ⇒ exit 2「未判定」,绝不把"schtasks 返回 0"折成"任务可用"。
if (!existsSync(VBS)) {
  console.error(`[bare-sentinel] ❌ 未判定:未找到启动器 ${VBS}`)
  console.error('   本脚本按自身位置推导仓根;若仓已移动,请从目标仓内重跑本脚本。')
  process.exit(2)
}

function run(args) {
  const out = execFileSync('schtasks', args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  process.stdout.write(out)
  return out
}

if (DRY_RUN) {
  console.log(`[dry-run] repo=${REPO_ROOT}`)
  console.log(`[dry-run] vbs=${VBS} (exists=true)`)
  console.log(`[dry-run] task=${TASK}`)
  console.log(`[dry-run] action=${RUN}`)
  process.exit(0)
}

console.log('[1/3] create (overwrite, on-logon trigger, run as interactive user)')
run(['/create', '/tn', TASK, '/tr', RUN, '/sc', 'onlogon', '/rl', 'limited', '/f'])

console.log('[2/3] start now')
run(['/run', '/tn', TASK])

console.log('[3/3] verify')
const query = run(['/query', '/tn', TASK, '/v', '/fo', 'LIST'])
// 回读必须看到本次推导出的启动器路径;否则不判成功(/query 返回 0 ≠ 任务可用)。
if (!query.includes(VBS)) {
  console.error(`[bare-sentinel] ❌ 未判定:任务回读里看不到目标启动器 ${VBS}`)
  process.exit(2)
}
console.log('DONE')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
