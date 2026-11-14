#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Provenance watermark injected by scripts/watermark.mjs
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { resolveGitBin } from './lib/gitdir.mjs'

const gitBin = resolveGitBin()

function git(args, cwd) {
  return execFileSync(gitBin, args, {
    encoding: 'utf8',
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

// 八份深度缺陷普查 survey 快照(合同固定清单;新增 survey 须同步加入此处与 guardian 门 stagedTriggers)。
const SURVEY_FILES = [
  'findings-api.md',
  'findings-ai-service.md',
  'findings-web.md',
  'findings-db.md',
  'findings-deploy-gates.md',
  'findings-services-db.md',
  'findings-crossui.md',
  'findings-cli-desktop.md',
]

const WARNING_RE = /过期快照警告/
const BASELINE_RE = /(基线|审计基线|分析基线|survey-baseline)/
const SHA_RE = /[0-9a-f]{7,40}/

// 陈旧阈值:基线距 TIP 超过此提交数即视为「过期」(不可信,须刷新 survey 再派单)。
// 可调:env FINDINGS_STALE_THRESHOLD。默认 1000 提交——本仓节奏下,一份缺陷普查
// 若落后 1000+ 提交,其逐行「当场可修」证据几乎必然已漂移,不能再当当前真相。
const STALE_THRESHOLD =
  Number(process.env.FINDINGS_STALE_THRESHOLD) > 0
    ? Number(process.env.FINDINGS_STALE_THRESHOLD)
    : 1000

function repoRoot() {
  try {
    return resolve(git(['rev-parse', '--show-toplevel']))
  } catch {
    return process.cwd()
  }
}

function tipSha() {
  if (process.env.FINDINGS_TIP) return process.env.FINDINGS_TIP.trim()
  try {
    return git(['rev-parse', 'origin/main'])
  } catch {
    try {
      return git(['rev-parse', 'HEAD'])
    } catch {
      return null
    }
  }
}

// 只扫前 30 行:survey 的「基线/审计基线/分析基线」元信息行都在文件头,
// 避免误吞正文里出现的轮次级基线(c20e4a57 / 89a5938f0c 等)。
function extractBaseline(content) {
  const lines = content.split(/\r?\n/)
  const limit = Math.min(lines.length, 30)
  for (let i = 0; i < limit; i++) {
    if (BASELINE_RE.test(lines[i])) {
      const m = lines[i].match(SHA_RE)
      if (m) return m[0]
    }
  }
  return null
}

function resolveFullSha(short) {
  try {
    return git(['rev-parse', `${short}^{commit}`])
  } catch {
    return null
  }
}

function isAncestor(sha, tip) {
  try {
    git(['merge-base', '--is-ancestor', sha, tip])
    return true
  } catch {
    return false
  }
}

function commitsBehind(sha, tip) {
  try {
    return parseInt(git(['rev-list', '--count', `${sha}..${tip}`]), 10)
  } catch {
    return null
  }
}

function main() {
  const argv = process.argv.slice(2)
  const formatCheck = argv.includes('--format-check')
  const jsonOnly = argv.includes('--json-only')
  const report = !formatCheck

  const root = repoRoot()
  const tip = tipSha()
  const dir = join(root, 'docs/tickets/2026-11')

  const results = SURVEY_FILES.map((name) => {
    const p = join(dir, name)
    let content = null
    try {
      content = readFileSync(p, 'utf8')
    } catch {
      content = null
    }
    const exists = content !== null
    const hasWarning = exists && WARNING_RE.test(content)
    const baselineShort = exists ? extractBaseline(content) : null
    const baselineFull = baselineShort ? resolveFullSha(baselineShort) : null
    const baselineResolved = Boolean(baselineFull)
    const isAnc = baselineFull ? isAncestor(baselineFull, tip) : false
    // 无基线 ⇒ 不可信 ⇒ 过期;解析不到 ⇒ 不可信 ⇒ 过期;非 TIP 祖先 ⇒ 过期;
    // 是祖先但落后超过 STALE_THRESHOLD 提交 ⇒ 证据已漂移 ⇒ 过期。
    const behind = baselineFull && isAnc ? commitsBehind(baselineFull, tip) : null
    const expired = !baselineFull || !isAnc || (behind != null && behind > STALE_THRESHOLD)
    return {
      file: `docs/tickets/2026-11/${name}`,
      exists,
      hasWarningBlock: hasWarning,
      baseline: baselineFull || baselineShort,
      baselineResolved,
      commitsBehind: behind,
      expired,
    }
  })

  // 机器可读产物(供 plan-tasks --exclude-stale-evidence 消费)。
  const payload = { generatedAt: new Date().toISOString(), tip, files: results }
  const dataDir = join(root, 'scripts/data')
  try {
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(
      join(dataDir, 'findings-staleness.json'),
      JSON.stringify(payload, null, 2) + '\n',
      'utf8',
    )
  } catch (e) {
    if (!jsonOnly && !formatCheck) {
      console.warn(`[warn] 无法写入 findings-staleness.json: ${e?.message ?? e}`)
    }
  }

  if (formatCheck) {
    for (const r of results) {
      if (!r.exists) console.log(`✗ ${r.file}: 文件缺失`)
      else if (!r.hasWarningBlock) console.log(`✗ ${r.file}: 缺【过期快照警告】块`)
      else if (!r.baseline) console.log(`✗ ${r.file}: 缺可解析基线 SHA`)
    }
    const bad = results.filter((r) => !r.exists || !r.hasWarningBlock || !r.baseline)
    console.log(
      `findings-format: ${results.length - bad.length}/${results.length} 通过结构校验(每枚 survey 须带警告块 + 可解析基线)`,
    )
    process.exit(bad.length ? 1 : 0)
  }

  if (jsonOnly) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
    process.exit(0)
  }

  // report 模式(守门 warn 档):只打印,永不拦提交。
  if (report) {
    const expiredCount = results.filter((r) => r.expired).length
    console.log(`findings-staleness: TIP=${tip}`)
    console.log(`  过期阈值=${STALE_THRESHOLD} 提交(基线落后超过即判过期)`)
    console.log(
      `  ${expiredCount}/${results.length} 份 survey 过期(基线非 TIP 祖先 / 不可解析 / 落后超阈值)`,
    )
    for (const r of results) {
      const status = r.expired ? '⚠ 过期' : '✓ 有效'
      const base = r.baseline || '(无)'
      const behind = r.commitsBehind == null ? '∞' : String(r.commitsBehind)
      console.log(
        `  ${status} ${r.file} | 基线=${base} | behind=${behind} | 警告块=${r.hasWarningBlock ? '有' : '无'}`,
      )
    }
    if (expiredCount) {
      console.log(
        '  ⇒ 引用上述过期 survey 的 PROJECT_PLAN 任务须先刷新该 survey 再派单(plan-tasks --exclude-stale-evidence 会自动降级)',
      )
    }
    process.exit(0)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
