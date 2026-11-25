#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 聚合器需要 stdout 汇总 */
/**
 * 安全面总审计(2026-11-24 立)。
 *
 * 为什么需要聚合器:安全能力散在 6 个门里时,没有任何一个命令能回答
 * 「现在整体安全态势是多少分、哪一面在退化」。人不会每天手动跑六条命令,
 * 于是退化只在事故里被发现。
 *
 * 评分口径(刻意简单,避免"加权黑箱"):
 *   已通过门数 / 可判定门数 × 100。未判定(exit 2)不进分母 ——
 *   「没判」既不算过也不算红,但会在报告里单独点名。
 *
 * 退出码: 0 全绿 | 1 有门判红 | 2 有门未判定且无红
 * 运行产物: .ihui-agent/state/security-audit.json / .md
 *
 * 用法:
 *   node scripts/security/security-audit.mjs
 *   node scripts/security/security-audit.mjs --json
 *   node scripts/security/security-audit.mjs --update-baseline   # 六门全部重建基线
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')

export const GATES = Object.freeze([
  { id: 'entry-exposure', script: 'check-entry-exposure.mjs', label: '入口暴露面（8801/防火墙/edge guard/限流）' },
  { id: 'dependency-vuln', script: 'check-dependency-vuln.mjs', label: '依赖漏洞（Next/React 修复线）' },
  { id: 'dangerous-sinks', script: 'check-dangerous-sinks.mjs', label: '危险 sink（eval/命令/SQL/SSRF/JWT）' },
  { id: 'container-hardening', script: 'check-container-hardening.mjs', label: '容器构建面（root/密钥/远程执行）' },
  { id: 'ci-supply-chain', script: 'check-ci-supply-chain.mjs', label: 'CI 供应链（action pin/pwn request/脚本注入）' },
  { id: 'client-hardening', script: 'check-client-hardening.mjs', label: '客户端安全面（Tauri/Electron/ATS/明文）' },
  // ── 既有安全门纳入同一张表(2026-11-24 第二批)──────────────────────────
  // 这些判据本仓早已单独立门,但它们各自只在提交链或人工巡检里跑,
  // 没有一处能回答"密钥/越权/CSRF/Cookie/认证注册五面此刻是否全绿"。
  // 聚合它们 **不复制任何判据**(§0.6),只读退出码;`supportsBaseline: false`
  // 是因为它们不接受 --update-baseline(各自有差值棘轮或面口径)。
  { id: 'secret-leak', script: 'check-api-key-leak.mjs', dir: 'scripts', supportsBaseline: false, label: '密钥泄露（真实 key 不入码）' },
  { id: 'credential-in-message', script: 'check-credential-leak-in-message.mjs', dir: 'scripts', supportsBaseline: false, timeoutMs: 900_000, label: '凭据进消息面（错误信息不带密钥）' },
  { id: 'authz-column-isolation', script: 'check-authorization-column-isolation.mjs', dir: 'scripts', supportsBaseline: false, label: '授权列隔离（越权读写）' },
  { id: 'csrf-exemption', script: 'check-csrf-exemption-shape.mjs', dir: 'scripts', supportsBaseline: false, label: 'CSRF 豁免形态' },
  { id: 'cookie-domain', script: 'check-auth-cookie-domain-scope.mjs', dir: 'scripts', supportsBaseline: false, label: '会话 Cookie 域作用域' },
  { id: 'auth-handler-parity', script: 'check-auth-handler-registration-parity.mjs', dir: 'scripts', supportsBaseline: false, label: '认证 handler 注册齐备' },
  // ── 对抗能力四面纳入同一张表(2026-11-24 第三批)──────────────────────
  // 前十二面回答「配置/代码有没有洞」;这四面回答「打起来时防线是什么水平」。
  // 全部只读既有产物或跑纯函数,不复制任何判据(§0.6)。
  { id: 'host-triage', script: 'check-host-triage.mjs', supportsBaseline: false, label: '主机失陷（webshell/外连/持久化）' },
  { id: 'redteam-selftest', script: 'check-redteam-selftest.mjs', supportsBaseline: false, label: '红队回归（11 必拦 + 5 不误伤）' },
  { id: 'evidence-chain', script: 'check-evidence-chain.mjs', supportsBaseline: false, label: '证据链完整性（防篡改）' },
  { id: 'defense-posture', script: 'check-defense-posture.mjs', supportsBaseline: false, label: '攻防态势（越界数/覆盖率/MTTD）' },
])

export function runGate(gate, root = ROOT, extraArgs = []) {
  const dir = gate.dir ? join(root, gate.dir) : HERE
  const r = spawnSync(process.execPath, [join(dir, gate.script), ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    timeout: gate.timeoutMs ?? 300_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 26,
  })
  const code = r.error && r.error.code === 'ETIMEDOUT' ? 2 : (r.status ?? 2)
  const tail = String(r.stdout || '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-6)
    .join('\n')
  return { gate: gate.id, label: gate.label, code, unjudged: code === 2, tail }
}

function score(rows) {
  const judged = rows.filter((r) => !r.unjudged)
  const passed = judged.filter((r) => r.code === 0)
  return { judged: judged.length, passed: passed.length, failed: judged.length - passed.length, unjudged: rows.length - judged.length, score: judged.length ? Math.round((passed.length / judged.length) * 100) : 0 }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const updateBaseline = argv.includes('--update-baseline')

  const rows = GATES.map((g) => runGate(g, ROOT, updateBaseline && g.supportsBaseline !== false ? ['--update-baseline'] : []))
  const s = score(rows)
  mkdirSync(STATE_DIR, { recursive: true })
  const report = { generatedAt: new Date().toISOString(), score: s, gates: rows }

  writeFileSync(join(STATE_DIR, 'security-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const md = [
    '# 安全面总审计',
    '',
    `- 时间：${report.generatedAt}`,
    `- 评分：**${s.score}/100**（通过 ${s.passed} / 可判定 ${s.judged}，判红 ${s.failed}，未判定 ${s.unjudged}）`,
    '',
    '| 门 | 状态 |',
    '| --- | --- |',
    ...rows.map((r) => `| ${r.label} | ${r.unjudged ? '未判定' : r.code === 0 ? '通过' : '判红'} |`),
    '',
    '## 各门末尾输出',
    ...rows.map((r) => `### ${r.gate}\n\n\`\`\`\n${r.tail || '（无输出）'}\n\`\`\``),
    '',
  ].join('\n')
  writeFileSync(join(STATE_DIR, 'security-audit.md'), md, 'utf8')

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    for (const r of rows) {
      const mark = r.unjudged ? '?' : r.code === 0 ? '✓' : '✗'
      console.log(`${mark} ${r.gate.padEnd(20)} ${r.label}`)
    }
    console.log(`评分 ${s.score}/100（通过 ${s.passed}/${s.judged}，判红 ${s.failed}，未判定 ${s.unjudged}）`)
    console.log(`报告：${join(STATE_DIR, 'security-audit.md')}`)
  }

  if (s.failed > 0) return 1
  if (s.unjudged > 0) return 2
  return 0
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('security-audit.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { GATES, runGate, score }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
