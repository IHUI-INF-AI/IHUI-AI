#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 渐变遮罩守门 — 禁止 mask-image / -webkit-mask-image 渐变遮罩。
 *
 * 依据 AGENTS.md 第 4 节"禁止渐变遮罩(强制)":
 *   任何容器禁止 mask-image / -webkit-mask-image / linear-gradient 用作边缘淡出遮罩。
 *   用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。
 *
 * 检测逻辑:
 *   - 在 .ts/.tsx/.js/.jsx 源码中查找 mask-image 字面量(覆盖 mask-image、mask-image:、
 *     -webkit-mask-image 三种形态)
 *   - 排除注释行(// 单行、块注释、JSX {/* 块注释),避免说明性文字误报
 *
 * 用法:
 *   node scripts/check-no-mask-image.mjs --staged   (pre-commit, 新增违规则 exit 1)
 *   node scripts/check-no-mask-image.mjs             (全量扫描报告, exit 0)
 *   node scripts/check-no-mask-image.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_MASK_IMAGE=1 git commit ...
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

// 跳过方法(紧急):HUSKY_SKIP_MASK_IMAGE=1 git commit ...
if (process.env.HUSKY_SKIP_MASK_IMAGE === '1') {
  console.log('⏭  渐变遮罩守门(HUSKY_SKIP_MASK_IMAGE=1, 跳过)')
  process.exit(0)
}

if (isHelp) {
  console.log(`
check-no-mask-image.mjs — 渐变遮罩守门(mask-image)

用法:
  node scripts/check-no-mask-image.mjs --staged   pre-commit 模式(新增违规则 exit 1)
  node scripts/check-no-mask-image.mjs             全量扫描报告(exit 0)
  node scripts/check-no-mask-image.mjs --help      显示本帮助

判定:源码中出现 mask-image / -webkit-mask-image / mask-image:(注释行豁免)即违规。
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

/** 违规模式:mask-image(覆盖 mask-image: 与 -webkit-mask-image) */
const VIOLATION_RE = /mask-image/

function isExempt(line) {
  const trimmed = line.trim()
  if (/^\s*(\/\/|\/\*|\*|\{)/.test(trimmed)) return true
  const m = line.match(/mask-image/)
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
  `${C.cyan}${C.bold}[渐变遮罩守门] 扫描 mask-image...${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 禁止 mask-image 渐变遮罩,改用显式 UI 元素${C.reset}`,
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
    if (isExempt(line)) return
    const m = VIOLATION_RE.exec(line)
    if (m) {
      findings.push({
        line: lineNumber,
        col: m.index + 1,
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
  console.log(`${C.green}${C.bold}✅ 渐变遮罩守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}${C.bold}❌ 发现 ${totalViolations} 处违规:${C.reset}`)
console.log('')
for (const { file, findings } of fileReports) {
  console.log(`${C.red}${file}${C.reset}`)
  for (const f of findings) {
    console.log(
      `  ${C.dim}行 ${f.line}:${f.col}${C.reset} ${C.red}[mask-image]${C.reset} ${f.snippet}`,
    )
  }
  console.log('')
}
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 移除 mask-image / -webkit-mask-image 渐变边缘淡出`)
console.log(`  2. 改用显式 UI 元素:"查看更多"按钮 / 计数徽章 / 分页`)
console.log(`  3. 详细规则见 AGENTS.md 第 4 节"禁止渐变遮罩(强制)"`)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 渐变遮罩守门失败 — 提交已阻止${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_MASK_IMAGE=1 git commit ...${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
