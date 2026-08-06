#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 圆角溢出守门 — 防止"父容器有 rounded-* + 无 overflow-hidden + 子元素 bg-* + 无 rounded-* + 贴边无 margin"
 * 导致的圆角溢出(子元素背景色从父容器圆角处冒出直角)。
 *
 * 触发场景(2026-08-06 立,真实事故):
 *   apps/web/src/components/chat/message-input.tsx 权限模式切换栏
 *   原代码:<div className="rounded-xl border bg-card">  ← 父容器
 *           <div className="flex bg-muted/50 px-2 py-1.5">  ← 子元素无 rounded-t-xl,背景色从顶部圆角冒出直角
 *   修复后:子元素添加 rounded-t-xl 与父容器圆角对齐
 *
 * 判定标准(硬性,缺一不可):
 *   1. 父容器 className 含 rounded-xl|rounded-lg|rounded-md|rounded-2xl
 *   2. 父容器 className 不含 overflow-hidden
 *   3. 子元素 className 含 bg-*(非 bg-transparent/bg-none)
 *   4. 子元素 className 不含 rounded-*(无圆角对齐)
 *   5. 子元素 className 不含 m-| mt-| mx-| ml-| mr-(无 margin 间隔,贴边)
 *   6. 子元素 className 不含 absolute / fixed(定位元素不参与溢出)
 *
 * 豁免(不报为违规):
 *   - 父容器有 overflow-hidden(已有防护)
 *   - 子元素背景透明(bg-transparent / bg-none / bg-[transparent])
 *   - 子元素是 absolute / fixed 定位
 *   - 子元素有 margin(m-| mt-| mx-| ml-| mr-)
 *   - 子元素已有对应圆角(rounded-* / rounded-t-* / rounded-l-* 等)
 *
 * 用法:
 *   node scripts/check-rounded-overflow.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-rounded-overflow.mjs             (全量扫描报告, exit 0)
 *   node scripts/check-rounded-overflow.mjs --help      (帮助)
 *
 * 跳过方法(紧急):HUSKY_SKIP_ROUNDED_OVERFLOW=1 git commit ...
 *
 * 注:本脚本采用行级启发式 + className 跨行合并 + 缩进判断父子关系,准确度 ~90%。
 *     warn-only 起步(不阻塞 commit),1 周后(2026-08-13)评估升级 blocking。
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isHelp = process.argv.includes('--help')

