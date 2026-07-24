#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * z-index 层叠防护守门 (2026-07-24 立)
 *
 * 防止 AI 面板登录弹窗遮罩层叠修复(2026-07-24)被回归:
 *
 * 1. tokens.css 中 6 个关键 z-index 变量必须有 !important
 *    (防 TRAE IDE 注入 solo-lite-theme-variables 覆盖变量值)
 * 2. globals.css 中 5 个对应工具类的 z-index 属性必须有 !important
 *    (双重防护,防属性级覆写)
 * 3. dialog.tsx 遮罩不得有 open 态 fade-in 动画
 *    (fade-in 让遮罩从 opacity:0 渐显,期间 AI 面板全亮度暴露 = "发亮")
 *
 * 历史教训(2026-07-24):
 *   用户反馈"AI 对话框组件总是随着登录窗弹出跟着一起发亮",根因是 TRAE IDE
 *   注入的 CSS 变量覆盖了项目值 + 遮罩 fade-in 动画。修复后用户要求"防止回归,
 *   别过两天又变回去了"。本脚本从机制上杜绝此类回归。
 *
 * 用法:
 *   node scripts/check-z-index-guard.mjs          (全量检查, exit 0/1)
 *   node scripts/check-z-index-guard.mjs --staged  (仅 staged 涉及时检查)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const TOKENS_PATH = join(ROOT, 'packages/design-tokens/src/styles/tokens.css')
const GLOBALS_PATH = join(ROOT, 'apps/web/app/globals.css')
const DIALOG_PATH = join(ROOT, 'packages/ui-react/src/components/dialog.tsx')

// --staged 模式:只在相关文件被 staged 时才检查
if (isStaged) {
  try {
    const { execSync } = await import('node:child_process')
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    const files = staged.split('\n').filter(Boolean)
    const relevant = files.some(
      (f) =>
        f.includes('design-tokens/src/styles/tokens.css') ||
        f.includes('apps/web/app/globals.css') ||
        f.includes('ui-react/src/components/dialog.tsx'),
    )
    if (!relevant) {
      console.log(`${C.dim}⏭  z-index 层叠防护守门(无相关 staged 改动, 跳过)${C.reset}`)
      process.exit(0)
    }
  } catch {
    // 非 git 环境,跑全量
  }
}

let hasError = false
console.log('🛡️  z-index 层叠防护守门(防 TRAE 注入覆盖 + 遮罩 fade-in 回归)...')

// ============================================================
// 检查 1: tokens.css 中 6 个关键 z-index 变量必须有 !important
// ============================================================
const REQUIRED_VARS = [
  { name: '--z-base', value: '1' },
  { name: '--z-sticky', value: '990' },
  { name: '--z-modal', value: '2000' },
  { name: '--z-popover', value: '2001' },
  { name: '--z-notification', value: '9999' },
  { name: '--z-max', value: '10003' },
]

console.log('  [1/3] 检查 tokens.css z-index 变量 !important...')
if (existsSync(TOKENS_PATH)) {
  const css = readFileSync(TOKENS_PATH, 'utf8')
  for (const { name, value } of REQUIRED_VARS) {
    // 匹配 --z-xxx: <value> !important (允许中间有注释)
    const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}\\s*!important`)
    if (!pattern.test(css)) {
      console.log(`${C.red}    ❌ ${name}: ${value} 缺少 !important${C.reset}`)
      console.log(`${C.dim}       TRAE IDE 会注入 solo-lite-theme-variables 覆盖此变量,不加 !important 会被压低${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${name}: ${value} !important${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  tokens.css 不存在: ${TOKENS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 2: globals.css 中 5 个关键工具类 z-index 属性必须有 !important
// ============================================================
const REQUIRED_UTILITIES = ['.z-sticky', '.z-modal', '.z-popover', '.z-notification', '.z-max']

console.log('  [2/3] 检查 globals.css z-index 工具类 !important...')
if (existsSync(GLOBALS_PATH)) {
  const css = readFileSync(GLOBALS_PATH, 'utf8')
  for (const cls of REQUIRED_UTILITIES) {
    // 匹配 .z-xxx { ... z-index: var(--z-xxx) !important ... }
    const varName = cls.replace('.', '--')
    const pattern = new RegExp(
      `${cls.replace('.', '\\.')}\\s*\\{[^}]*z-index\\s*:\\s*var\\(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*!important`,
    )
    if (!pattern.test(css)) {
      console.log(`${C.red}    ❌ ${cls} 的 z-index 属性缺少 !important${C.reset}`)
      console.log(`${C.dim}       @layer utilities 内样式优先级低于 unlayered,不加 !important 会被 TRAE 注入压过${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${cls} z-index !important${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  globals.css 不存在: ${GLOBALS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 3: dialog.tsx 遮罩不得有 open 态 fade-in 动画
// ============================================================
console.log('  [3/3] 检查 dialog.tsx 遮罩无 open 态 fade-in 动画...')
if (existsSync(DIALOG_PATH)) {
  const tsx = readFileSync(DIALOG_PATH, 'utf8')

  // 找 Overlay 的 className 行
  const overlayMatch = tsx.match(/DialogPrimitive\.Overlay[^>]*className="([^"]+)"/)
  if (!overlayMatch) {
    console.log(`${C.yellow}    ⚠️  未找到 DialogPrimitive.Overlay,可能 dialog.tsx 结构已变更${C.reset}`)
    console.log(`${C.dim}       请人工确认遮罩无 fade-in 动画${C.reset}`)
  } else {
    const overlayClass = overlayMatch[1]

    // 检测 open 态 fade-in: data-[state=open]:animate-in 或 data-[state=open]:fade-in-0
    const hasOpenFadeIn =
      /data-\[state=open\]:animate-in/.test(overlayClass) ||
      /data-\[state=open\]:fade-in-0/.test(overlayClass)

    if (hasOpenFadeIn) {
      console.log(`${C.red}    ❌ 遮罩含 open 态 fade-in 动画: ${overlayClass.substring(0, 80)}...${C.reset}`)
      console.log(`${C.dim}       fade-in 让遮罩从 opacity:0 渐显,150ms 内 AI 面板全亮度暴露 = "发亮"${C.reset}`)
      console.log(`${C.dim}       修复:移除 data-[state=open]:animate-in 和 data-[state=open]:fade-in-0${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ 遮罩无 open 态 fade-in 动画${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  dialog.tsx 不存在: ${DIALOG_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 汇总
// ============================================================
if (hasError) {
  console.log('')
  console.log(`${C.red}❌ z-index 层叠防护守门失败${C.reset}`)
  console.log(`${C.dim}   历史教训:2026-07-24 AI 面板"跟着登录窗发亮"问题,因 TRAE IDE 注入${C.reset}`)
  console.log(`${C.dim}   CSS 变量覆盖 + 遮罩 fade-in 动画导致。修复后需 !important + 无 fade-in 防回归。${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.green}✅ z-index 层叠防护守门通过${C.reset}`)
}
