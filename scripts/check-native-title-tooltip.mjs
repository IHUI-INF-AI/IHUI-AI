#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 浏览器原生 title tooltip 守门 — 防止新增 HTML title 属性用于 hover 提示。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制):所有 hover 提示必须用项目统一
 * Tooltip 组件(`@/components/feedback` 或 `@ihui/ui` 的 Tooltip,基于 Radix,
 * 样式 bg-popover 灰底 + border + Arrow + fade/zoom 动画),禁止用浏览器原生
 * HTML title 属性(浏览器默认样式:无 border、无动画、字体/颜色与项目不一致、
 * 延迟 1s+ 才显示)。
 *
 * 违规模式:HTML 元素或 <Button> 上的 title= prop 用于 hover 提示
 *   - <button title="..."> / <Button title="...">
 *   - <td title="..."> / <div title="..."> / <span title="..."> / <p title="..."> / <a title="...">
 *   - <img title="..."> / <svg title="...">
 *
 * 豁免(不视为违规):
 *   1. component 自己的 prop(非 HTML title):<Modal title=...> / <Alert title=...> /
 *      <StatCard title=...> / <ToolHeader title=...> / <Section title=...> /
 *      <ResultGroup title=...> / <Empty title=...> / <Card title=...> / <Accordion title=...> /
 *      <Drawer title=...> / <ConfirmDialog title=...> / <Toast title=...> 等
 *   2. <Button asChild title=...>:asChild 透传给子元素,Tooltip 包裹会破坏布局(后续由专门规则处理)
 *   3. iframe title=...:a11y 必需(WCAG)
 *   4. <html title=...> / <head title=...> / <Document title=...>:SEO 元数据
 *   5. 装饰元素 alt + title 共存(img alt 已有 fallback,title 重复无意义但不算违规)
 *
 * 用法:
 *   node scripts/check-native-title-tooltip.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-native-title-tooltip.mjs             (全量扫描报告, exit 0)
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

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build',
  '.worktrees', '.venv', 'tests', '__tests__', '.trae-cn',
  '.output', '.wxt', 'coverage',
])

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

/** Component prop 形式的 title 豁免清单(这些 component 自己的 prop,不是 HTML title 属性) */
const COMPONENT_TITLE_EXEMPT = new Set([
  'Modal', 'Alert', 'StatCard', 'StatChart', 'ToolHeader', 'Section',
  'ResultGroup', 'Empty', 'Card', 'CardHeader', 'CardTitle', 'CardDescription',
  'Accordion', 'AccordionItem', 'Drawer', 'ConfirmDialog', 'Toast',
  'Dialog', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription',
  'Popover', 'Dropdown', 'Tabs', 'TabsList', 'TabsTrigger', 'TabsContent',
  'FeatureCenterHeader', 'ToolCard', 'Stat', 'Chart',
  'Skeleton', 'Tooltip', 'TooltipContent',
])

/** HTML 原生元素 + 项目 Button 组件,凡是 title= 都视为违规 */
const HTML_ELEMENTS_WITH_TITLE = /^(button|Button|td|div|span|p|a|img|svg|label|input|textarea|select|option|li|h[1-6]|form|fieldset|legend|table|thead|tbody|tfoot|tr|caption|dl|dt|dd|nav|header|footer|main|section|article|aside|figure|figcaption|video|audio|source|track|canvas|iframe|embed|object|param|map|area|details|summary|dialog|progress|meter|time|mark|abbr|address|cite|blockquote|q|pre|code|kbd|samp|var|wbr|bdi|bdo|dfn|ruby|rt|rp|b|strong|i|em|u|s|strike|del|ins|sub|sup|small|big|font|basefont|center|tt|marquee|blink|nobr|spacer|multicol|layer|ilayer|nolayer|bgsound)$/

/**
 * 违规判定 — 返回 true 表示该行违规(应使用 Tooltip 替代)。
 */
