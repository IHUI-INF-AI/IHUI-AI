#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
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
  '.output', '.wxt', 'coverage', 'out',
  'target', // Rust/Cargo 构建输出(rustdoc 生成的 JS 含 HTML 模板字符串,非 JSX,gitignored)
  'public', // Next.js 静态资源目录(内含 monaco editor minified JS,含 'title=' 字面量但非 JSX)
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
 *
 * @param line  当前行内容
 * @param inJsxTag  当前正在跟踪的未关闭 JSX tag(由调用方维护),如 { tagName, hasAsChild }
 *                  undefined 表示当前不在任何未关闭 tag 内
 */
function isViolation(line, inJsxTag) {
  const trimmed = line.trim()

  // 豁免 0: 注释行
  if (/^\s*(\/\/|\/\*|\*)/.test(trimmed)) return false

  // 豁免 1: <Button asChild title=...>(asChild 透传,不在本守门范围)
  if (/<Button\b[^>]*\basChild\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 2: iframe title=...(a11y 必需,WCAG)
  if (/<iframe\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 3: <Document title=...> / <html title=...> / <head title=...>(SEO 元数据)
  if (/<(?:Document|html|head|title)\b[^>]*\btitle=/.test(trimmed)) return false

  // 豁免 4: component 自己的 prop(<Modal title=...> 等,即使跨多行)
  if (inJsxTag && COMPONENT_TITLE_EXEMPT.has(inJsxTag.tagName)) return false

  // 违规 1: <Button title=...>(非 asChild,单行)
  if (/<Button\b[^>]*\btitle=/.test(trimmed)) {
    // 已经被豁免 1 排除 asChild,此处直接违规
    return true
  }

  // 违规 2: <button title=...>(单行)
  if (/<button\b[^>]*\btitle=/.test(trimmed)) return true

  // 违规 3: 单行 <TagName ... title=...>(HTML 原生元素)
  const m = trimmed.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\btitle=/)
  if (m) {
    const tag = m[1]
    if (HTML_ELEMENTS_WITH_TITLE.test(tag)) return true
  }

  // 违规 4: 多行 JSX — title= 单独一行,前面有未关闭的 <Button or <html tag
  // 例:
  //   <Button                       (line N, 开启未关闭 tag)
  //     type="button"               (line N+1)
  //     title={t('deleteGroup')}    (line N+2, 本行检测到 title=)
  //   >                             (line N+3, tag 关闭)
  if (inJsxTag) {
    if (
      /\btitle=/.test(trimmed) &&
      (inJsxTag.tagName === 'Button' || HTML_ELEMENTS_WITH_TITLE.test(inJsxTag.tagName)) &&
      !inJsxTag.hasAsChild
    ) {
      return true
    }
  }

  return false
}

/**
 * 扫描单文件,返回违规列表。
 *
 * 多行 JSX 支持(2026-08-07 增强):维护"未关闭 JSX tag"状态机,
 * 当某行含 title= 但自身无 <TagName 时,检查是否在某个未关闭 tag 内。
 *
 * 关键陷阱(2026-08-07 修):关闭判定不能简单看 trimmed.includes('>'),
 * 因为箭头函数 onClick={() => ...} 也有 `>`,会被误判为 tag 关闭。
 * 正确做法:仅当整行 trimmed 是 `>` 或 `/>`(纯关闭标记)时才清空 inJsxTag。
 *
 * @returns Array<{line: number, col: number, snippet: string}>
 */
function scanFile(src) {
  const lines = src.split('\n')
  const findings = []
  // 状态:最近一个未关闭的 JSX tag(同时只能跟踪 1 个,简化复杂度)
  let inJsxTag = null

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const lineNumber = idx + 1
    const trimmed = line.trim()

    // 1. 检测违规(利用当前 inJsxTag 状态)
    if (isViolation(line, inJsxTag)) {
      const m = line.match(/\btitle=/)
      findings.push({
        line: lineNumber,
        col: m ? m.index + 1 : 0,
        snippet: trimmed.slice(0, 140),
      })
    }

    // 2. 更新 inJsxTag 状态
    // 2a. 检测"开启新 tag 但未在同一行关闭"
    //   - 模式 A:单行 <TagName ... > (tag 完整,无未关闭)
    //   - 模式 B:多行 <TagName ... \n  (tag 跨行,设置 inJsxTag)
    const hasOpening = /<([A-Z][a-zA-Z0-9]*)\b/.exec(trimmed) // 仅大写开头(组件)
    if (hasOpening) {
      // 找该行最后一个 > 位置
      const lastGt = trimmed.lastIndexOf('>')
      const firstLt = trimmed.indexOf('<')
      if (lastGt === -1 || lastGt < firstLt) {
        // tag 未在本行关闭(只有开 tag,没有 >)
        inJsxTag = {
          tagName: hasOpening[1],
          hasAsChild: /\basChild\b/.test(trimmed),
          startLine: lineNumber,
        }
      } else {
        // tag 完整关闭
        inJsxTag = null
      }
    } else if (inJsxTag && /^\s*\/?>\s*$/.test(line)) {
      // 2b. 之前有未关闭 tag,本行是纯关闭标记 `>` 或 `/>`
      // 严格匹配:整行只有 `>`(避免箭头函数 `=>` 误判)
      inJsxTag = null
    }
  }
  return findings
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
    // 修复:`+++ b/path` 是 diff 输出中的独立行(紧跟 `diff --git` 后),
    // 必须单独判断;原来错误地放在 `diff --git` 块内匹配导致 curFile 始终为 null。
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
      // `diff --git a/x b/x` 行仅作分隔符,文件路径在下一行 `+++ b/` 上
      curFile = null
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

// ============================================================
// 文件收集(供 title 检测 + Tooltip+disabled 检测共用)
// ============================================================
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

// ============================================================
// 新增:Tooltip + disabled Button 检测
// 根因:Radix UI TooltipTrigger 对 disabled 元素不触发 pointer 事件,
// 必须用 <span className="inline-flex"> 包裹 disabled Button。
// ============================================================
console.log(`${C.cyan}${C.bold}[Tooltip + disabled 检测] 扫描 Tooltip 直接包裹 disabled Button...${C.reset}`)
console.log(`${C.dim}规则: <Tooltip> 内 <Button disabled> 必须用 <span className="inline-flex"> 包裹${C.reset}`)
console.log('')

/**
 * 扫描文件中 Tooltip 直接包裹 disabled Button 的模式。
 * 使用正则查找 <Tooltip...>...</Tooltip> 块,检查其中是否含 disabled= 且无 span 包裹。
 */
function checkDisabledTooltip(src) {
  const findings = []
  const tooltipRe = /<Tooltip\b[\s\S]*?<\/Tooltip>/g
  let match
  while ((match = tooltipRe.exec(src)) !== null) {
    const block = match[0]
    // 跳过不含 disabled 的 Tooltip 块
    if (!block.includes('disabled=')) continue
    // 跳过不含 Button 的 Tooltip 块
    if (!block.includes('Button')) continue
    // 检查是否已有 span 包裹
    if (/<span[^>]*>[\s\S]*?disabled=/.test(block)) continue

    // 未包裹 — 计算行号
    const before = src.slice(0, match.index)
    const line = (before.match(/\n/g) || []).length + 1
    const disabledMatch = block.match(/disabled=\{([^}]+)\}/)
    const disabledVal = disabledMatch ? disabledMatch[1].slice(0, 60) : '?'
    const contentMatch = block.match(/content=\{([^}]+)\}/)
    const tooltipContent = contentMatch ? contentMatch[1].slice(0, 40) : '?'

    findings.push({
      line,
      snippet: `Tooltip content="${tooltipContent}" wraps disabled Button (disabled=${disabledVal})`,
    })
  }
  return findings
}

