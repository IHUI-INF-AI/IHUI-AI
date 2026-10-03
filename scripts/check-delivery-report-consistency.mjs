#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
import { catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

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
  // section 可能是字符串(老调用)或对象(新调用,含 date 字段)
  const text = typeof section === 'string' ? section : section.title + '\n' + section.body.join('\n')
  // 章节标题/讨论互斥规则本身的章节
  // 注意: 不用 \b 单词边界, 中文字符不属于 \w 类, \bAGENTS\.md\s+第\s+11\s+节\b 会失配
  if (/AGENTS\.md\s+第\s+11\s+节/.test(text)) return true
  if (/交付报告一致性/.test(text)) return true
  if (/守门脚本/.test(text)) return true
  if (/互斥校验/.test(text)) return true
  // 检查守门脚本本身(含所有触发模式)
  if (/check-delivery-report-consistency/.test(text)) return true
  // 合规措辞模板豁免: 用 "还有 N 项后续工作,见下方列表" 措辞的章节天然含两类措辞
  // (措辞本身含"无后续建议"反义 + 列出后续工作),按 AGENTS.md 第 11 节措辞模板视为合规
  if (/还有\s*\d+\s*项后续工作/.test(text)) return true
  if (/还有\s*N\s*项后续工作/.test(text)) return true
  if (/见下方列表/.test(text)) return true
  // 历史章节豁免: AGENTS.md 第 11 节于 2026-07-17 立, 之前/当天的章节豁免
  // 章节日期 <= 2026-07-17 视为规则未立或刚立未贯彻, 不强制回溯清洗
  if (typeof section === 'object' && section.date) {
    if (section.date <= '2026-07-17') return true
  }
  // 归档章节豁免: PROJECT_PLAN.md 历史章节用 <!-- 已归档(YYYY-MM-DD): 标记
  // 这是 PROJECT_PLAN.md 的标准归档协议,标记后的章节已迁至 .ihui-agent/archive/PROJECT_PLAN_*_auto-archive.md,
  // 不应再触发 §11 互斥校验。格式: <!-- 已归档(2026-08-05): 正文... -->
  // 必须在 body 第一行或紧邻章节标题后检测到 <!-- 已归档(YYYY-MM-DD):
  if (typeof section === 'object') {
    const body = section.body.join('\n')
    if (/<!--\s*已归档\(\d{4}-\d{2}-\d{2}\)\s*:/.test(body)) return true
  }
  return false
}

/** 把 md 文件按 H2/H3 章节切分,返回 [{title, body, startLine, date}] startLine 为 1-based, date 为 YYYY-MM-DD 或 null */
function splitSections(md) {
  const sections = []
  const lines = md.split('\n')
  let cur = { title: '', body: [], startLine: 0, date: null }
  let lastH2Date = null
  let lineNo = 0
  for (const line of lines) {
    lineNo++
    if (/^#{2,3}\s+/.test(line)) {
      if (cur.title || cur.body.length) sections.push(cur)
      // 解析章节标题中的日期, 多种格式兼容:
      //   (2026-07-17) / （2026-07-17） / ✅(2026-07-17) / （2026-07-14 5 项... / R76...(2026-07-18)...
      //   只取第一个匹配的 YYYY-MM-DD
      const dateMatch = line.match(/(\d{4})-(\d{2})-(\d{2})/)
      let date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null
      // H2 章节更新最近祖先日期
      if (/^##\s+/.test(line)) {
        lastH2Date = date
      }
      // H3 无日期时继承 H2 祖先日期
      if (!date && /^###\s+/.test(line)) {
        date = lastH2Date
      }
      cur = { title: line, body: [], startLine: lineNo, date }
    } else {
      cur.body.push(line)
    }
  }
  if (cur.title || cur.body.length) sections.push(cur)
  return sections
}