// 跳过方法(紧急):HUSKY_SKIP_ROUNDED_OVERFLOW=1 git commit ...
if (process.env.HUSKY_SKIP_ROUNDED_OVERFLOW === '1') {
  console.log('⏭  圆角溢出守门(HUSKY_SKIP_ROUNDED_OVERFLOW=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-rounded-overflow.mjs — 圆角溢出守门

用法:
  node scripts/check-rounded-overflow.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-rounded-overflow.mjs             全量扫描报告(exit 0)
  node scripts/check-rounded-overflow.mjs --help      显示本帮助

判定标准(硬性,缺一不可):
  1. 父容器 className 含 rounded-xl|rounded-lg|rounded-md|rounded-2xl
  2. 父容器 className 不含 overflow-hidden
  3. 子元素 className 含 bg-*(非透明)
  4. 子元素 className 不含 rounded-*(无圆角对齐)
  5. 子元素 className 不含 m-*(无 margin 间隔,贴边)
  6. 子元素 className 不含 absolute / fixed

跳过方法(紧急):HUSKY_SKIP_ROUNDED_OVERFLOW=1 git commit ...
`)
  process.exit(0)
}

// 排除目录:基于共享 EXCLUDE_DIRS,追加脚本特有
const EXCLUDE_DIRS = withExcludes(['.trae-cn', 'tests', '__tests__', 'e2e'])

// 只扫描 .tsx / .jsx(JSX 才有 className)
const SCAN_EXTS = ['.tsx', '.jsx']

// 父容器圆角类(rounded-sm/rounded 太小不构成视觉溢出,只检测 >= 6px 的圆角)
const PARENT_ROUNDED_RE = /(?:^|\s)rounded-(?:xl|2xl|lg|md)\b/

// overflow-hidden 标记
const OVERFLOW_HIDDEN_RE = /overflow-hidden/

// 子元素背景色类(非透明)
const CHILD_BG_RE = /(?:^|\s)bg-(?!transparent|none\b)[a-z]/

// 子元素透明背景豁免
const CHILD_BG_TRANSPARENT_RE = /(?:^|\s)bg-(?:transparent|none\b)/

// 子元素已有圆角(任意 rounded 类,包括 rounded / rounded-sm / rounded-t-xl / rounded-l-lg 等)
// 注意:rounded(无后缀,4px)也是有效圆角,必须匹配
const CHILD_ROUNDED_RE = /(?:^|\s)rounded(?:-[a-z]+)?\b/

// 子元素 margin(任意 m-* / mt-* / mx-* / ml-* / mr-* / mb-*)
const CHILD_MARGIN_RE = /(?:^|\s)(?:m|mt|mb|ml|mr|mx|my)-(?:[0-9]|auto|px)/

// 子元素定位(absolute / fixed)
const CHILD_POSITION_RE = /(?:^|\s)(?:absolute|fixed)\b/

/**
 * 从文件内容中提取每个 JSX 元素的 className 字符串 + 起始行号 + 缩进。
 * 处理 className="..." / className='...' / className={cn(...)} / className={`...`} 跨行情况。
 * 返回数组:[{ line, indent, className, tagStartLine, tagEndLine }]
 */
function extractJsxElements(src) {
  const lines = src.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 匹配 JSX 开标签行(含 className=)
    const tagMatch = line.match(/^(\s*)<[A-Za-z][a-zA-Z0-9]*[\s/>]/)
    if (!tagMatch) {
      i++
      continue
    }
    const indent = tagMatch[1].length
    const startLine = i + 1

    // 提取 className 内容(可能跨多行)
    const classNameResult = extractClassName(lines, i)
    if (classNameResult) {
      elements.push({
        line: startLine,
        indent,
        className: classNameResult.value,
        tagStartLine: startLine,
        tagEndLine: classNameResult.endLine + 1,
      })
      // 跳到 className 结束行之后继续(可能同行有多个属性,但简化处理)
      i = classNameResult.endLine + 1
      continue
    }
    i++
  }
  return elements
}

/**
 * 从指定行开始提取 className 的值。
 * 支持:className="..." / className='...' / className={cn(...)} / className={`...`}
 * 返回 { value, endLine } 或 null。
 */
function extractClassName(lines, startIdx) {
  // 合并后续若干行直到找到 className 完整内容(最多 20 行防止无限循环)
  let combined = ''
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 20); j++) {
    combined += lines[j] + '\n'
    // 找 className=
    const clsMatch = combined.match(/className\s*=\s*("([^"]*)"|'([^']*)'|`([^`]*)`|\{([^}]+)\})/)
    if (clsMatch) {
      // 提取引号/大括号内的内容
      const value = clsMatch[2] ?? clsMatch[3] ?? clsMatch[4] ?? clsMatch[5] ?? ''
      // 计算 endLine:找 className= 在 combined 中的位置,数换行
      const clsIdx = combined.indexOf('className')
      const beforeCls = combined.slice(0, clsIdx)
      const lineOffset = (beforeCls.match(/\n/g) || []).length
      return { value, endLine: startIdx + lineOffset }
    }
    // 如果遇到下一个开标签或闭合标签,放弃
    if (j > startIdx && /^\s*<[A-Za-z/]/.test(lines[j])) break
  }
  return null
}

/**
 * 找父元素的直接子元素(下一个缩进更深的开标签)。
 * 返回 { child, childLine } 或 null。
 */
function findDirectChild(elements, parentIdx) {
  const parent = elements[parentIdx]
  if (!parent) return null
  // 在父元素之后找第一个缩进比父元素深的开标签
  for (let k = parentIdx + 1; k < elements.length; k++) {
    const child = elements[k]
    if (child.indent <= parent.indent) break // 缩进回退到父级或更浅,结束
    // 找到第一个子元素
    return { child, childLine: child.line }
  }
  return null
}

/**
 * 判定是否为圆角溢出违规。
 */
