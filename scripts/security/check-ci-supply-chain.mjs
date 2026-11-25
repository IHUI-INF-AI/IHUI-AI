#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 门需要 stdout 诊断 */
/**
 * CI/CD 供应链安全门(2026-11-24 立)。
 *
 * GitHub Actions 是当前最容易被忽略的 RCE 面:
 *   · action 用 tag(如 @v4)而不是 40 位 commit sha —— tag 可被上游改指向,等于把
 *     仓库写权限交给第三方;
 *   · pull_request_target + checkout PR head = "pwn request",任何 fork 都能在
 *     有 secrets 的上下文里跑自己的代码;
 *   · 在 run: 里直接插值 `${{ github.event.issue.title }}` —— 标题里的 `$(curl …)`
 *     会被 shell 执行(本仓 2026-10 曾在 issue 标题注入面踩过同型)。
 *
 * 判定只拦这四类**能直接拿到仓库/secrets 的**形态;`permissions` 缺失不判
 * (默认权限由仓库设置决定,代码里看不出来,判了就是猜)。
 *
 * 用法: node scripts/security/check-ci-supply-chain.mjs [--update-baseline] [--json]
 * 退出码: 0 无新增 | 1 新增 | 2 未判定
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultBaselinePath, listRepoFiles, readText, redactSnippet, runScanCli } from './lib/scan-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

const SHA40 = /@[0-9a-f]{40}\b/

export const CI_RULES = Object.freeze([
  { id: 'unpinned-action', severity: 'high', re: /^\s*(?:-\s*)?uses:\s*[^@\s]+@[A-Za-z0-9._-]+/, message: 'action 未用 40 位 commit sha 固定', skipIf: (line) => SHA40.test(line) || /uses:\s*(?:\.\/|docker:\/\/)/.test(line) },
  { id: 'permissions-write-all', severity: 'critical', re: /permissions\s*:\s*write-all/i, message: 'permissions: write-all 把全部权限交出去' },
  { id: 'pwn-request', severity: 'critical', re: /pull_request_target/i, message: 'pull_request_target 触发（必须确认 checkout 的不是 PR 代码）' },
  { id: 'script-injection', severity: 'critical', runOnly: true, re: /\$\{\{\s*github\.event\.(?:issue|pull_request|comment|review|discussion)[^}]*\.(?:title|body|head_ref|head\.ref)/i, message: 'run 中直接插值事件正文（shell 注入）' },
  { id: 'secrets-inherit', severity: 'medium', re: /secrets\s*:\s*inherit/i, message: 'secrets: inherit 把全部密钥传给 reusable workflow' },
  { id: 'insecure-commands', severity: 'high', re: /ACTIONS_ALLOW_UNSECURE_COMMANDS/i, message: '开启已废弃的不安全命令' },
  { id: 'pr-checkout-head', severity: 'high', re: /\bref\s*:\s*\$\{\{\s*github\.event\.pull_request\.head\.(?:sha|ref)\s*\}\}/i, message: '显式 checkout PR head（与 pull_request_target 组合即 pwn request）' },
])

export function scanWorkflow(file, text) {
  const findings = []
  const lines = text.split(/\r?\n/)
  // run 块跟踪:只有 run 脚本里的插值才会被 shell 执行;`env:` 传递是安全写法,
  // 把 env 行判成注入会在修完之后继续红(假红,与恒红门同一失效方向)。
  let runIndent = -1
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (runIndent >= 0 && indent <= runIndent) runIndent = -1
    const isRunLine = /^\s*(?:-\s*)?run:\s*[|>]/.test(line)
    if (isRunLine) runIndent = indent
    const inRun = runIndent >= 0 || /^\s*(?:-\s*)?run:/.test(line)
    for (const rule of CI_RULES) {
      if (rule.skipIf && rule.skipIf(line)) continue
      if (rule.runOnly && !inRun) continue
      if (!rule.re.test(line)) continue
      findings.push({ file, line: i + 1, rule: rule.id, severity: rule.severity, message: rule.message, snippet: redactSnippet(line) })
    }
  }
  return findings
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const updateBaseline = argv.includes('--update-baseline')
  const strict = !argv.includes('--no-strict')
  const baselinePath = defaultBaselinePath(ROOT, 'ci-supply-chain')

  const { files, error } = listRepoFiles(ROOT, { exts: ['.yml', '.yaml'] })
  const workflows = files.filter((f) => f.startsWith('.github/workflows/'))
  if (!workflows.length) {
    console.log('[ci-supply-chain] ❔ 未判定：没有 workflow 文件')
    return 2
  }
  let findings = []
  const skipped = []
  for (const file of workflows) {
    const { text, skipped: why } = readText(ROOT, file)
    if (why) {
      skipped.push({ file, reason: why })
      continue
    }
    findings = findings.concat(scanWorkflow(file, text))
  }

  const result = runScanCli({
    name: 'ci-supply-chain',
    findings,
    skipped,
    baselinePath,
    strict,
    updateBaseline,
    root: ROOT,
    extraLines: [`扫描面 ${workflows.length} 份 workflow`],
    unjudged: error,
  })
  if (json) console.log(JSON.stringify({ ok: result.code === 0, ...result.counts, findings }, null, 2))
  return result.code
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('check-ci-supply-chain.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { CI_RULES, scanWorkflow }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
