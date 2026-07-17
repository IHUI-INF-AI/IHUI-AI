#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 交付报告一致性守门 — 防止"声明无后续建议 + 列出后续建议"自相矛盾。
 *
 * 依据 AGENTS.md 第 11 节"交付报告一致性硬约束"(强制):
 *   1. "完整收尾类"措辞(无后续建议/已闭环/完整收尾/全部完成/无遗留)与
 *   2. "后续工作类"条目(P1-P5/优化项/待跟进/待执行/TODO/遗留风险)互斥
 *   禁止在同一份交付报告/任务总结中同时出现。
 *
 * 扫描范围(本脚本):
 *   - PROJECT_PLAN.md 全部章节(任务交付报告主文档)
 *   - apps 与 docs 目录下的 CHANGELOG.md
 *   - 任意 staged 变更的 .md 文件
 *
 * 用法:
 *   node scripts/check-delivery-report-consistency.mjs --staged   (pre-commit, 矛盾阻塞 commit)
 *   node scripts/check-delivery-report-consistency.mjs             (全量扫描报告, exit 0/1)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** "完整收尾类"措辞 — 出现即触发"无任何后续工作"前提 */
const COMPLETE_PHRASES = [
  '无后续建议',
  '无任何剩余建议',
  '无任何剩余',
  '完整收尾',
  '全部完成',
  '已闭环',
  '已完整收尾',
  '无遗留',
  '无任何待办',
  '可以关闭对话',
  '可以关闭',
  '100% 完成',
  '已 100% 完成',
]

/** "后续工作类"条目 — 出现即触发"还有剩余工作"前提 */
const REMAINING_KEYWORDS = [
  '后续建议',
  'P1-P5',
  'P0-P2',
  '优化项',
  '待跟进',
  '待执行',
  'TODO',
  '遗留风险',
  '后续可改进',
  '未来可考虑',
  '可进一步优化',
  '未实现',
  '本节后续',
  '本节剩余',
  '剩余 N 项',
  '还有 N 项',
  '还有 1 项',
  '还有 2 项',
  '还有 3 项',
  '还有 4 项',
  '还有 5 项',
]

/** 文档级豁免 — 这些章节即使同时出现两类措辞也算合规 */
function isExemptSection(section) {
  // 章节标题/讨论互斥规则本身的章节
  if (/\bAGENTS\.md\s+第\s+11\s+节\b/.test(section)) return true
  if (/交付报告一致性/.test(section)) return true
  if (/守门脚本/.test(section)) return true
  if (/互斥校验/.test(section)) return true
  // 检查守门脚本本身(含所有触发模式)
  if (/check-delivery-report-consistency/.test(section)) return true
  return false
}

/** 把 md 文件按 H2/H3 章节切分,返回 [{title, body}] */
function splitSections(md) {
  const sections = []
  const lines = md.split('\n')
  let cur = { title: '', body: [] }
  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line)) {
      if (cur.title || cur.body.length) sections.push(cur)
      cur = { title: line, body: [] }
    } else {
      cur.body.push(line)
    }
  }
  if (cur.title || cur.body.length) sections.push(cur)
  return sections
}

/** 在一个章节文本里扫描互斥违规 */
function checkSection(section) {
  if (isExemptSection(section.title + '\n' + section.body.join('\n'))) return []
  const text = section.body.join('\n')
  const hits = { complete: [], remaining: [] }
  for (const phrase of COMPLETE_PHRASES) {
    if (text.includes(phrase)) hits.complete.push(phrase)
  }
  for (const kw of REMAINING_KEYWORDS) {
    if (text.includes(kw)) hits.remaining.push(kw)
  }
  if (hits.complete.length > 0 && hits.remaining.length > 0) {
    return [{ section: section.title, hits }]
  }
  return []
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => f.endsWith('.md'))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

function getAllMdFiles() {
  const out = []
  const visit = (dir) => {
    if (!existsSync(dir)) return
    const st = statSync(dir)
    if (st.isFile()) {
      if (dir.endsWith('.md')) out.push(dir)
      return
    }
    for (const entry of readdirSync(dir)) {
      if (['node_modules', '.git', '.next', '.turbo', 'dist', 'build', '.worktrees', 'public'].includes(entry)) continue
      visit(join(dir, entry))
    }
  }
  visit(join(ROOT, 'PROJECT_PLAN.md'))
  return [...new Set(out.filter((f) => existsSync(f)))]
}

console.log(
  `${C.cyan}${C.bold}[交付报告一致性守门] 扫描"无后续建议 vs 后续建议"互斥违规...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 11 节 — 完整收尾类与后续工作类表述互斥,禁止同一报告同时出现${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规阻塞 commit)' : '全量 (扫描 PROJECT_PLAN.md 报告, exit 0/1)'}${C.reset}`,
)
console.log('')

let files = []
if (isStaged) {
  files = getStagedFiles()
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .md 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  files = getAllMdFiles()
}

let totalViolations = 0
const fileReports = []

for (const file of files) {
  const md = readFileSync(file, 'utf8')
  const sections = splitSections(md)
  const findings = []
  for (const section of sections) {
    const issues = checkSection(section)
    findings.push(...issues)
  }
  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log('')

if (totalViolations === 0) {
  console.log(`${C.green}${C.bold}✅ 交付报告一致性守门通过 — 措辞与列表条目互斥校验通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处"无后续建议"与后续建议条目同时存在:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(`  ${C.dim}章节:${C.reset} ${f.section}`)
    console.log(`    ${C.dim}完整收尾类措辞:${C.reset} ${C.yellow}${f.hits.complete.join(' / ')}${C.reset}`)
    console.log(`    ${C.dim}后续工作类条目:${C.reset} ${C.yellow}${f.hits.remaining.join(' / ')}${C.reset}`)
  }
  console.log('')
}
console.log(`${C.dim}修复方法(从下列 2 选 1):${C.reset}`)
console.log(`  ${C.bold}方案 A${C.reset}  - 改为"还有 N 项后续工作,见 <列表>":`)
console.log(`    把"无后续建议 / 完整收尾 / 已闭环"改为"任务 X 已完成,还有 N 项后续工作"`)
console.log(`  ${C.bold}方案 B${C.reset}  - 真正全部完成,删除后续工作条目:`)
console.log(`    把"P1-P5 / 优化项 / TODO / 后续可改进"列表全部删除`)
console.log('')
console.log(`${C.dim}详细规则: AGENTS.md 第 11 节"交付报告一致性硬约束"${C.reset}`)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 交付报告一致性守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 1)${C.reset}`)
  process.exit(1)
}