function isViolation(parentClassName, childClassName) {
  if (!parentClassName || !childClassName) return false

  // 父容器必须有 rounded-xl/2xl/lg/md
  if (!PARENT_ROUNDED_RE.test(parentClassName)) return false

  // 父容器有 overflow-hidden 则豁免
  if (OVERFLOW_HIDDEN_RE.test(parentClassName)) return false

  // 子元素必须有 bg-*(非透明)
  if (!CHILD_BG_RE.test(childClassName)) return false
  if (CHILD_BG_TRANSPARENT_RE.test(childClassName) && !CHILD_BG_RE.test(childClassName.replace(CHILD_BG_TRANSPARENT_RE, ''))) {
    // 透明背景豁免(但如果同时有非透明 bg-* 则继续判断)
    return false
  }

  // 子元素已有圆角则豁免
  if (CHILD_ROUNDED_RE.test(childClassName)) return false

  // 子元素有 margin 则豁免(不贴边)
  if (CHILD_MARGIN_RE.test(childClassName)) return false

  // 子元素是 absolute/fixed 则豁免
  if (CHILD_POSITION_RE.test(childClassName)) return false

  return true
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

/**
 * 从 git diff --cached -U0 输出中提取每个文件的新增行(+ 开头)及其行号。
 */
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

console.log(`${C.cyan}${C.bold}[圆角溢出守门] 扫描"父 rounded-* + 无 overflow-hidden + 子 bg-* + 无 rounded-* + 贴边"模式...${C.reset}`)
console.log(
  `${C.dim}规则: 父容器 rounded-xl/lg/md/2xl + 无 overflow-hidden + 子元素 bg-* + 无 rounded-* + 无 margin + 非 absolute/fixed${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (新增违规则 exit 1)' : '全量 (warn-only, exit 0)'}${C.reset}`,
)
console.log('')

let files = []
let addedLinesMap = new Map()

if (isStaged) {
  addedLinesMap = getStagedAddedLines()
  files = getStagedFiles().filter((f) => addedLinesMap.has(f))
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无 .tsx/.jsx 变更,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  // 全量:扫 apps/ + packages/
  for (const sub of ['apps', 'packages']) {
    files = files.concat(collectFiles(join(ROOT, sub)))
  }
}

let totalViolations = 0
const fileReports = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const elements = extractJsxElements(src)

  const findings = []

  for (let p = 0; p < elements.length; p++) {
    const parent = elements[p]
    // staged 模式:父元素起始行或 className 结束行必须是新增行
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed) continue
      // 父容器开标签行或 className 行任一为新增行即触发检查
      const parentTouched = allowed.has(parent.tagStartLine) || allowed.has(parent.tagEndLine)
      if (!parentTouched) continue
    }

    const childResult = findDirectChild(elements, p)
    if (!childResult) continue
    const child = childResult.child

    if (!isViolation(parent.className, child.className)) continue

    // staged 模式:子元素也必须是新增行(父子任一新增即报)
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      const childTouched = allowed.has(child.tagStartLine) || allowed.has(child.tagEndLine)
      if (!childTouched) continue
    }

    findings.push({
      parentLine: parent.line,
      childLine: child.line,
      parentClassName: parent.className.trim().slice(0, 120),
      childClassName: child.className.trim().slice(0, 120),
      snippet: lines[child.line - 1]?.trim().slice(0, 140) || '',
    })
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
  console.log(`${C.green}${C.bold}✅ 圆角溢出守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.yellow}${C.bold}⚠️  发现 ${totalViolations} 处疑似圆角溢出:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.yellow}${file}${C.reset}`)
  for (const f of findings) {
    console.log(`  ${C.dim}父行 ${f.parentLine} → 子行 ${f.childLine}${C.reset}`)
    console.log(`    ${C.dim}父 className:${C.reset} ${f.parentClassName}`)
    console.log(`    ${C.dim}子 className:${C.reset} ${f.childClassName}`)
    console.log(`    ${C.dim}子元素行:${C.reset} ${f.snippet}`)
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 父容器添加 overflow-hidden(最简单,但会裁剪子元素溢出部分)`)
console.log(`  2. 子元素添加对应方向的圆角(推荐):`)
console.log(`     - 父 rounded-xl(12px)→ 子顶部贴边加 rounded-t-xl,底部贴边加 rounded-b-xl`)
console.log(`     - 父 rounded-lg(8px)→ 子顶部贴边加 rounded-t-lg`)
console.log(`     - 父 rounded-md(6px)→ 子顶部贴边加 rounded-t-md`)
console.log(`  3. 子元素加 margin(m-2 / mt-2 / mx-2)使其不贴边`)
console.log(`  4. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束"圆角容器内 absolute 子元素避让`)
console.log('')

if (isStaged) {
  // staged 模式:发现违规 exit 1,让 guardian-runner.mjs warn 模式接住(不阻塞 commit)
  // 1 周后(2026-08-13)评估升级 blocking:把 guardian-runner.mjs 中 11b 项 mode 从 'warn' 改为 'blocking'
  if (totalViolations > 0) {
    console.log(`${C.dim}跳过方法:HUSKY_SKIP_ROUNDED_OVERFLOW=1 git commit ...${C.reset}`)
    process.exit(1)
  }
  process.exit(0)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
