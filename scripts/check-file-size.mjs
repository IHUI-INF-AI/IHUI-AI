#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 单文件行数守门 — 防止新增巨型文件。
 *
 * 依据 AGENTS.md 第 4 节"前端 UI 约束"(每个页面 < 250 行)的精神延伸:
 *   单个源文件超过阈值(默认 800 行)会显著增加维护/审阅成本,应拆分为更小模块。
 *
 * 设计要点(避免误伤存量):
 *   - 当前仓库已有约 30 个历史遗留的超大文件,这些会随重构逐步清理(增量方式)。
 *   - 因此本守门在 --staged 模式**只拦"新增文件"**(git diff --cached --diff-filter=A),
 *     即 git 标记为 Added 的文件。对存量文件的编辑(修改行)不触发拦截。
 *   - 全量模式(无 --staged)只做报告(exit 0),供 CI/人工盘点,不阻塞。
 *
 * 阈值:
 *   - 默认 800 行
 *   - 环境变量 FILE_SIZE_LIMIT 覆盖
 *   - 命令行 --limit=N 覆盖(优先级最高)
 *
 * 扫描范围:
 *   apps/web/src、apps/web/app,以及任意 apps/<app>/src(若存在)。
 *   扩展名 .ts/.tsx/.js/.jsx。
 *   排除:node_modules/out/dist/build/.next/public/coverage/tests/__tests__/e2e/.trae-cn。
 *
 * 用法:
 *   node scripts/check-file-size.mjs --staged       (pre-commit,仅新增超阈值文件阻塞)
 *   node scripts/check-file-size.mjs               (全量报告, exit 0)
 *   node scripts/check-file-size.mjs --limit=500   (自定义阈值)
 *   node scripts/check-file-size.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_FILE_SIZE=1 git commit ...
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

// 跳过方法(紧急):HUSKY_SKIP_FILE_SIZE=1 git commit ...
if (process.env.HUSKY_SKIP_FILE_SIZE === '1') {
  console.log('⏭  单文件行数守门(HUSKY_SKIP_FILE_SIZE=1, 跳过)')
  process.exit(0)
}

// === 阈值解析:默认 800 < 环境变量 < 命令行 --limit=N ===
let threshold = 800
const envLimit = parseInt(process.env.FILE_SIZE_LIMIT ?? '', 10)
if (Number.isFinite(envLimit) && envLimit > 0) threshold = envLimit
for (const a of argv) {
  const m = a.match(/^--limit=(\d+)$/)
  if (m) {
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > 0) threshold = n
  }
}

if (isHelp) {
  console.log(`
check-file-size.mjs — 单文件行数守门(仅拦新增超大文件)

用法:
  node scripts/check-file-size.mjs --staged       pre-commit 模式(仅新增超阈值文件阻塞)
  node scripts/check-file-size.mjs                全量扫描报告(exit 0)
  node scripts/check-file-size.mjs --limit=500    自定义阈值
  node scripts/check-file-size.mjs --help         显示本帮助

阈值:默认 800 行(环境变量 FILE_SIZE_LIMIT 或 --limit=N 可覆盖)。
范围:apps/web/src、apps/web/app 及任意 apps/<app>/src;扩展名 .ts/.tsx/.js/.jsx。
staged 模式:仅 git 新增文件(Added)超阈值才阻塞,不惩罚存量文件编辑。
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

function countLines(file) {
  try {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    let n = lines.length
    if (src.endsWith('\n')) n -= 1
    return n
  } catch {
    return 0
  }
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

/** 计算扫描根目录:apps/web/src、apps/web/app,以及任意 apps/<app>/src */
function scanRoots() {
  const appsDir = join(ROOT, 'apps')
  const roots = []
  if (!existsSync(appsDir)) return roots
  for (const name of readdirSync(appsDir)) {
    const appDir = join(appsDir, name)
    if (!statSync(appDir).isDirectory()) continue
    const srcDir = join(appDir, 'src')
    if (existsSync(srcDir)) roots.push(srcDir)
    const appSub = join(appDir, 'app')
    if (existsSync(appSub)) roots.push(appSub)
  }
  return roots
}

function getStagedAddedFiles() {
  try {
    const output = execSync('git diff --cached --diff-filter=A --name-only', {
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
  `${C.cyan}${C.bold}[单文件行数守门] 阈值 ${threshold} 行${C.reset}`,
)
console.log(
  `${C.dim}规则: AGENTS.md 第 4 节 — 单文件过大需拆分;staged 模式仅拦"新增文件"${C.reset}`,
)
console.log(
  `${C.dim}模式: ${isStaged ? 'staged (仅新增文件超阈值阻塞)' : '全量 (报告, exit 0)'}${C.reset}`,
)
console.log('')

let files = []
if (isStaged) {
  files = getStagedAddedFiles()
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无新增 .ts/.tsx/.js/.jsx 文件,跳过${C.reset}`)
    process.exit(0)
  }
} else {
  for (const root of scanRoots()) {
    files = files.concat(collectFiles(root))
  }
}

const oversized = []
for (const file of files) {
  const n = countLines(file)
  if (n > threshold) {
    oversized.push({ file: relative(ROOT, file), lines: n })
  }
}

oversized.sort((a, b) => b.lines - a.lines)

console.log(`${C.bold}扫描结果:${C.reset}`)
console.log(`  扫描文件: ${files.length} 个`)
console.log(`  超阈值:   ${oversized.length} 个(> ${threshold} 行)`)
console.log('')

if (oversized.length === 0) {
  console.log(`${C.green}${C.bold}✅ 单文件行数守门通过${C.reset}`)
  process.exit(0)
}

console.log(`${C.yellow}${C.bold}⚠️  超阈值文件:${C.reset}`)
for (const o of oversized) {
  console.log(`  ${C.red}${String(o.lines).padStart(5)}${C.reset} 行  ${o.file}`)
}
console.log('')
console.log(`${C.dim}修复方法:${C.reset}`)
console.log(`  1. 将超大文件拆分为更小的模块(组件/函数/常量分离),目标 < 250 行/页面`)
console.log(`  2. 阈值可通过 FILE_SIZE_LIMIT 环境变量或 --limit=N 调整`)
console.log('')

if (isStaged) {
  console.log(`${C.red}${C.bold}❌ 单文件行数守门失败 — 提交已阻止(仅拦新增超大文件)${C.reset}`)
  console.log(`${C.dim}跳过方法:HUSKY_SKIP_FILE_SIZE=1 git commit ...${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.yellow}${C.bold}⚠️  全量模式仅警告(exit 0)${C.reset}`)
  process.exit(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
