#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 原生弹窗守门 — 禁止 alert() / confirm() / prompt() 原生浏览器弹窗。
 *
 * 依据 AGENTS.md 第 4 节"禁用原生提示窗(强制)":
 *   禁止 alert() / confirm() / prompt() 原生浏览器弹窗,
 *   必须使用项目自有的 Tooltip / Dialog 组件统一交互样式。
 *
 * 检测逻辑:
 *   - 在 .ts/.tsx/.js/.jsx 源码中查找函数调用形式的 alert( / confirm( / prompt(
 *   - 排除:注释行、行内 // 注释之后的片段、以及字符串字面量中出现的内容
 *     (如文档/示例字符串 "...use confirm() to..." 不算违规)
 *   - 判定用"去注释 + 去字符串"后的剩余代码文本,避免误报
 *
 * 用法:
 *   node scripts/check-no-native-dialog.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-no-native-dialog.mjs             (全量扫描报告, exit 0)
 *   node scripts/check-no-native-dialog.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_NATIVE_DIALOG=1 git commit ...
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { withExcludes } from './lib/exclude-dirs.mjs'
import { COLORS as C } from './lib/logger.mjs'

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const isStaged = argv.includes('--staged')
const isHelp = argv.includes('--help') || argv.includes('-h')

// 跳过方法(紧急):HUSKY_SKIP_NATIVE_DIALOG=1 git commit ...
if (process.env.HUSKY_SKIP_NATIVE_DIALOG === '1') {
  console.log('⏭  原生弹窗守门(HUSKY_SKIP_NATIVE_DIALOG=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-no-native-dialog.mjs — 原生弹窗守门(alert/confirm/prompt)

用法:
  node scripts/check-no-native-dialog.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-native-dialog.mjs             全量扫描报告(exit 0)
  node scripts/check-no-native-dialog.mjs --help      显示本帮助

判定:代码中实际调用 alert()/confirm()/prompt()(注释行与字符串字面量豁免)即违规。
`)
  process.exit(0)
}

const EXCLUDE_DIRS = withExcludes([
  'node_modules',
  'out',
  'dist',
  'build',
  '.next',
  'public',
  'coverage',
  'tests',
  '__tests__',
  'e2e',
  '.trae-cn',
])

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

/**
 * 原生弹窗调用模式:alert( / confirm( / prompt(
 * 守门只针对浏览器裸调用 alert()/confirm()/prompt(),需排除:
 *   1) 成员访问(.alert,如 React Native 的 Alert.alert)由 (?<!\.) 排除
 *   2) 函数/方法定义(async prompt( / function alert( / const x = prompt( / await prompt( 等),
 *      避免误伤 LLM prompt 助手等用户自定义同名函数
 *   3) 行首为注释(JSDoc ` *`/ `//` / `/*`)的行在循环内直接跳过
 * 仅判定"裸调用"上下文,真实浏览器调用几乎都出现在语句起始或 ; / { / return / 运算符之后,
 * 不会被下列定义/参数/await/yield 上下文的前导词排除。
 */
const CALL_RE =
  /(?<!\.)(?<!(async\s+|function\s+|const\s+|let\s+|var\s+|await\s+|yield\s+|=|>|:|,|&|\||\?|\()\s*)(alert|confirm|prompt)\s*\(/

/**
 * 去除行内注释与字符串字面量内容,返回"裸代码"用于判定。
 * 这样可同时排除:注释中的说明、字符串字面量里出现的 "alert(" 文本。
 * 注:跨行块注释逐行处理不完美,但 guardian 场景下单行误报风险极低。
 */
function stripStringsAndComments(line) {
  let out = ''
  const n = line.length
  let i = 0
  while (i < n) {
    const c = line[i]
    const c2 = line[i + 1]
    if (c === '/' && c2 === '/') break // 行注释:余下全部跳过
    if (c === '/' && c2 === '*') {
      // 块注释:跳到 */
      i += 2
      while (i < n && !(line[i] === '*' && line[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      i++
      while (i < n) {
        if (line[i] === '\\') {
          i += 2
          continue
        }
        if (line[i] === quote) {
          i++
          break
        }
        i++
      }
      out += ' ' // 字符串整体替换为空格,保留长度无关,仅判存在性
      continue
    }
    out += c
    i++
  }
  return out
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
        // 删除行,不推进
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
  `${C.cyan}${C.bold}[原生弹窗守门] 扫描 alert/confirm/prompt 调用...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 禁止原生 alert/confirm/prompt,改用项目自有 Dialog/Tooltip${C.reset}`,
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
  // 去除块注释内容(替换为空格,保留换行与行号),避免 /* ... alert( ... */ 等多行注释误报;
  // 行内 // 注释与字符串字面量由下方 stripStringsAndComments 处理。
  const srcNoBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = srcNoBlock.split('\n')
  const findings = []

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    if (isStaged) {
      const allowed = addedLinesMap.get(file)
      if (!allowed || !allowed.has(lineNumber)) return
    }
    // 跳过整行注释(JSDoc ` *`/ `//` / `/*`),避免注释中的说明性文字误报
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return
    // 跳过 markdown 列表项(文档/说明字符串中的 "prompt(" 等英文词误报)
    if (/^\s*-\s/.test(line)) return
    const code = stripStringsAndComments(line)
    const m = CALL_RE.exec(code)
    if (m) {
      findings.push({
        line: lineNumber,
        col: m.index + 1,
        label: m[1],
        snippet: line.trim().slice(0, 140),
      })
    }
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
  console.log(`${C.green}${C.bold}✅ 原生弹窗守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[${f.label}()]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 确认类交互改用项目自有 Dialog/confirm-dialog 组件`)
console.log(`  2. 提示类改用 Tooltip 组件(@/components/feedback)`)
console.log(`  3. 注释行 / 字符串字面量中的文字说明已自动豁免`)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 原生弹窗守门失败 — 提交已阻止${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_NATIVE_DIALOG=1 git commit ...${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
