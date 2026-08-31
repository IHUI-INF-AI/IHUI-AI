#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 侧边栏宽度一致性守门 (2026-07-22 立)
 *
 * 防止 design-tokens.css 的 --sidebar-width 与 sidebar.tsx 的 SIDEBAR_WIDTH 不一致,
 * 导致首屏 CSS 预设值 → JS useEffect 覆盖值的宽度跳变闪烁。
 *
 * 根因案例(2026-07-22):
 *   design-tokens.css 有 --sidebar-width: 200px,sidebar.tsx SIDEBAR_WIDTH=130,
 *   CSS 先渲染 200px,JS useEffect 覆盖为 130px → 用户看到 200→130 的宽度跳变。
 *
 * 用法:
 *   node scripts/check-sidebar-width-consistency.mjs          (全量检查, exit 0/1)
 *   node scripts/check-sidebar-width-consistency.mjs --staged  (仅 staged 涉及时检查)
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

const TOKENS_CANDIDATES = [
  'packages/design-tokens/src/styles/tokens.css',
  'packages/design-tokens/dist/styles/tokens.css',
  'apps/web/src/styles/design-tokens.css',
]
const SIDEBAR_PATH = join(ROOT, 'apps/web/src/components/sidebar.tsx')

function pickTokensPath() {
  for (const rel of TOKENS_CANDIDATES) {
    const abs = join(ROOT, rel)
    if (existsSync(abs)) return abs
  }
  return null
}

const TOKENS_PATH = pickTokensPath()

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
        f.includes('design-tokens.css') ||
        f.includes('tokens.css') ||
        f.includes('sidebar.tsx'),
    )
    if (!relevant) {
      console.log(`${C.dim}⏭  侧边栏宽度一致性守门(无相关 staged 改动, 跳过)${C.reset}`)
      process.exit(0)
    }
  } catch {
    // 非 git 环境,跑全量
  }
}

let hasError = false

// 1. 读 tokens.css 的 --sidebar-width
let cssWidth = null
let cssSourceLabel = null
if (TOKENS_PATH) {
  const css = readFileSync(TOKENS_PATH, 'utf8')
  const m = css.match(/--sidebar-width:\s*(\d+)px/)
  if (m) {
    cssWidth = Number(m[1])
    cssSourceLabel = TOKENS_PATH.replace(ROOT + '\\', '').replace(ROOT + '/', '')
  }
}

// 2. 读 sidebar.tsx 的 SIDEBAR_WIDTH
let jsWidth = null
if (existsSync(SIDEBAR_PATH)) {
  const ts = readFileSync(SIDEBAR_PATH, 'utf8')
  const m = ts.match(/const\s+SIDEBAR_WIDTH\s*=\s*(\d+)/)
  if (m) {
    jsWidth = Number(m[1])
  }
}

// 3. 对比
console.log('📏 检查侧边栏宽度一致性(design-tokens.css vs sidebar.tsx)...')

if (cssWidth === null) {
  if (!TOKENS_PATH) {
    console.log(`${C.yellow}  ⚠️  未找到 design-tokens 源文件(已尝试: ${TOKENS_CANDIDATES.join(', ')})${C.reset}`)
  } else {
    console.log(`${C.yellow}  ⚠️  ${cssSourceLabel || 'tokens.css'} 中未找到 --sidebar-width 定义${C.reset}`)
  }
} else if (jsWidth === null) {
  console.log(`${C.yellow}  ⚠️  sidebar.tsx 中未找到 SIDEBAR_WIDTH 常量${C.reset}`)
} else if (cssWidth !== jsWidth) {
  console.log(`${C.red}  ❌ 不一致!${cssSourceLabel} --sidebar-width: ${cssWidth}px ≠ sidebar.tsx SIDEBAR_WIDTH: ${jsWidth}px${C.reset}`)
  console.log(`${C.red}     这会导致首屏 CSS 预设 ${cssWidth}px → JS useEffect 覆盖 ${jsWidth}px 的宽度跳变闪烁${C.reset}`)
  console.log(`${C.dim}     修复:把 ${cssSourceLabel} 的 --sidebar-width 改为 ${jsWidth}px${C.reset}`)
  hasError = true
} else {
  console.log(`${C.green}  ✅ 一致:${cssSourceLabel} --sidebar-width: ${cssWidth}px === SIDEBAR_WIDTH: ${jsWidth}px${C.reset}`)
}

if (hasError) {
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
