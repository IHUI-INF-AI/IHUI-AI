#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 修复器需要 stdout 汇总 */
/**
 * 自动修复器(2026-11-24 立)。
 *
 * 为什么需要它:"自动修复漏洞"只有两条腿真的能自动跑 ——
 *   ① 幂等的**配置面**修复(防火墙放行/封禁规则/过期解封);
 *   ② 依赖与代码的**改动面**修复(升级 Next/React、改 sink)必须留人工,
 *      因为它要跑回归,自动改等于把未验证代码推给用户。
 * 所以本器**只做第一类**,第二类由 security-audit 每天点名,人来做。
 *
 * 每一步都必须是"再跑一次结果不变"的幂等动作;任何一步失败即 exit 1 并点名。
 * 退出码: 0 全部修复成功 | 1 有步骤失败 | 2 未判定(权限/取不到)
 * 产物: .ihui-agent/state/security-repair.json
 *
 * 用法:
 *   node scripts/security/security-repair.mjs            # 真修
 *   node scripts/security/security-repair.mjs --dry-run  # 只报不做
 *   node scripts/security/security-repair.mjs --json
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')

export const STEPS = Object.freeze([
  {
    id: 'firewall-allow',
    label: '入口放行规则幂等补齐（8801 唯一的对外放行）',
    script: 'check-entry-exposure.mjs',
    args: ['--ensure'],
  },
  {
    id: 'expired-unban',
    label: '到期封禁自动解封（不留下永不清理的规则）',
    script: 'ihui-attack-autoban.mjs',
    args: ['--prune', '--apply'],
  },
])

export function runStep(step, root = ROOT, dryRun = false) {
  const args = dryRun ? ['--check'] : step.args
  const r = spawnSync(process.execPath, [join(HERE, step.script), ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  const code = r.status ?? 2
  return {
    step: step.id,
    label: step.label,
    dryRun,
    code,
    ok: code === 0,
    unjudged: code === 2,
    tail: String(r.stdout || r.stderr || '').trim().split(/\r?\n/).filter(Boolean).slice(-4).join('\n'),
  }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const dryRun = argv.includes('--dry-run')

  const rows = STEPS.map((s) => runStep(s, ROOT, dryRun))
  mkdirSync(STATE_DIR, { recursive: true })
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    ok: rows.every((r) => r.ok),
    steps: rows,
  }
  writeFileSync(join(STATE_DIR, 'security-repair.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    for (const r of rows) console.log(`${r.unjudged ? '?' : r.ok ? '✓' : '✗'} ${r.step.padEnd(16)} ${r.label}`)
    if (!report.ok) console.log('修复未全部成功，逐条见 .ihui-agent/state/security-repair.json')
  }

  if (rows.some((r) => !r.ok && !r.unjudged)) return 1
  if (rows.some((r) => r.unjudged)) return 2
  return 0
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('security-repair.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { STEPS, runStep }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
