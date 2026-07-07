#!/usr/bin/env node
/**
 * styles/ 多 Agent 协作协调守门 (2026-07-06 立)
 *
 * 配套 pre-commit 守门: check-tooltip-style-single-source.mjs
 *
 * 防撞目标:
 *   防止多个 Agent 并发修改 styles/ 目录时, 互相删除对方的修复.
 *   2026-07-06 事件: Agent A 加 `html.dark .el-popper.is-dark` 暗色修复,
 *                     Agent B 加 `html:not(.dark) .el-popper.is-dark` 亮色修复.
 *                     两个修复互补, 但都在 dark-mode-override.scss 同一文件,
 *                     未来若任一 Agent 不小心删除对方的修复, 用户会再次看到撞色 bug.
 *
 * 守门规则:
 *   1. dark-mode-override.scss 必须同时含 `html.dark .el-popper.is-dark` 和
 *      `html:not(.dark) .el-popper.is-dark` 两条规则 (顺序不限, 都必须在).
 *   2. 两条规则都必须在样式中胜出 (unlayered + !important 强制).
 *   3. 两条规则都必须用 !important 修饰 (防止被其他规则覆盖).
 *   4. 暗色规则用 var(--el-bg-color) (深色) + var(--el-text-color-primary) (浅色).
 *   5. 亮色规则用 var(--el-bg-color) (浅色) + var(--el-text-color-primary) (深色).
 *   6. index.scss 必须 @use './dark-mode-override' (确保样式被加载).
 *
 * 用法:
 *   node scripts/check-styles-coordination.mjs
 *   node scripts/check-styles-coordination.mjs --staged
 *
 * 退出码:
 *   0 - 通过
 *   1 - 任何协调规则被破坏
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLIENT_ROOT = resolve(__dirname, '..')
const STYLES_DIR = resolve(CLIENT_ROOT, 'src', 'styles')
const DARK_FILE = join(STYLES_DIR, 'dark-mode-override.scss')
const INDEX_FILE = join(STYLES_DIR, 'index.scss')
const MAIN_TS = join(CLIENT_ROOT, 'src', 'main.ts')

const onlyStaged = process.argv.includes('--staged')

// 如果 --staged 且没有相关文件在 staged, 直接通过
if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: CLIENT_ROOT,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const targets = stagedFiles
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => f.includes('src/styles/') || f.includes('scripts/check-styles-coordination.mjs'))
    if (targets.length === 0) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

let failed = 0
let checked = 0

function check(name, ok, detail) {
  checked++
  if (ok) {
    console.log(`[ OK ] ${name}`)
  } else {
    failed++
    console.error(`[FAIL] ${name}`)
    if (detail) console.error(`       ${detail}`)
  }
}

if (!existsSync(DARK_FILE)) {
  console.error(`[FAIL] dark-mode-override.scss 不存在: ${DARK_FILE}`)
  process.exit(1)
}

if (!existsSync(INDEX_FILE)) {
  console.error(`[FAIL] index.scss 不存在: ${INDEX_FILE}`)
  process.exit(1)
}

const darkContent = readFileSync(DARK_FILE, 'utf-8')
const indexContent = readFileSync(INDEX_FILE, 'utf-8')

// 去除 SCSS 注释
const darkStripped = darkContent
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

// ════════════════════════════════════════════════════════════════════════
// 1. 暗色修复必须存在: html.dark .el-popper.is-dark { ... }
// ════════════════════════════════════════════════════════════════════════
const darkBlockMatch = darkStripped.match(
  /html\.dark\s+\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/
)
check(
  '1. dark-mode-override.scss 含 `html.dark .el-popper.is-dark` 暗色修复块',
  !!darkBlockMatch,
  '根因: Agent A 在本文件加了暗色修复, 任何 agent 误删都会导致暗色模式 tooltip 撞色. ' +
    '修复: 重新加回 `html.dark .el-popper.is-dark { background-color: var(--el-bg-color) !important; color: var(--el-text-color-primary) !important; }`'
)
let darkBlock = ''
if (darkBlockMatch) darkBlock = darkBlockMatch[1]

// ════════════════════════════════════════════════════════════════════════
// 2. 亮色修复必须存在: html:not(.dark) .el-popper.is-dark { ... }
// ════════════════════════════════════════════════════════════════════════
const lightBlockMatch = darkStripped.match(
  /html:not\(\.dark\)\s+\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/
)
check(
  '2. dark-mode-override.scss 含 `html:not(.dark) .el-popper.is-dark` 亮色修复块',
  !!lightBlockMatch,
  '根因: Agent B 在本文件加了亮色修复, 任何 agent 误删都会导致亮色模式 tooltip 黑底白字不协调. ' +
    '修复: 重新加回 `html:not(.dark) .el-popper.is-dark { background-color: var(--el-bg-color) !important; color: var(--el-text-color-primary) !important; }`'
)
let lightBlock = ''
if (lightBlockMatch) lightBlock = lightBlockMatch[1]

// ════════════════════════════════════════════════════════════════════════
// 3. 暗色修复必须用 !important (防止被覆盖)
// ════════════════════════════════════════════════════════════════════════
check(
  '3. 暗色修复块必须用 !important 修饰',
  darkBlock.includes('!important'),
  '根因: Element Plus 自身 .el-popper.is-dark 是 unlayered, 必须 !important 才能胜出. ' +
    '修复: 在 background-color / color 后加 !important.'
)

// ════════════════════════════════════════════════════════════════════════
// 4. 亮色修复必须用 !important
// ════════════════════════════════════════════════════════════════════════
check(
  '4. 亮色修复块必须用 !important 修饰',
  lightBlock.includes('!important'),
  '根因: 同上, 必须 !important 才能胜出 EP 默认黑底白字. ' +
    '修复: 在 background-color / color 后加 !important.'
)

// ════════════════════════════════════════════════════════════════════════
// 5. 暗色修复的 background 用 var(--el-bg-color) (深色), color 用 var(--el-text-color-primary) (浅色)
// ════════════════════════════════════════════════════════════════════════
check(
  '5a. 暗色修复 background-color 用 var(--el-bg-color) (深色 #1a1a1a)',
  /background-color\s*:\s*var\(--el-bg-color\)/.test(darkBlock)
)
check(
  '5b. 暗色修复 color 用 var(--el-text-color-primary) (浅色 #e5eaf3)',
  /color\s*:\s*var\(--el-text-color-primary\)/.test(darkBlock)
)

// ════════════════════════════════════════════════════════════════════════
// 6. 亮色修复的 background 用 var(--el-bg-color) (浅色), color 用 var(--el-text-color-primary) (深色)
// ════════════════════════════════════════════════════════════════════════
check(
  '6a. 亮色修复 background-color 用 var(--el-bg-color) (浅色 #f7f8fa)',
  /background-color\s*:\s*var\(--el-bg-color\)/.test(lightBlock)
)
check(
  '6b. 亮色修复 color 用 var(--el-text-color-primary) (深色 #000)',
  /color\s*:\s*var\(--el-text-color-primary\)/.test(lightBlock)
)

// ════════════════════════════════════════════════════════════════════════
// 7. dark-mode-override.scss 必须被项目入口引入 (main.ts 或 index.scss 至少一处)
// ════════════════════════════════════════════════════════════════════════
const mainTsContent = existsSync(MAIN_TS) ? readFileSync(MAIN_TS, 'utf-8') : ''
const mainImports = /import\s+['"]\.\/styles\/dark-mode-override(?:\.scss)?['"]/.test(mainTsContent) ||
  /from\s+['"]\.\/styles\/dark-mode-override/.test(mainTsContent)
const indexUses = /@use\s+['"]\.\/dark-mode-override['"]/.test(indexContent) ||
  /@use\s+['"]\.\/dark-mode-override\.scss['"]/.test(indexContent) ||
  /@import\s+['"]\.\/dark-mode-override/.test(indexContent)
check(
  '7. main.ts 或 index.scss 至少一处必须引入 dark-mode-override (否则两个修复不会生效)',
  mainImports || indexUses,
  '修复: 在 src/main.ts 加 `import \'./styles/dark-mode-override.scss\'` 或在 src/styles/index.scss 末尾加 `@use \'./dark-mode-override\';`'
)

if (failed > 0) {
  console.error(`\n❌ 失败 ${failed}/${checked} 项: 多 Agent styles 协调规则被破坏`)
  console.error('   任何 agent 修改 dark-mode-override.scss / index.scss 后, 必须保持两个修复共存')
  console.error('   详见 AGENTS.md "## 多 Agent 并发修改 styles/ 防撞机制" 章节')
  process.exit(1)
}

console.log(`\n✅ 协调规则全部通过 (${checked} 项检查)`)
console.log('   暗色修复 + 亮色修复 + !important + 颜色变量 + index.scss 引入均完整')
