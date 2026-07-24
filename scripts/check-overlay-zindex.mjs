#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 全屏遮罩 z-index 层级守门(2026-07-24 立,根治 SSO 弹窗遮罩复发)
 *
 * 防止 `fixed inset-0` 类全屏遮罩/弹层组件使用 Tailwind 数字 z 类
 * (z-50/z-40/z-30/z-20/z-10/z-0,值 < 100),被全局 fixed 常驻面板
 * (如 AISidePanel 的 z-sticky=990)压在下面,导致"AI 对话框跟着登录窗
 * 一起变"的视觉回归。
 *
 * 规则:
 *   允许(引用 CSS 变量):z-sticky / z-modal / z-popover / z-notification / z-max
 *   禁止(Tailwind 内置数字类,值 < 100):z-0 / z-10 / z-20 / z-30 / z-40 / z-50
 *   (z-* 数字类最高也只到 z-50=50,远低于 z-sticky=990)
 *
 * 注:z-\[9999\] 等任意值方括号语法也允许(用户显式指定高数值);
 *     仅"低数字 Tailwind 类"被禁。
 *
 * 历史教训(2026-07-24):
 *   AuthShellPage(SSO /sso/login /sso/register /sso/auth 三处复用)用 z-50,
 *   低于 AISidePanel 的 z-sticky=990,AI 面板露在遮罩之上"发亮"。
 *   修复:z-50 → z-modal(=2000,引用 --z-modal CSS 变量)。
 *   本守门从机制上杜绝此类复发:任何新增 fixed inset-0 弹窗用 z-50 → 阻塞 commit。
 *
 * 用法:
 *   node scripts/check-overlay-zindex.mjs          (全量检查, exit 0/1)
 *   node scripts/check-overlay-zindex.mjs --staged  (仅 staged 涉及时检查)
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

// 扫描范围:web 前端 + 共享 UI 包
const SCAN_DIRS = ['apps/web', 'packages/ui-react/src']

// 禁止的 Tailwind 数字 z 类(值 < 100,都低于 z-sticky=990)
// 匹配:`z-50` / `z-40` / `z-30` / `z-20` / `z-10` / `z-0`
const FORBIDDEN_Z_CLASSES = ['z-50', 'z-40', 'z-30', 'z-20', 'z-10', 'z-0']

// 允许的引用 CSS 变量的 z 类
const ALLOWED_Z_CLASSES = [
  'z-sticky',
  'z-modal',
  'z-popover',
  'z-notification',
  'z-max',
  'z-base',
]

// 视觉遮罩特征:含 bg-black/(半透明黑色背景)或 bg-background/80 等遮罩色
// 用于区分"视觉遮罩弹窗"(应改 z-modal)与"透明点击捕获层"(非本守门范围)
// 透明点击捕获层(无 bg-black,如 Leaderboard 的 z-10 outside-click catcher)
// 不在本次守门范围,留待后续单独优化(useEffect + contains 重构)
const OVERLAY_BG_PATTERNS = [/bg-black\/\d/, /bg-background\/[89]/, /bg-black\b(?!\/0)/]

/**
 * 检测一行是否含"视觉遮罩"特征(半透明黑色背景)
 */
function isVisualOverlay(line) {
  return OVERLAY_BG_PATTERNS.some((p) => p.test(line))
}

/**
 * 从文件内容提取所有 className="..." 字符串,返回违规列表
 *
 * 违规判定(同时满足):
 *   1. 同一行含 `fixed` + `inset-0`(全屏覆盖)
 *   2. 同一行含禁止的 z-N 类(z-50/z-40/z-30/z-20/z-10/z-0)
 *   3. 同一行含视觉遮罩特征(bg-black/N 等半透明背景)
 *
 * 透明点击捕获层(无 bg-black)不报违规,留作 outside-click 重构。
 */
function findViolations(content, filePath) {
  const violations = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 快速过滤:不含 fixed/inset-0 的行跳过
    if (!line.includes('fixed')) continue
    if (!line.includes('inset-0')) continue

    // 检测是否含禁止的 z-N 类
    let forbiddenZ = null
    for (const z of FORBIDDEN_Z_CLASSES) {
      // 用单词边界避免匹配 z-500 等
      const re = new RegExp(`\\b${z.replace('-', '\\-')}\\b`)
      if (re.test(line)) {
        forbiddenZ = z
        break
      }
    }
    if (!forbiddenZ) continue

    // 检测是否含视觉遮罩特征(半透明背景)
    // 若无遮罩背景,可能是透明点击捕获层,跳过(留待后续优化)
    if (!isVisualOverlay(line)) continue

    // 提取上下文
    const idx = line.indexOf(forbiddenZ)
    const start = Math.max(0, idx - 40)
    const end = Math.min(line.length, idx + forbiddenZ.length + 40)
    const context = line.substring(start, end).trim()
    violations.push({
      file: filePath,
      line: i + 1,
      col: idx + 1,
      forbidden: forbiddenZ,
      context,
    })
  }

  return violations
}

