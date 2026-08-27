#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 分割线守门 — 防止新增分割线类视觉元素。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(强制)与"禁止分割线(强制)":
 *   禁止 `<hr>` / divide-y / divide-x / 单边 border-t/b/l/r 当分割线。
 *   允许:容器完整描边(border border-border)、背景色对比、间距分隔(gap-* 或 space-y-*)。
 *
 * 检测三类模式:
 *   1) divide-y / divide-x(纯列表分隔工具类)→ 违规(BLOCKING)
 *   2) 字面量 `<hr>` 标签(无歧义的分割线)→ 违规(BLOCKING,注释内豁免)
 *   3) 显式低透明度单边边框分割线,如 `border-t border-border/50`、`border-b
 *      border-border/40`、`border-l border-border/30`、`border-r border-border/NN`
 *      (单边 border-[tblr] 配合低透明度 border-border 颜色)→ 违规(WARN,非阻塞,
 *      避免误伤合法的"结构性边框",见 AGENTS.md §4 单边边框区分)
 *
 * 关于单边 border 的永久规则(AGENTS.md §4 已澄清):
 *   结构性边框(容器完整边框系统的一部分 / blockquote 语义强调 / IDE diff 面板等)
 *   允许;纯分隔线(列表项或区块之间)用 space-y-* 间距或 bg-muted 背景对比替代。
 *   第 3 类以低透明度 border-border 组合出现,属典型"伪分割线",故告警提示。
 *
 * 用法:
 *   node scripts/check-no-divider.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-no-divider.mjs             (全量扫描报告, exit 0)
 *
 * 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isHelp = process.argv.includes('--help')