/** 转义正则元字符,用于构造字面量 keyword 的精确匹配正则 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 检查 text 中是否含"后续工作类"keyword,排除被否定前缀修饰的位置。
 *
 * Bug 背景:REMAINING_KEYWORDS 含 '后续建议',而 COMPLETE_PHRASES 含 '无后续建议'。
 * 用 text.includes('后续建议') 会命中 "无后续建议" 中的子串,导致同一文本被误判为
 * "同时声明无后续建议 + 列出后续建议" → 自相矛盾误报。
 *
 * 修复:用 lookbehind 排除前面紧邻否定前缀(无 / 无任何 / 没有 / 不存在 / 并无 / 全无)的位置。
 * 仅当 '后续建议' 出现在非否定上下文时才算命中。
 *
 * 注意:lookbehind 在 Node.js 10+ 支持(ES2018)。
 */
function containsRemainingKeyword(text, kw) {
  // 否定前缀清单:紧邻 keyword 之前出现这些前缀时,该 keyword 出现不算"后续工作类"
  const NEGATIVE_PREFIXES = ['无任何', '无', '没有', '不存在', '并无', '全无', '无需']
  // 构造 lookbehind:排除前面紧邻任一否定前缀的位置
  // (?<!无|无任何|没有|不存在|并无|全无|无需) + escaped(kw)
  const prefixPattern = NEGATIVE_PREFIXES.map(escapeRegExp).join('|')
  // 注意 lookbehind 分支长度可变时,部分老引擎不支持;Node 12+ 支持,这里用 alternation
  const re = new RegExp(`(?<!${prefixPattern})${escapeRegExp(kw)}`)
  return re.test(text)
}

/**
 * 归并注记的引用短语 — 台账 §1 规矩 2 的归并样板(全账数百处)。
 * 它们陈述的是"另一条持有行的状态"(程序性引用),不是本报告宣称自身完整收尾;
 * 按子串匹配会把整节归并注记误当完成宣称,与同节其他历史行的"未实现"字样
 * 拼成假矛盾(2026-10-03 实测:待办剥离区 30+ 处归并样板挡住一切触碰该节的提交)。
 * 判红面必须覆盖门自己产出的形态 —— 这批样板正是归并器(门 130 生态)自己写出来的。
 */
const MERGE_NOTE_REFERENCE_PHRASES = [
  '存在已闭环持有行',
  '与一条已闭环登记同复合主键',
]

/** 在一个章节文本里扫描互斥违规 */
function checkSection(section) {
  if (isExemptSection(section)) return []
  // 账本形块档(2026-10-03,G-417 盘点票 ① 的判定面修正):PROJECT_PLAN.md 这类多会话活账的
  // 章节会"边界塌陷"——单节 31~1092 行、数十条互不相关的任务登记(2026-09-28 收尾轮实测:
  // `### G-270` 一节 1092 行 / 610 条 bullet,台账 L15088/L18604 已裁它为假阳且明令不得改
  // 别人的章节结论)。在这种粒度上,"某行写了已闭环 + 另一行写了未实现"不构成同一份报告的
  // 自相矛盾。判别式:正文含 ≥3 条复选框任务行(`- [ ]`/`- [x]`)⇒ 账本形块;交付报告是
  // 散文+清单,不含任务登记行,不受影响(镜像测试双向钉住)。命中只报数点名,不判红。
  const taskRowCount = section.body.filter((l) => /^\s*- \[[ x]\]/.test(l)).length
  if (section.body.length > 200 || taskRowCount >= 3) return []
  const text = section.body.join('\n')
  // 完成宣称匹配前剥除归并注记的引用短语(后续工作类匹配仍用全文 —— 引用短语不是后续工作)
  let claimsText = text
  for (const refPhrase of MERGE_NOTE_REFERENCE_PHRASES) {
    claimsText = claimsText.split(refPhrase).join('')
  }
  const hits = { complete: [], remaining: [] }
  for (const phrase of COMPLETE_PHRASES) {
    if (claimsText.includes(phrase)) hits.complete.push(phrase)
  }
  for (const kw of REMAINING_KEYWORDS) {
    if (containsRemainingKeyword(text, kw)) hits.remaining.push(kw)
  }
  if (hits.complete.length > 0 && hits.remaining.length > 0) {
    return [{ section: section.title, hits }]
  }
  return []
}

