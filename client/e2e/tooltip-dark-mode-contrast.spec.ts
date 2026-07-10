/**
 * Tooltip 暗色模式撞色修复源码级守门 (2026-07-06 v2 立)
 *
 * 配套 pre-commit 守门: scripts/check-tooltip-style-single-source.mjs
 *
 * 防回归目标:
 *   防止 .el-popper.is-dark tooltip 在暗色模式下文字色与背景色撞色不可见.
 *
 * 真正的根因 (v2, 2026-07-06 修正):
 *   Element Plus 自身 .el-popper.is-dark 规则:
 *     .el-popper.is-dark {
 *       --el-fill-color-blank: var(--el-popper-bg-color-dark);
 *       color: var(--el-bg-color);
 *       background: var(--el-popper-bg-color-dark);
 *       border: 1px solid var(--el-text-color-primary);
 *     }
 *   其中 background: var(--el-popper-bg-color-dark) = var(--el-text-color-primary)
 *   = #e5eaf3 浅色, color: var(--el-bg-color) = #1a1a1a 深色.
 *   表现: 暗色系统下 tooltip 浅底 + 深字 = "反相暗色 tooltip" (Element Plus 设计意图).
 *   用户期望: 暗色系统下 tooltip 深底 + 浅字, 与暗色页面统一风格.
 *
 *   Vite dev 模式下 @import ... layer(vendor) 未生效, EP 实际是 unlayered.
 *   在 cascade 中, EP 的 unlayered 规则 source order 较晚 (main.ts 早 import),
 *   胜出所有 @layer components 修复 (即使加了 !important, layered !important
 *   仍不能胜出 unlayered 规则 - CSS Cascade 规则).
 *
 * 修复方案 (v5, 2026-07-06 终版, 零 !important, 零高特异性):
 *   在 dark-mode-override.scss unlayered 上下文用单类名选择器 .el-popper / 
 *   .el-popper.is-dark 覆盖. 同特异性 + source order (本文件在 EP 之后加载) 胜出.
 *   用 var(--el-bg-color) / var(--el-text-color-primary) 自动适配暗/亮模式,
 *   不需 html.dark 前缀, 不需 !important, 不需高特异性.
 *
 * 验证项 (纯源码级, 不需要浏览器):
 *   A. dark-mode-override.scss 必须有 .el-popper.is-dark 覆盖规则 (unlayered, 无 html.dark 前缀)
 *   B. 覆盖规则必须零 !important 且零 html.dark/html:not 高特异性前缀
 *   C. 覆盖规则 background 必须用 var(--el-bg-color) (自动适配暗/亮模式)
 *   D. 覆盖规则 color 必须用 var(--el-text-color-primary) (自动适配暗/亮模式)
 *   E. _element-plus-overrides.scss 旧修复 (在 @layer components 内, 加 :where 包裹)
 *      已被注释, 不能在源码中重新启用 (会在 cascade 中失败)
 *   F. 守门脚本 check-tooltip-style-single-source.mjs 必须存在
 *
 * CI 入口: npx playwright test e2e/tooltip-dark-mode-contrast.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLIENT_ROOT = join(__dirname, '..')
const STYLES_DIR = join(CLIENT_ROOT, 'src', 'styles')

function readStyle(name: string): string {
  return readFileSync(join(STYLES_DIR, name), 'utf-8')
}

// ════════════════════════════════════════════════════════════════════════
// A. dark-mode-override.scss 必须有 .el-popper.is-dark 覆盖规则 (无 html.dark 前缀)
// ════════════════════════════════════════════════════════════════════════
test('A. dark-mode-override.scss 必须有 .el-popper.is-dark 覆盖规则 (无 html.dark 前缀)', () => {
  const content = readStyle('dark-mode-override.scss')
  // 去除 SCSS 注释
  const contentNoComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  // 必须有 .el-popper.is-dark { 规则块 (不带 html.dark 前缀)
  expect(
    contentNoComments,
    'dark-mode-override.scss 必须有 `.el-popper.is-dark { ... }` 规则块 (无 html.dark 前缀).\n' +
    'v5: 用单类名选择器, 靠 source order 胜出 EP, 不需高特异性前缀.'
  ).toMatch(/(^|[^.])\.el-popper\.is-dark\s*\{/)
  // 不能有 html.dark .el-popper.is-dark (高特异性, 违反 .cursorrules 规范)
  expect(
    contentNoComments,
    '不能有 `html.dark .el-popper.is-dark` (高特异性前缀, 违反 .cursorrules 禁止高特异性选择器规范).'
  ).not.toMatch(/html\.dark\s+\.el-popper\.is-dark/)
})

// ════════════════════════════════════════════════════════════════════════
// B. 覆盖规则必须零 !important 且零 html.dark 高特异性前缀
// ════════════════════════════════════════════════════════════════════════
test('B. dark-mode-override.scss 的 .el-popper.is-dark 覆盖规则必须零 !important', () => {
  const content = readStyle('dark-mode-override.scss')
  // 去除 SCSS 注释
  const contentNoComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  // 找到 .el-popper.is-dark 规则块 (不带 html.dark 前缀)
  const blockMatch = contentNoComments.match(
    /(^|[^.])\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/
  )
  expect(blockMatch, '.el-popper.is-dark 规则块必须存在').not.toBeNull()
  const block = blockMatch![2]
  // v5: 必须零 !important (纯靠 source order 胜出, 不需 !important)
  expect(
    block,
    '.el-popper.is-dark 规则块内必须零 !important. ' +
    'v5 修复策略: 同特异性 + source order (本文件在 EP 之后加载) 胜出, 不需 !important.'
  ).not.toMatch(/!important/)
})

// ════════════════════════════════════════════════════════════════════════
// C. 覆盖规则 background 必须用 var(--el-bg-color) (自动适配暗/亮模式)
// ════════════════════════════════════════════════════════════════════════
test('C. dark-mode-override.scss .el-popper.is-dark background 必须用 var(--el-bg-color)', () => {
  const content = readStyle('dark-mode-override.scss')
  const contentNoComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const blockMatch = contentNoComments.match(
    /(^|[^.])\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/
  )
  expect(blockMatch, '.el-popper.is-dark 规则块必须存在').not.toBeNull()
  const block = blockMatch![2]
  expect(
    block,
    'background-color 必须用 var(--el-bg-color) (暗色=#1a1a1a 深色, 亮色=#ffffff 浅色, 自动适配).'
  ).toMatch(/background-color\s*:\s*var\(--el-bg-color\)/)
  expect(
    block,
    'background-color 不能用 var(--el-text-color-primary) (会导致反相).'
  ).not.toMatch(/background-color\s*:\s*var\(--el-text-color-primary\)/)
})

// ════════════════════════════════════════════════════════════════════════
// D. 覆盖规则 color 必须用 var(--el-text-color-primary) (自动适配暗/亮模式)
// ════════════════════════════════════════════════════════════════════════
test('D. dark-mode-override.scss .el-popper.is-dark color 必须用 var(--el-text-color-primary)', () => {
  const content = readStyle('dark-mode-override.scss')
  const contentNoComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const blockMatch = contentNoComments.match(
    /(^|[^.])\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/
  )
  expect(blockMatch, '.el-popper.is-dark 规则块必须存在').not.toBeNull()
  const block = blockMatch![2]
  expect(
    block,
    'color 必须用 var(--el-text-color-primary) (暗色=#e5eaf3 浅色, 亮色=#303133 深色, 自动适配).'
  ).toMatch(/color\s*:\s*var\(--el-text-color-primary\)/)
  expect(
    block,
    'color 不能用 var(--color-gray-ededed) (#ededed, 与 #e5eaf3 太接近会撞色).'
  ).not.toMatch(/color\s*:\s*var\(--color-gray-ededed\)/)
})

// ════════════════════════════════════════════════════════════════════════
// E. _element-plus-overrides.scss 旧修复不能重新启用
//    (在 @layer components 内, 即使加 !important 也不能胜出 EP unlayered 规则)
// ════════════════════════════════════════════════════════════════════════
test('E. _element-plus-overrides.scss 旧 .el-popper.is-dark 修复 (在 @layer components 内) 必须保持注释状态', () => {
  const content = readStyle('_element-plus-overrides.scss')
  // 去除 SCSS 注释
  const contentNoComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  // 在 .el-popper.is-dark 规则块附近 (不带 html.dark 限定) 不能有 background-color 或 color 属性
  // 这是为了防止重新启用旧修复 (在 @layer components 内, 不能胜出 EP unlayered 规则)
  // 但要允许 dark-mode-override.scss 风格的 html.dark .el-popper.is-dark 规则 (虽然不在这个文件)
  // 我们只检查非 html.dark 前缀的 .el-popper.is-dark 规则
  const blockMatch = contentNoComments.match(
    /(?<!html\.dark\s)\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/g
  )
  if (blockMatch) {
    for (const block of blockMatch) {
      expect(
        block,
        '_element-plus-overrides.scss 内的 .el-popper.is-dark 规则 (无 html.dark 限定) ' +
        '必须在 @layer components 内, 即使加 !important 也不能胜出 EP unlayered 规则, ' +
        '必须保持注释状态. 修复应在 dark-mode-override.scss 内 (unlayered + !important).'
      ).not.toMatch(/background-color\s*:/)
    }
  }
  // 反向: 旧注释块必须存在 (说明设计意图已记录)
  expect(
    content,
    '必须保留旧 :where 注释块作为历史参考 (v2 修复后保留注释, 防止未来误恢复).'
  ).toMatch(/旧 :where\(\) 包裹块已废弃/)
})

// ════════════════════════════════════════════════════════════════════════
// F. 守门脚本必须存在
// ════════════════════════════════════════════════════════════════════════
test('F. 守门脚本 check-tooltip-style-single-source.mjs 必须存在且可执行', async () => {
  const scriptPath = join(CLIENT_ROOT, 'scripts', 'check-tooltip-style-single-source.mjs')
  const scriptContent = readFileSync(scriptPath, 'utf-8')
  expect(scriptContent).toMatch(/WHITELIST/)
  expect(scriptContent).toMatch(/_global-ui\.scss/)
  expect(scriptContent).toMatch(/_element-plus-overrides\.scss/)
  expect(scriptContent).toMatch(/CSS Cascade Layers/)
})
