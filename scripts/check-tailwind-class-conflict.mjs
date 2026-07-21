#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Tailwind 同元素 size 类冲突守门(AGENTS.md 第 4 节派生规则)
 *
 * 根因(2026-07-21 M-64 类问题):JSX className 用模板字符串拼接时,基类
 * (e.g. `h-4 w-1.5`) 和三元条件分支(e.g. `${isActive ? '' : 'h-2 w-2'}`)
 * 会同时出现在 DOM 节点的 className 上。Tailwind 把同属性 utility 按源序
 * 排(`.h-4` 在 `.h-2` 之后,`.w-2` 在 `.w-1.5` 之后),后定义者获胜 →
 * 条件分支的 size 永远不生效,base 的 size 一直占主导,UI 与设计意图脱节。
 *
 * 正确写法:按 isX 分两套完整 className(分支互斥,DOM 上只出现一套)
 *   className={isActive ? 'h-4 w-1.5 ...' : 'h-2 w-2 ...'}
 * 错误写法(本守门要拦的):
 *   className={`h-4 w-1.5 ... ${isActive ? '' : 'h-2 w-2 ...'}`}
 *
 * 检测算法:
 *   1. className={...} 值是模板字面量(backticks) → 进入检查
 *   2. 提取 BASE = 模板字面量中 `${...}` 之外的字面文本
 *   3. 提取 BRANCHES = `${...}` 内所有字符串字面量(纯文字部分)
 *   4. 若 BASE 含 h-X 且任一 BRANCH 含 h-Y(X≠Y),或 BASE 含 w-X 且任一
 *      BRANCH 含 w-Y(X≠Y)→ CONFLICT
 *   5. 同一 BASE 多个 h 值 / BRANCH 多个 h 值不算冲突(用户可能就是想覆盖)
 *
 * 豁免(行内注释):
 *   // tailwind-class-conflict-allow  → 跳过该行
 *   /* tailwind-class-conflict-allow *\/  → 跳过该行
 *
 * 跳过场景:
 *   - className 是纯字符串("..."  或  '...'  无 backticks)
 *   - className 是纯三元 cond ? 'a' : 'b'(无模板字面量,分支互斥天然安全)
 *   - className 是 cn(...) 函数调用(无法静态分析,放过)
 *   - className 是变量引用(同上)
 *   - 纯注释行(说明规则)
 *   - 数值 size 类只在 BASE 或只在 BRANCH 出现(单边,无冲突)
 *
 * 用法:
 *   node scripts/check-tailwind-class-conflict.mjs --staged   (pre-commit, 阻塞)
 *   node scripts/check-tailwind-class-conflict.mjs             (全量扫描, exit 0)
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
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.worktrees',
  '.venv',
  'tests',
  '__tests__',
])

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

// Tailwind 标准数值 size 类(2.5% 步进 + 整数 + px)
const SIZE_VALUES =
  '(?:0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|5|6|7|8|9|10|11|12|14|16|20|24|28|32|36|40|44|48|52|56|60|64|72|80|96|px)'
// 静态 h-X / w-X(不含 hover:/group-hover:/focus: 等状态变体)
const H_STATIC_RE = new RegExp(`\\bh-(${SIZE_VALUES})\\b`, 'g')
const W_STATIC_RE = new RegExp(`\\bw-(${SIZE_VALUES})\\b`, 'g')

/**
 * 从文本中提取所有唯一的 h-X / w-X 数值
 */
function extractHValues(text) {
  return [...new Set([...text.matchAll(H_STATIC_RE)].map((m) => m[1]))]
}
function extractWValues(text) {
  return [...new Set([...text.matchAll(W_STATIC_RE)].map((m) => m[1]))]
}

/**
 * 解析 className 表达式,返回 { base, branches }
 * - 不是模板字面量 → 返回 null(无需检查)
 * - 是模板字面量 → 返回 BASE 文本(去除所有 ${...} 后拼接)与 BRANCHES 数组
 *   (每个 branch 是 `${...}` 内出现的字符串字面量)
 *
 * 例:
 *   "`h-4 w-1.5 ${x ? '' : 'h-2 w-2 bg-red'}`" →
 *   { base: "h-4 w-1.5 ", branches: ["", "h-2 w-2 bg-red"] }
 */
function parseTemplateClassName(expr) {
  // 必须是 backtick 包围
  if (!/^`[\s\S]*`$/.test(expr.trim())) return null
  // 去掉首尾 backtick
  const body = expr.trim().slice(1, -1)

  let base = ''
  const branches = []
  let i = 0
  while (i < body.length) {
    if (body[i] === '$' && body[i + 1] === '{') {
      // 找到匹配的 }
      let depth = 1
      let j = i + 2
      while (j < body.length && depth > 0) {
        if (body[j] === '{') depth++
        else if (body[j] === '}') depth--
        if (depth > 0) j++
      }
      const exprBody = body.slice(i + 2, j)
      // 提取表达式中所有字符串字面量(单/双引号)
      const strs = exprBody.match(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g) || []
      for (const s of strs) {
        const unq = s.slice(1, -1)
        if (unq) branches.push(unq)
      }
      i = j + 1
    } else {
      base += body[i]
      i++
    }
  }
  return { base, branches }
}

/**
 * 抽取跨多行的 className={`...`} 表达式(M-64 案例的 base + 条件分支可跨行)
 * 返回 [{ line, expr }]
 */
