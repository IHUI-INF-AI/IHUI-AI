#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * z-index 层叠防护守门 (2026-07-24 立,2026-07-24 修正)
 *
 * 防止 AI 面板登录弹窗遮罩层叠修复被回归:
 *
 * 1. tokens.css 中 z-index 变量禁止 !important
 *    (项目规则:project_memory.md 第 6 行,2026-07-06 立,禁止 !important)
 *    TRAE 注入防护由 layout.tsx inline script 运行时 setProperty 实现,无需 !important
 * 2. globals.css 中 z-index 工具类禁止 !important
 *    (同上,变量值由 inline script 覆盖,var() 引用自动拿到正确值)
 * 3. layout.tsx inline script 必须设置 6 个 z-index 变量
 *    (运行时 inline style 优先级高于 stylesheet,覆盖 TRAE 注入)
 * 4. dialog.tsx 遮罩不得有 open 态 fade-in 动画
 *    (fade-in 让遮罩从 opacity:0 渐显,期间 AI 面板全亮度暴露 = "发亮")
 *
 * 历史教训(2026-07-24):
 *   v1 修复用 !important 违反项目禁令(project_memory.md 第 6 行),
 *   v2 改用 layout.tsx inline script 运行时 setProperty,合规且更可靠。
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
const LAYOUT_PATH = join(ROOT, 'apps/web/app/layout.tsx')
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
        f.includes('apps/web/app/layout.tsx') ||
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
console.log('🛡️  z-index 层叠防护守门(禁 !important + inline script 覆盖 + 遮罩 fade-in 回归)...')

// ============================================================
// 检查 1: tokens.css 中 z-index 变量禁止 !important
// ============================================================
const CHECK_VARS = [
  { name: '--z-base', value: '1' },
  { name: '--z-sticky', value: '990' },
  { name: '--z-modal', value: '2000' },
  { name: '--z-popover', value: '2001' },
  { name: '--z-notification', value: '9999' },
  { name: '--z-max', value: '10003' },
]

console.log('  [1/4] 检查 tokens.css z-index 变量无 !important...')
if (existsSync(TOKENS_PATH)) {
  const css = readFileSync(TOKENS_PATH, 'utf8')
  for (const { name, value } of CHECK_VARS) {
    // 检查变量存在
    const valuePattern = new RegExp(
      `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}\\s*(?:;|$)`,
    )
    // 检查变量没有 !important
    const importantPattern = new RegExp(
      `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}\\s*!important`,
    )

    if (importantPattern.test(css)) {
      console.log(`${C.red}    ❌ ${name}: ${value} 含有 !important(违反项目禁令)${C.reset}`)
      console.log(`${C.dim}       项目规则(project_memory.md 第 6 行)禁止 !important${C.reset}`)
      console.log(`${C.dim}       TRAE 注入防护由 layout.tsx inline script 运行时 setProperty 实现${C.reset}`)
      hasError = true
    } else if (!valuePattern.test(css)) {
      console.log(`${C.red}    ❌ ${name}: ${value} 未找到(变量缺失)${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${name}: ${value} (无 !important)${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  tokens.css 不存在: ${TOKENS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 2: globals.css 中 z-index 工具类禁止 !important
// ============================================================
const CHECK_UTILITIES = ['.z-sticky', '.z-modal', '.z-popover', '.z-notification', '.z-max']

console.log('  [2/4] 检查 globals.css z-index 工具类无 !important...')
if (existsSync(GLOBALS_PATH)) {
  const css = readFileSync(GLOBALS_PATH, 'utf8')
  for (const cls of CHECK_UTILITIES) {
    const varName = cls.replace('.', '--')
    const importantPattern = new RegExp(
      `${cls.replace('.', '\\.')}\\s*\\{[^}]*z-index\\s*:\\s*var\\(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*!important`,
    )

    if (importantPattern.test(css)) {
      console.log(`${C.red}    ❌ ${cls} 的 z-index 含有 !important(违反项目禁令)${C.reset}`)
      console.log(`${C.dim}       变量值由 layout.tsx inline script 覆盖,var() 自动拿到正确值${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${cls} (无 !important)${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  globals.css 不存在: ${GLOBALS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 3: layout.tsx inline script 必须设置 z-index 变量
// ============================================================
console.log('  [3/4] 检查 layout.tsx inline script 设置 z-index 变量...')
if (existsSync(LAYOUT_PATH)) {
  const tsx = readFileSync(LAYOUT_PATH, 'utf8')

  // 检查 inline script 中是否包含 setProperty 调用设置 z-index 变量
  const requiredInScript = [
    "setProperty('--z-base'",
    "setProperty('--z-sticky'",
    "setProperty('--z-modal'",
    "setProperty('--z-popover'",
    "setProperty('--z-notification'",
    "setProperty('--z-max'",
  ]

  for (const snippet of requiredInScript) {
    if (!tsx.includes(snippet)) {
      console.log(`${C.red}    ❌ inline script 缺少 ${snippet}${C.reset}`)
      console.log(`${C.dim}       需在 layout.tsx 的 <script dangerouslySetInnerHTML> 中设置此变量${C.reset}`)
      hasError = true
    }
  }

  if (!hasError) {
    console.log(`${C.green}    ✅ inline script 包含 6 个 z-index 变量设置${C.reset}`)
  }
} else {
  console.log(`${C.yellow}    ⚠️  layout.tsx 不存在: ${LAYOUT_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 4: dialog.tsx 遮罩不得有 open 态 fade-in 动画
// ============================================================
console.log('  [4/4] 检查 dialog.tsx 遮罩无 open 态 fade-in 动画...')
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
  console.log(`${C.dim}   历史教训:2026-07-24 AI 面板"跟着登录窗发亮"问题${C.reset}`)
  console.log(`${C.dim}   v1 用 !important 违反项目禁令,v2 改用 inline script 运行时覆盖${C.reset}`)
  console.log(`${C.dim}   防护:layout.tsx setProperty + 无 fade-in + 禁止 !important${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.green}✅ z-index 层叠防护守门通过${C.reset}`)
}
