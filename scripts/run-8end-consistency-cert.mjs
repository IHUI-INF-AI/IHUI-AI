#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 认证执行器为 CLI 工具,需 console 输出报告 */
/**
 * 8 端一致性认证矩阵执行器(P3 3-2 专项 v1,2026-09-17 立)。
 *
 * 复用仓库既有守门脚本(i18n parity × 端 / 契约 / SSE 事件 parity / 设计 tokens /
 * store parity / multi-end sync),按「维度 × 端」聚合执行,生成 Markdown 认证报告:
 * outputs/8end-consistency-cert-YYYY-MM-DD.md
 *
 * 判级:PASS(exit 0)/ WARN(warn-only 脚本有输出)/ FAIL(exit≠0)/ SKIP(维度对该端不适用)。
 * 重量级项(typecheck/全量测试)不在本执行器内——它们是 CI 职责,报告尾部注明。
 *
 * 退出码:无 FAIL → 0;有 FAIL → 1(可直接接入 CI 周回归)。
 *
 * 用法:node scripts/run-8end-consistency-cert.mjs [--out-dir outputs]
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const outDirIdx = args.indexOf('--out-dir')
const OUT_DIR = outDirIdx >= 0 ? args[outDirIdx + 1] : 'outputs'

const ENDS = ['web', 'api', 'ai-service', 'desktop', 'extension', 'mobile-rn', 'miniapp-taro', 'cli']

/**
 * 认证维度清单。每项:
 *   id        维度标识
 *   script    复用的守门脚本(scripts/ 相对路径)
 *   ends      适用端(报告中其余端标 SKIP);['*'] = 全端共享维度
 *   warnOnly  true = exit≠0 记 WARN 不阻塞(exit 仍以脚本为准,但失败不计 FAIL)
 */
const DIMENSIONS = [
  { id: 'i18n-parity-web', script: 'check-i18n-keys.mjs', ends: ['web'], warnOnly: false },
  { id: 'i18n-parity-mobile-rn', script: 'check-i18n-parity.mjs', ends: ['mobile-rn'], warnOnly: false },
  { id: 'i18n-parity-cli', script: 'check-cli-i18n-parity.mjs', ends: ['cli'], warnOnly: false },
  { id: 'i18n-broken-en', script: 'check-i18n-broken-en.mjs', ends: ['*'], warnOnly: false },
  { id: 'i18n-duplicate-ns', script: 'check-i18n-duplicate-namespaces.mjs', ends: ['*'], warnOnly: false },
  { id: 'i18n-dead-keys', script: 'scan-dead-i18n-keys.mjs', ends: ['*'], warnOnly: false },
  { id: 'sse-event-parity', script: 'check-agent-event-parity.mjs', ends: ['*'], warnOnly: false },
  { id: 'design-tokens-sync-miniapp', script: 'check-design-tokens-sync.mjs', args: ['--target=miniapp-taro'], ends: ['miniapp-taro'], warnOnly: false },
  { id: 'design-tokens-sync-mobile-rn', script: 'check-design-tokens-sync.mjs', args: ['--target=mobile-rn'], ends: ['mobile-rn'], warnOnly: false },
  { id: 'design-tokens-sync-web', script: 'check-design-tokens-sync.mjs', args: ['--target=web'], ends: ['web'], warnOnly: false },
  { id: 'cross-end-tokens', script: 'check-cross-end-tokens.mjs', ends: ['*'], warnOnly: false },
  { id: 'miniapp-tokens-sync', script: 'check-miniapp-tokens-sync.mjs', ends: ['miniapp-taro'], warnOnly: false },
  { id: 'cross-store-parity', script: 'check-cross-store-parity.mjs', ends: ['*'], warnOnly: false },
  { id: 'adapter-style-parity', script: 'check-adapter-style-parity.mjs', ends: ['*'], warnOnly: false },
  { id: 'multi-end-sync-baseline', script: 'check-multi-end-sync.mjs', ends: ['*'], warnOnly: true },
]

/** 缺失脚本自动 SKIP(基线演进中,守门可能尚未全量落地) */
function runOne(dim) {
  const scriptPath = join(ROOT, 'scripts', dim.script)
  if (!existsSync(scriptPath)) {
    return { status: 'SKIP', output: `脚本不存在: ${dim.script}` }
  }
  try {
    const out = execFileSync('node', [join('scripts', dim.script), ...(dim.args ?? [])], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 300_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 'PASS', output: out.trim().split('\n').slice(-8).join('\n') }
  } catch (e) {
    const out = [e.stdout, e.stderr].filter(Boolean).join('\n').trim()
    return { status: dim.warnOnly ? 'WARN' : 'FAIL', output: out.split('\n').slice(-12).join('\n') || `exit ${e.status}` }
  }
}

function main() {
  const results = []
  for (const dim of DIMENSIONS) {
    process.stdout.write(`▶ ${dim.id} (${dim.script}) ... `)
    const r = runOne(dim)
    console.log(r.status)
    results.push({ dim, ...r })
  }

  // 汇总:维度结果展开到端矩阵
  const date = new Date().toISOString().slice(0, 10)
  const fails = results.filter((r) => r.status === 'FAIL')
  const warns = results.filter((r) => r.status === 'WARN')
  const skips = results.filter((r) => r.status === 'SKIP')

  const lines = [
    `# 8 端一致性认证报告(${date})`,
    '',
    '> 执行器:`scripts/run-8end-consistency-cert.mjs`(P3 3-2 专项 v1)。复用既有守门脚本按「维度 × 端」聚合;',
    '> 重量级项(逐端 typecheck/全量测试)由 CI 职责覆盖,不在本报告内。',
    '',
    '## 汇总',
    '',
    `- 结果: **PASS ${results.length - fails.length - warns.length - skips.length} / WARN ${warns.length} / FAIL ${fails.length} / SKIP ${skips.length}**(共 ${results.length} 维度)`,
    `- 认证结论: **${fails.length === 0 ? '✅ 通过(当前基线一致)' : '❌ 未通过(存在 FAIL,见明细)'}**`,
    '',
    '## 维度 × 端矩阵',
    '',
    '| 维度 | 守门脚本 | ' + ENDS.join(' | ') + ' | 结果 |',
    '|---|---|' + ENDS.map(() => ':---:').join('|') + '|---|',
  ]
  for (const r of results) {
    const cells = ENDS.map((end) => (r.dim.ends.includes('*') || r.dim.ends.includes(end) ? '✓' : '—')).join(' | ')
    lines.push(`| ${r.dim.id} | \`${r.dim.script}\` | ${cells} | ${r.status} |`)
  }
  lines.push('', '## 明细', '')
  for (const r of results) {
    if (r.status === 'PASS') continue
    lines.push(`### ${r.status} · ${r.dim.id}`, '', '```', r.output || '(无输出)', '```', '')
  }
  lines.push('## 端清单', '', ENDS.map((e) => `- ${e}`).join('\n'), '')

  mkdirSync(join(ROOT, OUT_DIR), { recursive: true })
  const reportPath = join(ROOT, OUT_DIR, `8end-consistency-cert-${date}.md`)
  writeFileSync(reportPath, lines.join('\n'), 'utf-8')

  console.log('')
  console.log(`报告: ${reportPath}`)
  console.log(`结果: PASS ${results.length - fails.length - warns.length - skips.length} / WARN ${warns.length} / FAIL ${fails.length} / SKIP ${skips.length}`)
  if (fails.length > 0) {
    for (const f of fails) console.error(`  FAIL: ${f.dim.id}`)
    process.exit(1)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