function findTemplateClassNames(lines) {
  const findings = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 行内豁免
    if (/tailwind-class-conflict-allow/.test(line)) continue
    // 找 className={` 起始
    const startRe = /className=\{`/
    const startMatch = startRe.exec(line)
    if (!startMatch) continue
    // 找到行内的 backtick 结束位置(从起始 match 末尾开始)
    let j = startMatch.index + startMatch[0].length
    // 行内可能 backtick 关闭
    let endInLine = -1
    let depth = 1 // 我们在 { 内部,跟踪 { } 配对;backtick 内容里可能还有 ${} 嵌套
    while (j < line.length) {
      if (line[j] === '`') {
        // 关闭?需要确保 ${} 已闭合
        endInLine = j
        break
      }
      j++
    }
    if (endInLine === -1) {
      // backtick 跨行:行内没找到关闭,继续往下
      // 简化处理:仅当本行内 backtick 关闭才检查(避免复杂多行解析)
      // 多行模板字面量是合法 JSX,但极少见,放过
      continue
    }
    // 检查起始到结束都在同一行
    const expr = line.slice(startMatch.index + 'className={'.length, endInLine + 1)
    if (!/^`[\s\S]*`$/.test(expr)) continue
    findings.push({ line: i + 1, expr, file: lines._file })
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
        // 删除行不推进
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
  `${C.cyan}${C.bold}[Tailwind class 冲突守门] 扫描 className 模板字面量 BASE/BRANCH 尺寸类冲突...${C.reset}`,
)
console.log(
  `${C.dim}规则: BASE 含 h-X 且 BRANCH 含 h-Y(X≠Y) 或 w 同理 → 报冲突(AGENTS.md 第 4 节 + M-64 落地)${C.reset}`,
)
console.log(
  `${C.dim}豁免: 行内 // tailwind-class-conflict-allow | 纯三元 | 纯字符串 | cn() 调用${C.reset}`,
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
  lines._file = file // 给 findTemplateClassNames 用
  const findings = []

  // 单行扫描(本守门关心同一行内的 className,跨行模板字面量放过)
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const lineNumber = idx + 1
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) continue
    }
    // 纯注释行跳过
    const trimmed = line.trim()
    if (/^(\/\/|\/\*|\*)/.test(trimmed)) continue
    // 行内豁免注释(同一行)
    if (/tailwind-class-conflict-allow/.test(line)) continue
    // 上方一行豁免注释(<span\n// tailwind-class-conflict-allow\nclassName={...} 形式)
    if (idx > 0 && /tailwind-class-conflict-allow/.test(lines[idx - 1])) continue

    // 找 className={`...`} 表达式
    const re = /className=\{`([^`]*)`\}/g
    let m
    while ((m = re.exec(line)) !== null) {
      const inner = m[1]
      const parsed = parseTemplateClassName('`' + inner + '`')
      if (!parsed) continue
      const { base, branches } = parsed
      const baseH = extractHValues(base)
      const baseW = extractWValues(base)
      const branchH = branches.flatMap((b) => extractHValues(b))
      const branchW = branches.flatMap((b) => extractWValues(b))

      const conflicts = []
      if (baseH.length > 0 && branchH.length > 0) {
        const bSet = new Set(baseH)
        const brSet = new Set(branchH)
        const both = [...bSet, ...brSet]
        const onlyBase = both.filter((v, i) => bSet.has(v) && !brSet.has(v) && i < bSet.size)
        const onlyBranch = both.filter((v) => !bSet.has(v) && brSet.has(v))
        if (onlyBase.length > 0 || onlyBranch.length > 0) {
          conflicts.push({
            axis: 'h',
            baseValues: baseH,
            branchValues: branchH,
          })
        }
      }
      if (baseW.length > 0 && branchW.length > 0) {
        const bSet = new Set(baseW)
        const brSet = new Set(branchW)
        const onlyBase = [...bSet].filter((v) => !brSet.has(v))
        const onlyBranch = [...brSet].filter((v) => !bSet.has(v))
        if (onlyBase.length > 0 || onlyBranch.length > 0) {
          conflicts.push({
            axis: 'w',
            baseValues: baseW,
            branchValues: branchW,
          })
        }
      }

      if (conflicts.length > 0) {
        findings.push({
          line: lineNumber,
          col: m.index + 1,
          snippet: line.trim().slice(0, 160),
          conflicts,
        })
        totalViolations += conflicts.length
      }
    }
  }

  if (findings.length > 0) {
    fileReports.push({ file: relative(ROOT, file), findings })
  }
}

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  违规数:   ${totalViolations} 处`)
console.log('')

if (totalViolations === 0) {
  console.log(`${C.green}${C.bold}✅ Tailwind class 冲突守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    const conflictDesc = f.conflicts
      .map((c) => `[${c.axis}] base=[${c.baseValues.join(',')}] branch=[${c.branchValues.join(',')}]`)
      .join(' ')
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}${conflictDesc}${C.reset}`,
    )
    console.log(`    ${C.dim}${f.snippet}${C.reset}`)
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(
  `  1. 改用顶层三元 className={cond ? 'class1' : 'class2'}(分支互斥,DOM 上只一套)`,
)
console.log(
  `  2. 共享 class 提取为常量: const base = 'rounded-full ...'; className={cond ? \`\${base} h-4\` : \`\${base} h-2\`}`,
)
console.log(
  `  3. 确认是合法覆盖模式时,加行内豁免: // tailwind-class-conflict-allow`,
)
console.log(
  `  4. 详细规则见 AGENTS.md 第 4 节"前端 UI 约束" + M-64 commit message`,
)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ Tailwind class 冲突守门失败 — 提交已阻止${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