let dtViolations = 0
const dtFileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('Tooltip') || !src.includes('disabled=')) continue
  const findings = checkDisabledTooltip(src)
  // staged 模式只保留 added 行
  const dtFindings = isStaged
    ? findings.filter((f) => {
        const allowed = addedLinesMap.get(file)
        return allowed && allowed.has(f.line)
      })
    : findings

  if (dtFindings.length > 0) {
    dtViolations += dtFindings.length
    dtFileReports.push({ file: relative(ROOT, file), findings: dtFindings })
  }
}

if (dtViolations > 0) {
  console.log(`${C.red}${C.bold}❌ 发现 ${dtViolations} 处 Tooltip + disabled Button 违规:${C.reset}`)
  console.log('')
  for (const { file, findings } of dtFileReports) {
    console.log(`${C.red}${file}${C.reset}`)
    for (const f of findings) {
      console.log(
        `  ${C.dim}行 ${f.line}${C.reset} ${C.red}[disabled]${C.reset} ${f.snippet}`,
      )
    }
    console.log('')
  }
  console.log(`${C.dim}修复方法:${C.reset}`)
  console.log(`  <Tooltip content={...}>`)
  console.log(`    <span className="inline-flex">`)
  console.log(`      <Button disabled={...}>...</Button>`)
  console.log(`    </span>`)
  console.log(`  </Tooltip>`)
  console.log('')
  console.log(`${C.dim}根因: Radix UI TooltipTrigger 对 disabled 元素不触发 pointer 事件,`)
  console.log(`${C.dim}必须用 <span> 包裹使 TooltipTrigger 挂在 span 上(非 disabled)。${C.reset}`)
  console.log('')
}

console.log(`${C.bold}Tooltip + disabled 检测结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${dtViolations} 处`)
console.log('')

// ============================================================
// 原有 title 检测逻辑
// ============================================================
let totalViolations = 0
const fileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // 2026-08-07:改为文件级扫描,支持多行 JSX title= 检测
  const allFindings = scanFile(src)
  // staged 模式只保留 added 行;全量模式保留全部
  const findings = isStaged
    ? allFindings.filter((f) => {
        const allowed = addedLinesMap.get(file)
        return allowed && allowed.has(f.line)
      })
    : allFindings

  if (findings.length > 0) {
    totalViolations += findings.length
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log('')

if (totalViolations > 0) {
  console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处原生 title 违规:${C.reset}`)
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
}

const anyViolation = totalViolations > 0 || dtViolations > 0

if (isStaged && anyViolation) {
  console.log(`${C.red}${C.bold}❌ 守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else if (!anyViolation) {
  console.log(`${C.green}${C.bold}✅ 所有守门检查通过${C.reset}`)
  process.exit(0)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