/**
 * 收集要扫描的 .tsx 文件列表
 * --staged 模式:只扫 staged 的 .tsx 文件
 * 非 staged 模式:扫 SCAN_DIRS 下所有 .tsx 文件
 */
function collectFiles() {
  if (isStaged) {
    try {
      const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        encoding: 'utf8',
        cwd: ROOT,
      })
      return staged
        .split('\n')
        .filter(Boolean)
        .filter((f) => f.endsWith('.tsx'))
        .filter((f) => SCAN_DIRS.some((d) => f.startsWith(d) || f.startsWith(d.replace(/\//g, '\\'))))
        .map((f) => join(ROOT, f.replace(/\//g, '\\')))
    } catch {
      // 非 git 环境,跑全量
    }
  }

  // 非 staged 模式:用 git ls-files 列出已跟踪的 .tsx 文件(比 glob 快且不含 node_modules)
  try {
    const tracked = execSync('git ls-files "**/*.tsx"', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    return tracked
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_DIRS.some((d) => f.startsWith(d) || f.startsWith(d.replace(/\//g, '\\'))))
      .map((f) => join(ROOT, f.replace(/\//g, '\\')))
  } catch {
    return []
  }
}

console.log('🛡️  全屏遮罩 z-index 层级守门(防 fixed inset-0 + z-N 数字类复发)...')
if (isStaged) {
  console.log(`${C.dim}   模式: --staged(仅扫描 staged .tsx 文件)${C.reset}`)
} else {
  console.log(`${C.dim}   模式: 全量扫描(${SCAN_DIRS.join(', ')})${C.reset}`)
}

const files = collectFiles()
if (files.length === 0) {
  console.log(`${C.dim}⏭  无可扫描的 .tsx 文件,跳过${C.reset}`)
  process.exit(0)
}

console.log(`${C.dim}   扫描 ${files.length} 个 .tsx 文件...${C.reset}\n`)

let totalViolations = 0
const allViolations = []

for (const filePath of files) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    continue
  }

  const violations = findViolations(content, relative(ROOT, filePath).replace(/\\/g, '/'))
  if (violations.length > 0) {
    allViolations.push(...violations)
    totalViolations += violations.length
  }
}

// ============================================================
// 汇总
// ============================================================
if (totalViolations === 0) {
  console.log(`${C.green}✅ 全屏遮罩 z-index 层级守门通过${C.reset}`)
  console.log(`${C.dim}   扫描 ${files.length} 个 .tsx 文件,0 处违规${C.reset}`)
  process.exit(0)
}

console.log(`${C.red}❌ 全屏遮罩 z-index 层级守门失败${C.reset}`)
console.log(`${C.dim}   发现 ${totalViolations} 处违规:${C.reset}\n`)

for (const v of allViolations) {
  console.log(`${C.red}  ${v.file}:${v.line}:${v.col}${C.reset}`)
  console.log(`${C.dim}    禁止: ${v.forbidden}${C.reset}`)
  console.log(`${C.dim}    上下文: ...${v.context}...${C.reset}`)
  console.log()
}

console.log(`${C.yellow}修复建议:${C.reset}`)
console.log(`${C.dim}  这些 \`fixed inset-0\` 全屏遮罩使用了 Tailwind 内置数字 z 类(z-50 等),${C.reset}`)
console.log(`${C.dim}  值低于全局 fixed 常驻面板(如 AISidePanel 的 z-sticky=990),${C.reset}`)
console.log(`${C.dim}  会被压在下面,导致 AI 面板"露在遮罩之上"的视觉回归。${C.reset}`)
console.log()
console.log(`${C.dim}  替换为引用 CSS 变量的 z 类:${C.reset}`)
console.log(`${C.dim}    z-50 → z-modal     (=2000, 弹层 Modal/Drawer/Dialog/登录框)${C.reset}`)
console.log(`${C.dim}    z-50 → z-popover   (=2001, 高于 modal,用于 Tooltip/Popover)${C.reset}`)
console.log(`${C.dim}    z-50 → z-max       (=10003, 最大层级, 全屏覆盖)${C.reset}`)
console.log()
console.log(`${C.dim}  允许的 z 类(引用 globals.css CSS 变量):${C.reset}`)
console.log(`${C.dim}    ${ALLOWED_Z_CLASSES.join(' / ')}${C.reset}`)
console.log()
console.log(`${C.dim}  历史教训(2026-07-24):${C.reset}`)
console.log(`${C.dim}    AuthShellPage 用 z-50,SSO 登录遮罩被 AISidePanel 压住,${C.reset}`)
console.log(`${C.dim}    AI 面板以全亮度暴露 = 用户反馈"AI 对话框跟着登录窗一起变"。${C.reset}`)
console.log(`${C.dim}    修复:z-50 → z-modal,本守门从机制上杜绝复发。${C.reset}`)

process.exit(1)