// 跳过方法(紧急):HUSKY_SKIP_NO_DIVIDER=1 git commit ...
if (process.env.HUSKY_SKIP_NO_DIVIDER === '1') {
  console.log('⏭  分割线守门(HUSKY_SKIP_NO_DIVIDER=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-no-divider.mjs — 分割线守门(divide-y / divide-x)

用法:
  node scripts/check-no-divider.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-divider.mjs             全量扫描报告(exit 0)
  node scripts/check-no-divider.mjs --help      显示本帮助

判定:
  - divide-y / divide-x:className / 字符串字面量中出现即违规(BLOCKING,注释行豁免)
  - <hr 标签:字面量出现即违规(BLOCKING,注释内豁免)
  - 低透明度单边边框(如 border-t border-border/50):WARN(非阻塞,注释行豁免)
`)
  process.exit(0)
}

// 排除目录:共享 EXCLUDE_DIRS + 脚本特有(构建产物/测试/注释无害目录)
const EXCLUDE_DIRS = withExcludes([
  '.trae-cn',
  'tests',
  '__tests__',
  'e2e',
  'out',
  'node_modules',
  'dist',
  'build',
  '.next',
  'public',
  'coverage',
])

// 只扫源码(divide-y/divide-x 是 className 工具类,不会出现在纯 CSS 生成产物之外)
const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

/** 违规模式:divide-y / divide-x(独立 class token;用 \b 词边界,兼容引号包裹的 className) */
const VIOLATION_RE = /\bdivide-[yx]\b/

/** 违规模式:字面量 <hr 标签(无歧义分割线,大小写敏感匹配小写 hr 元素) */
const HR_RE = /<hr\b/

/**
 * 违规模式(WARN):显式低透明度单边边框分割线。
 * 同一行同时出现「单边 border-[tblr]」与「低透明度 border-border/数字」，
 * 用前瞻断言兼容两种书写顺序。例:border-t border-border/50、border-r border-border/30。
 */
const LOW_OPACITY_BORDER_RE =
  /\bborder-[tblr]\b(?=[\s\S]*\bborder-border\/\d+\b)|\bborder-border\/\d+\b(?=[\s\S]*\bborder-[tblr]\b)/

/**
 * 豁免判定 — 返回 true 表示该行不算违规。
 * 仅豁免注释行(// 单行、/* 块注释、* 列表项、JSX {/* 块注释),
 * 以及行内 // 注释之后出现的 divide-(避免误伤说明性注释)。
 * divide-y / divide-x 无合法 UI 用途,故不做内容豁免。
 */
function isExempt(line) {
  const trimmed = line.trim()
  // 豁免 1:整行以注释符号开头
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true
  // 豁免 2:行内 // 注释之后出现 divide-(说明性注释)
  const m = line.match(/divide-[yx]\b/)
  if (m && line.slice(0, m.index).includes('//')) return true
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
    if (raw.startsWith('+++ b/')) {
      const m = raw.match(/^\+\+\+\s+b\/(.+)$/)
      curFile = m ? join(ROOT, m[1]) : null
      curLine = 0
      continue
    }
    if (raw.startsWith('diff --git')) {
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
  `${C.cyan}${C.bold}[分割线守门] 扫描 divide-y / divide-x 违规...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 禁止 divide-y/divide-x 当分割线,改用 space-y-* 间距或 bg-muted 对比${C.reset}`,
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
let totalWarn = 0
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
    if (isExempt(line)) return

    // 1) divide-y / divide-x → BLOCKING
    const dm = VIOLATION_RE.exec(line)
    if (dm) {
      findings.push({
        line: lineNumber,
        col: dm.index + 1,
        level: 'blocking',
        label: line.match(/divide-y\b/) ? 'divide-y' : 'divide-x',
        snippet: line.trim().slice(0, 140),
      })
      return
    }

    // 2) 字面量 <hr 标签 → BLOCKING
    const hm = HR_RE.exec(line)
    if (hm) {
      findings.push({
        line: lineNumber,
        col: hm.index + 1,
        level: 'blocking',
        label: '<hr>',
        snippet: line.trim().slice(0, 140),
      })
      return
    }

    // 3) 低透明度单边边框分割线 → WARN(非阻塞)
    const lm = LOW_OPACITY_BORDER_RE.exec(line)
    if (lm) {
      findings.push({
        line: lineNumber,
        col: lm.index + 1,
        level: 'warn',
        label: 'low-opacity single border',
        snippet: line.trim().slice(0, 140),
      })
    }
  })

  if (findings.length > 0) {
    for (const f of findings) {
      if (f.level === 'blocking') totalViolations++
      else totalWarn++
    }
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处 (BLOCKING)`)
console.log(`  告警数:   ${totalWarn} 处 (WARN, 不阻塞)`)
console.log('')

if (totalViolations === 0 && totalWarn === 0) {
  console.log(`${C.green}${C.bold}✅ 分割线守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规 + ${totalWarn} 处告警:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    const tag = f.level === 'blocking' ? C.red : C.yellow
    const lvl = f.level === 'blocking' ? '[BLOCKING]' : '[WARN]'
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${tag}${lvl} [${f.label}]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 列表容器用 space-y-* 间距分隔(推荐,§4 允许的"间距分隔")`)
console.log(`  2. 或用 bg-muted / bg-card 背景色对比区分区块(§4 允许的"背景色对比")`)
console.log(`  3. 容器完整描边用 border border-border(单边 border-t/b/l/r 当分割线仍禁止)`)
console.log(`  4. <hr> 标签一律禁止,改用上述替代方案`)
console.log(`  5. 低透明度单边边框(border-t border-border/50 等)属典型伪分割线,WARN 提示;`)

console.log(`     若确属结构性边框(容器边框系统一部分 / blockquote 语义强调 / IDE diff 面板),`)
console.log(`     请确认其非纯分隔用途;纯分隔线改用间距或背景对比`)
console.log(`  6. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"`)
console.log('')

if (isStaged && totalViolations > 0) {
  console.log(`${C.red}${C.bold}❌ 分割线守门失败 — 提交已阻止${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_NO_DIVIDER=1 git commit ...${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