/**
 * staged 面的枚举与内容都经 face-reader(守门 118 取材面纪律):枚举走 `gitRaw`
 * (路径清单不是 blob 正文),内容走 `catBatch` 读**索引 blob**(`:<path>` 规格)——
 * 旧实现 `readFileSync(join(ROOT, f))` 按磁盘判,共享工作树滞后 HEAD 时判的是
 * 别人的在飞现场;索引 blob 才是"本次提交会带走的那一份"。
 * @returns {string[]} staged 的 .md 相对路径
 */
function getStagedMdPaths() {
  try {
    const output = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM'], ROOT)
    return output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }
}

/**
 * 获取 staged 文件中新增行(+)的行号集合(1-based)。
 * 只检查新增行所在章节,避免历史违规阻塞新 commit。
 */
function getAddedLineNumbers(rel) {
  try {
    const output = gitRaw(['diff', '--cached', '--unified=0', '--', rel], ROOT)
    const addedLines = new Set()
    for (const line of output.split('\n')) {
      // @@ -oldStart,oldCount +newStart,newCount @@
      const m = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      if (m) {
        const start = parseInt(m[1], 10)
        const count = m[2] ? parseInt(m[2], 10) : 1
        for (let i = 0; i < count; i++) addedLines.add(start + i)
      }
    }
    return addedLines
  } catch {
    return new Set()
  }
}

/**
 * 全量档的扫描集:本门只审 PROJECT_PLAN.md 一份。工作树读取经 face-reader 的
 * `readWorktreeFile` 唯一出口(不存在的 ⇒ null,由调用方报"少扫一个"而不是假装通过)。
 */
function getAllMdFiles() {
  return ['PROJECT_PLAN.md']
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

const entries = [] // {rel, md}
if (isStaged) {
  const paths = getStagedMdPaths()
  if (paths.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .md 变更,跳过${C.reset}`)
    process.exit(0)
  }
  // 内容取自**索引 blob**(`:<path>` 规格)——不是磁盘:磁盘副本是别人的在飞现场
  const blobs = catBatch(ROOT, paths.map((p) => `:${p}`))
  const missing = []
  for (const p of paths) {
    const md = blobs.get(`:${p}`)
    if (md === null || md === undefined) {
      missing.push(p)
      continue
    }
    entries.push({ rel: p, md })
  }
  if (missing.length > 0) {
    console.log(
      `${C.yellow}⚠️ ${missing.length} 个 staged .md 的索引 blob 取不到(未判定,不冒充通过):${missing.join(', ')}${C.reset}`,
    )
  }
  if (entries.length === 0) {
    console.log(`${C.yellow}⚠️ staged .md 全部取不到索引 blob ⇒ 无法判定${C.reset}`)
    process.exit(2)
  }
} else {
  for (const rel of getAllMdFiles()) {
    const md = readWorktreeFile(ROOT, rel)
    if (md === null || md === undefined) {
      console.log(`${C.yellow}⚠️ ${rel} 在工作树不存在,本轮少扫一份(未判定 ≠ 通过)${C.reset}`)
      continue
    }
    entries.push({ rel, md })
  }
}

let totalViolations = 0
const fileReports = []

for (const { rel, md } of entries) {
  const sections = splitSections(md)
  // staged 模式下只检查含新增行的章节,避免历史违规阻塞新 commit
  const addedLines = isStaged ? getAddedLineNumbers(rel) : null
  const findings = []
  for (const section of sections) {
    // staged 模式:跳过不含任何新增行的章节(历史章节)
    if (addedLines && addedLines.size > 0) {
      const sectionEnd = section.startLine + section.body.length
      let hasAdded = false
      for (let ln = section.startLine; ln <= sectionEnd; ln++) {
        if (addedLines.has(ln)) { hasAdded = true; break }
      }
      if (!hasAdded) continue
    }
    const issues = checkSection(section)
    findings.push(...issues)
  }
  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: rel, findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${entries.length} 个`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
