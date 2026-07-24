#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-overlay-zindex.mjs — 全屏遮罩 z-index 层级守门
 *
 * 背景(2026-07-24 立):
 *   SSO 登录页遮罩(AuthShell.tsx)使用 z-50(=50),低于 AISidePanel 的 z-sticky(=990),
 *   导致遮罩被 AI 面板覆盖,用户看到"AI 对话框露在登录遮罩之上"。
 *   根因:fixed inset-0 全屏遮罩误用低数字 Tailwind z 类(z-50/z-40/z-30 等),
 *   低于全局常驻面板的 z-sticky=990。
 *
 * 守门规则:
 *   检测 fixed inset-0 + 视觉遮罩背景(bg-black/\d 等) + 禁止 z 类(z-0/10/20/30/40/50)
 *   三者同时满足 → 违规,阻塞 commit
 *   透明点击捕获层(无 bg-black)不在守门范围(允许低 z-index)
 *
 * 修复:
 *   把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)
 *
 * 用法:
 *   node scripts/check-overlay-zindex.mjs [--staged]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── 配置 ───────────────────────────────────────────────────

const SCAN_DIRS = ['apps/web', 'packages/ui-react/src']
const SCAN_EXTS = ['.tsx', '.jsx', '.ts', '.js']

// 禁止的 z 类(值 < 100,低于 z-sticky=990)
const FORBIDDEN_Z_CLASSES = ['z-0', 'z-10', 'z-20', 'z-30', 'z-40', 'z-50']

// 视觉遮罩特征:含半透明背景(区分于透明点击捕获层)
const OVERLAY_BG_PATTERNS = [
  /bg-black\/\d/,
  /bg-background\/[89]/,
  /bg-black\b(?!\/0)/,
  /bg-slate-\d+\/[2-9]/,
  /bg-zinc-\d+\/[2-9]/,
  /bg-neutral-\d+\/[2-9]/,
]

// ─── 文件遍历 ───────────────────────────────────────────────

function walkDir(dir, results = []) {
  if (!existsSync(dir)) return results
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    // 跳过 node_modules / .next / dist / .git 等
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist' || entry === '.git' || entry.startsWith('.')) {
      continue
    }
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walkDir(fullPath, results)
    } else if (SCAN_EXTS.some((ext) => entry.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

// ─── 违规检测 ───────────────────────────────────────────────

function isVisualOverlay(line) {
  return OVERLAY_BG_PATTERNS.some((p) => p.test(line))
}

function findViolations(content, filePath) {
  const violations = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 必须同时含 fixed 和 inset-0
    if (!line.includes('fixed')) continue
    if (!line.includes('inset-0')) continue
    // 检测禁止 z 类
    let forbiddenZ = null
    for (const z of FORBIDDEN_Z_CLASSES) {
      const re = new RegExp(`\\b${z.replace('-', '\\-')}\\b`)
      if (re.test(line)) {
        forbiddenZ = z
        break
      }
    }
    if (!forbiddenZ) continue
    // 检测视觉遮罩背景(透明点击捕获层不在守门范围)
    if (!isVisualOverlay(line)) continue
    violations.push({
      file: filePath,
      line: i + 1,
      content: line.trim(),
      zClass: forbiddenZ,
    })
  }
  return violations
}

// ─── 主流程 ─────────────────────────────────────────────────

const repoRoot = process.cwd()
const allViolations = []
let scannedFiles = 0

for (const scanDir of SCAN_DIRS) {
  const fullDir = join(repoRoot, scanDir)
  const files = walkDir(fullDir)
  for (const file of files) {
    scannedFiles++
    const content = readFileSync(file, 'utf8')
    const violations = findViolations(content, file)
    allViolations.push(...violations)
  }
}

if (allViolations.length === 0) {
  console.log(`${C.green}✅ 全屏遮罩 z-index 检查通过${C.reset} ${C.dim}(扫描 ${scannedFiles} 文件,无 fixed inset-0 + 低 z 类 + 视觉遮罩背景的违规)${C.reset}`)
  process.exit(0)
}

console.error('')
console.error(`${C.red}❌ 全屏遮罩 z-index 检查失败:发现 ${C.bold}${allViolations.length}${C.reset}${C.red} 处违规${C.reset}`)
console.error('')
console.error(`${C.dim}违规规则:fixed inset-0 + 视觉遮罩背景(bg-black/\d 等) + 禁止 z 类(z-0/10/20/30/40/50)${C.reset}`)
console.error(`${C.dim}禁止 z 类值 < 100,低于 AISidePanel 的 z-sticky=990,会导致遮罩被 AI 面板覆盖${C.reset}`)
console.error('')

for (const v of allViolations) {
  const relPath = relative(repoRoot, v.file)
  console.error(`  ${C.red}${relPath}:${v.line}${C.reset}`)
  console.error(`  ${C.yellow}  z 类: ${v.zClass}${C.reset}`)
  console.error(`  ${C.dim}  ${v.content}${C.reset}`)
  console.error('')
}

console.error(`${C.bold}修复方法:${C.reset}`)
console.error(`  把 ${C.red}z-50${C.reset} 改为 ${C.green}z-modal${C.reset}(=2000, 引用 --z-modal CSS 变量)`)
console.error(`  ${C.dim}z-modal 在 apps/web/app/globals.css 中定义为 var(--z-modal) = 2000${C.reset}`)
console.error('')
console.error(`${C.dim}透明点击捕获层(无 bg-black 背景)不在本守门范围,允许低 z-index${C.reset}`)
console.error('')
process.exit(1)