function isViolation(line) {
  const trimmed = line.trim()

  // 豁免 0: 注释行
  if (/^\s*(\/\/|\/\*|\*)/.test(trimmed)) return false

  // 豁免 1: <Button asChild title=...>(asChild 透传,不在本守门范围)
  if (/<Button\b[^>]*\basChild\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 2: iframe title=...(a11y 必需,WCAG)
  if (/<iframe\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 3: <Document title=...> / <html title=...> / <head title=...>(SEO 元数据)
  if (/<(?:Document|html|head|title)\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 4: component 自己的 prop(<Modal title=...> 等)
  for (const comp of COMPONENT_TITLE_EXEMPT) {
    const re = new RegExp(`<${comp}\\b[^>]*\\btitle=`)
    if (re.test(trimmed)) return false
  }

  // 违规 1: <Button title=...>(非 asChild)
  if (/<Button\b[^>]*\btitle=/.test(trimmed)) return true

  // 违规 2: <button title=...>
  if (/<button\b[^>]*\btitle=/.test(trimmed)) return true

  // 违规 3: <td|div|span|p|a|img|svg|label|input|textarea|select|li|... title=...>
  // 匹配 HTML 原生元素(全小写)
  const m = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\btitle=/)
  if (m) {
    const tag = m[1]
    if (HTML_ELEMENTS_WITH_TITLE.test(tag)) return true
  }

  return false
}

function collectFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, result)
    } else if (SCAN_EXTS.some((e) => entry.endsWith(e))) {
      result.push(full)
    }
  }
  return result
}

function getStagedAddedLines() {
  const result = new Map()
  let output
  try {
    output = execSync('git diff --cached -U0 --diff-filter=ACM --no-color', {
      encoding: 'utf8',
      cwd: ROOT,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return result
  }
  if (!output) return result

  let curFile = null
  let curLine = 0
  for (const raw of output.split('\n')) {
    if (raw.startsWith('diff --git')) {
      const m = raw.match(/\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/)
      curLine = m ? parseInt(m[1], 10) : 0
      continue
    }
    if (curFile && curLine > 0) {
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        if (!result.has(curFile)) result.set(curFile, new Set())
        result.get(curFile).add(curLine)
        curLine++
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // 删除行,不推进 curLine
      } else {
        curLine++
      }
    }
  }
  return result
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
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => !EXCLUDE_DIRS.has(f.split('/')[0]))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f))
  } catch {
    return []
  }
}

console.log(
  `${C.cyan}${C.bold}[原生 title tooltip 守门] 扫描 HTML title= 违规...${C.reset}`,
)
console.log(
  `${C.dim}规则: hover 提示必须用项目 <Tooltip>(@/components/feedback), 禁用原生 HTML title 属性${C.reset}`,
)
console.log(
  `${C.dim}豁免: <Modal/Alert/StatCard/...> 等 component 自带 title prop / <Button asChild title> / <iframe title>(a11y)${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规阻塞 commit)' : '全量 (warn-only, exit 0)'}${C.reset}`,
)
console.log('')

let files = []
let addedLinesMap = new Map()

if (isStaged) {
  addedLinesMap = getStagedAddedLines()
  files = getStagedFiles().filter((f) => addedLinesMap.has(f))
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .ts/.tsx/.js/.jsx 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  for (const sub of ['apps', 'packages']) {
    files = files.concat(collectFiles(join(ROOT, sub)))
  }
}

let totalViolations = 0
const fileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    if (!isViolation(line)) return

    const m = line.match(/\btitle=/)
    findings.push({
      line: lineNumber,
      col: m ? m.index + 1 : 0,
      snippet: line.trim().slice(0, 140),
    })
  })

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
  console.log(
    `${C.green}${C.bold}✅ 原生 title tooltip 守门通过${C.reset}`,
  )
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[title]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(
  `  1. <Button title="编辑"> → <Tooltip content="编辑"><Button>...</Button></Tooltip>`,
)
console.log(
  `  2. <td className="truncate" title={value}>{value}</td> → <td><TruncatedText value={value} /></td>`,
)
console.log(
  `  3. <div title={value}>...</div> → <Tooltip content={value}><div>...</div></Tooltip>`,
)
console.log(
  `  4. component prop(如 <Modal title=...>) 不算违规,无需修改`,
)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 原生 title tooltip 守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
