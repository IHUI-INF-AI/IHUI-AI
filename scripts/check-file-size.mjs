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
 *   排除:node_modules/out/dist/build/.next/public/coverage/tests/__tests__/e2e/.ihui-agent。
 *   生成物豁免:*.generated.* / *.gen.*(行数随数据线性增长,非人工巨型文件,见 GENERATED_NAME_RE)。
 *
 * 用法:
 *   node scripts/check-file-size.mjs --staged       (pre-commit,仅新增超阈值文件阻塞)
 *   node scripts/check-file-size.mjs               (全量报告, exit 0)
 *   node scripts/check-file-size.mjs --limit=500   (自定义阈值)
 *   node scripts/check-file-size.mjs --help
 *
 * 跳过方法(紧急):HUSKY_SKIP_FILE_SIZE=1 git commit ...
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { gitRaw } from './lib/face-reader.mjs'
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
退出码:0 通过/不适用;1 超阈值(staged);2 未判定(git 取面失败/文件读不到/扫描面为空)。
`)
  process.exit(0)
}

const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx']

// === 字节级大文件 / 污染路径守门(2026-11-11) ===
// 行数门只管".ts 文件多少行",管不住 324MB 的生成位图、12MB 的 README、上百 MB 的归档:
// 这些文件行数可能不多,但会直接把 GitHub/Gitee 仓库撑爆(filter-repo 重写之前的真因)。
// 判据只拦"新增"与"异常膨胀",不惩罚存量(存量由本轮清理一次性清偿)。
const BYTE_ADD_LIMIT = 2 * 1024 * 1024 // 新增文件 > 2MB 拦截
const BYTE_ANY_LIMIT = 20 * 1024 * 1024 // 任意暂存文件 > 20MB 拦截(存量变大也不许)
const LARGE_ALLOWLIST = [
  /^packages\/database\/drizzle\/meta\//, // 生成快照,单文件 ~1.9MB
  /^apps\/desktop\/src-tauri\/icons\//, // 应用图标
  /^apps\/mobile-rn\/assets\/fonts\//,
  /^apps\/miniapp-taro\/src\/assets\/fonts\//,
]
const FORBIDDEN_STAGED = [
  /(^|\/)node_modules\//,
  /(^|\/)(dist|build|out|coverage|\.next|\.turbo|\.cache|__pycache__|\.venv|venv)\//,
  /(^|\/)\.worktrees(-archive)?\//,
  /^apps\/desktop\/src-tauri\/windows\/installer-assets\//, // 构建时生成
  /^apps\/web\/public\/downloads\/desktop\//, // 安装包
  /\.(log|tmp|bak|db|sqlite|sqlite3)$/,
  /(^|\/)\.env$/, // .env.example 不匹配
]
/** @returns {{status:string,path:string,oldPath?:string}[]|null} staged 面新增/修改/重命名 */
function getStagedAllFiles() {
  try {
    return gitRaw(['diff', '--cached', '--diff-filter=ACMR', '--name-status'], ROOT)
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [status, a, b] = line.split('\t')
        return { status: status[0], path: (b ?? a).replace(/\\/g, '/'), oldPath: b ? a : undefined }
      })
  } catch {
    return null
  }
}
function auditStagedBytes() {
  const files = getStagedAllFiles()
  if (files === null) {
    console.error(
      `${C.red}❌ [字节守门] staged 面取不到(git diff --cached 失败)⇒ 未判定(exit 2)${C.reset}`,
    )
    process.exit(2)
  }
  const violations = []
  for (const { status, path: f, oldPath } of files) {
    if (FORBIDDEN_STAGED.some((re) => re.test(f))) {
      violations.push({ f, why: '禁止入库的生成物/缓存/密钥路径' })
      continue
    }
    let size = 0
    try {
      size = statSync(join(ROOT, f)).size
    } catch {
      continue // 暂存后工作树被删,按索引取不到大小;不据此放行别项
    }
    if (size > BYTE_ANY_LIMIT) {
      violations.push({ f, why: `单文件 ${(size / 1048576).toFixed(1)}MB > 20MB` })
      continue
    }
    if (status === 'A') {
      const allowed = LARGE_ALLOWLIST.some((re) => re.test(f))
      if (size > BYTE_ADD_LIMIT && !allowed)
        violations.push({ f, why: `新增文件 ${(size / 1048576).toFixed(1)}MB > 2MB(未在豁免清单)` })
      continue
    }
    // 修改/重命名:只拦"显著变大",允许本轮清偿把 12MB README 改小
    let oldSize = 0
    try {
      oldSize = Number(gitRaw(['cat-file', '-s', `HEAD:${oldPath ?? f}`], ROOT).trim())
    } catch {
      oldSize = 0 // 旧 blob 取不到(新增/索引异常)时按新增口径已在上面兜住
    }
    if (oldSize > 0 && size - oldSize > BYTE_ADD_LIMIT) {
      violations.push({
        f,
        why: `单文件从 ${(oldSize / 1048576).toFixed(1)}MB 涨到 ${(size / 1048576).toFixed(1)}MB(增量 > 2MB)`,
      })
    }
  }
  if (violations.length > 0) {
    console.error(
      `\n${C.red}${C.bold}❌ [字节守门] ${violations.length} 个暂存文件禁止入库:${C.reset}`,
    )
    for (const v of violations) console.error(`  ${v.f}  ← ${v.why}`)
    console.error(
      `${C.dim}生成物请写进 .gitignore 并在构建时产出;大文件请移出仓库或走 Release 资产。${C.reset}`,
    )
    console.error(`${C.dim}紧急跳过:HUSKY_SKIP_FILE_SIZE=1 git commit ...${C.reset}`)
    process.exit(1)
  }
  console.log(`${C.green}✅ [字节守门] ${files.length} 个暂存文件无大文件/污染路径${C.reset}`)
}
if (isStaged) auditStagedBytes()

// === 仓库重量预算(全量,可选) ===
// 用法:node scripts/check-file-size.mjs --weight --budget-mb=350
// CI 用预算棘轮防止仓库再次被生成物/归档撑大;超预算 exit 1。
function auditWeight() {
  const budgetArg = argv.find((a) => /^--budget-mb=/.test(a))
  const budget = budgetArg
    ? parseFloat(budgetArg.split('=')[1])
    : parseFloat(process.env.REPO_SIZE_BUDGET_MB ?? '')
  let out
  try {
    out = gitRaw(['ls-tree', '-r', '-l', 'HEAD'], ROOT)
  } catch {
    console.error(`${C.red}❌ [仓库重量] 取不到 HEAD 树 ⇒ 未判定(exit 2)${C.reset}`)
    process.exit(2)
  }
  const rows = []
  let total = 0
  for (const line of out.split('\n')) {
    const m = line.match(/^\d+ blob [0-9a-f]+ +(\d+)\t(.+)$/)
    if (!m) continue
    const size = Number(m[1])
    total += size
    rows.push({ size, path: m[2] })
  }
  rows.sort((a, b) => b.size - a.size)
  const mb = (n) => (n / 1048576).toFixed(1)
  console.log(
    `${C.cyan}${C.bold}[仓库重量] HEAD 跟踪 ${rows.length} 个文件 · 合计 ${mb(total)} MB${C.reset}`,
  )
  for (const r of rows.slice(0, 15)) console.log(`  ${mb(r.size).padStart(8)} MB  ${r.path}`)
  if (Number.isFinite(budget) && budget > 0 && total / 1048576 > budget) {
    console.error(`\n${C.red}${C.bold}❌ 仓库重量 ${mb(total)}MB 超过预算 ${budget}MB${C.reset}`)
    console.error(`${C.dim}请把生成物移出仓库(见 .gitignore)或先清偿存量,再调整预算。${C.reset}`)
    process.exit(1)
  }
  if (Number.isFinite(budget) && budget > 0) {
    console.log(`${C.green}✅ 仓库重量在预算内(${mb(total)}MB ≤ ${budget}MB)${C.reset}`)
  }
}
if (argv.includes('--weight')) auditWeight()

/**
 * 机器生成的数据表(*.generated.* / *.gen.*)豁免本守门。
 * 理由:本规则治理的是"人工写出的巨型文件应拆分"(AGENTS.md §4 维护/审阅成本);
 * 生成产物的行数随数据条数线性增长(如全站路由表 879 行),拆表只会把一次生成器
 * 输出切成多份互相引用的文件,审阅成本并没有下降。改动必须回到生成脚本,故不经本规则。
 */
const GENERATED_NAME_RE = /\.(generated|gen)\.[jt]sx?$/

function countLines(file) {
  try {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    let n = lines.length
    if (src.endsWith('\n')) n -= 1
    return n
  } catch {
    // 读不到对象 ≠ 0 行;折成 0 会让超大文件静默过门(2026-11-04 假绿专项)。
    return null
  }
}

function collectFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (isExcludedDirName(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectFiles(full, result)
    } else if (SCAN_EXTS.some((e) => entry.endsWith(e)) && !GENERATED_NAME_RE.test(entry)) {
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
    // 2026-10-26 G-54:git 派生收口到 face-reader(绝对路径二进制 + safe.directory + stdio/windowsHide 统一)。
    const output = gitRaw(['diff', '--cached', '--diff-filter=A', '--name-only'], ROOT)
    return output
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_EXTS.some((e) => f.endsWith(e)))
      .filter((f) => !GENERATED_NAME_RE.test(f))
      .filter((f) => !isExcludedDirName(f.split('/')[0]))
      .map((f) => join(ROOT, f))
  } catch {
    // 取不到 staged 面 ≠ 没有新增文件;折成空集会让门空转绿灯。
    return null
  }
}

console.log(`${C.cyan}${C.bold}[单文件行数守门] 阈值 ${threshold} 行${C.reset}`)
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
  if (files === null) {
    console.error(
      `${C.red}❌ [单文件行数守门] staged 面取不到(git diff --cached 失败)⇒ 未判定(exit 2)${C.reset}`,
    )
    process.exit(2)
  }
  if (files.length === 0) {
    console.log(`${C.green}✅ 暂存区无新增 .ts/.tsx/.js/.jsx 文件,不适用${C.reset}`)
    process.exit(0)
  }
} else {
  for (const root of scanRoots()) {
    files = files.concat(collectFiles(root))
  }
  if (files.length === 0) {
    console.error(
      `${C.red}❌ [单文件行数守门] 扫描面为空(未找到 apps/*/src|app 下任何 .ts/.tsx/.js/.jsx)⇒ 未判定(exit 2)${C.reset}`,
    )
    process.exit(2)
  }
}

const oversized = []
const unreadable = []
for (const file of files) {
  const n = countLines(file)
  if (n === null) {
    unreadable.push(relative(ROOT, file))
    continue
  }
  if (n > threshold) {
    oversized.push({ file: relative(ROOT, file), lines: n })
  }
}

if (unreadable.length > 0) {
  console.error(
    `${C.red}❌ [单文件行数守门] ${unreadable.length} 个文件读不到,无法判定行数 ⇒ 未判定(exit 2)${C.reset}`,
  )
  for (const f of unreadable) console.error(`  ${f}`)
  process.exit(2)
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
