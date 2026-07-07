/**
 * styles/ 多 Agent 协作协调 E2E 测试 (2026-07-06 立)
 *
 * 配套源码级守门: scripts/check-styles-coordination.mjs
 * 配套浏览器级守门: e2e/tooltip-dark-mode-contrast.spec.ts
 *
 * 防撞目标:
 *   防止多个 Agent 并发修改 styles/ 目录时, 互相删除对方的修复.
 *   2026-07-06 事件: Agent A 加暗色修复, Agent B 加亮色修复, 两个都在 dark-mode-override.scss.
 *
 * 验证项 (纯源码级, 不需要浏览器):
 *   A. dark-mode-override.scss 含 `html.dark .el-popper.is-dark` 暗色修复块
 *   B. dark-mode-override.scss 含 `html:not(.dark) .el-popper.is-dark` 亮色修复块
 *   C. 暗色修复用 !important
 *   D. 亮色修复用 !important
 *   E. 暗色修复 color 用 var(--el-text-color-primary) (浅色)
 *   F. 亮色修复 color 用 var(--el-text-color-primary) (深色)
 *   G. index.scss 引入 dark-mode-override
 *   H. 守门脚本 check-styles-coordination.mjs 存在
 *   I. AGENTS.md 含 "多 Agent 并发修改 styles/ 防撞机制" 章节
 *
 * CI 入口: npx playwright test e2e/styles-coordination.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLIENT_ROOT = join(__dirname, '..')
const PROJECT_ROOT = join(CLIENT_ROOT, '..')
const STYLES_DIR = join(CLIENT_ROOT, 'src', 'styles')
const DARK_FILE = join(STYLES_DIR, 'dark-mode-override.scss')
const INDEX_FILE = join(STYLES_DIR, 'index.scss')
const GUARD_SCRIPT = join(CLIENT_ROOT, 'scripts', 'check-styles-coordination.mjs')
const AGENTS_MD = join(PROJECT_ROOT, 'AGENTS.md')

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

// ════════════════════════════════════════════════════════════════════════
// A. 暗色修复块
// ════════════════════════════════════════════════════════════════════════
test('A. dark-mode-override.scss 含 `html.dark .el-popper.is-dark` 暗色修复块', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  expect(
    stripped,
    'dark-mode-override.scss 必须含 `html.dark .el-popper.is-dark` 暗色修复块 (Agent A 修复).'
  ).toMatch(/html\.dark\s+\.el-popper\.is-dark\s*\{/)
})

// ════════════════════════════════════════════════════════════════════════
// B. 亮色修复块
// ════════════════════════════════════════════════════════════════════════
test('B. dark-mode-override.scss 含 `html:not(.dark) .el-popper.is-dark` 亮色修复块', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  expect(
    stripped,
    'dark-mode-override.scss 必须含 `html:not(.dark) .el-popper.is-dark` 亮色修复块 (Agent B 修复).'
  ).toMatch(/html:not\(\.dark\)\s+\.el-popper\.is-dark\s*\{/)
})

// ════════════════════════════════════════════════════════════════════════
// C. 暗色修复用 !important
// ════════════════════════════════════════════════════════════════════════
test('C. 暗色修复块必须用 !important', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const m = stripped.match(/html\.dark\s+\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/)
  expect(m, '暗色修复块不存在').not.toBeNull()
  expect(m![1], '暗色修复块必须含 !important').toMatch(/!important/)
})

// ════════════════════════════════════════════════════════════════════════
// D. 亮色修复用 !important
// ════════════════════════════════════════════════════════════════════════
test('D. 亮色修复块必须用 !important', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const m = stripped.match(/html:not\(\.dark\)\s+\.el-popper\.is-dark\s*\{([\s\S]*?)\n\}/)
  expect(m, '亮色修复块不存在').not.toBeNull()
  expect(m![1], '亮色修复块必须含 !important').toMatch(/!important/)
})

// ════════════════════════════════════════════════════════════════════════
// E. 暗色修复 color 用 var(--el-text-color-primary) (浅色)
// ════════════════════════════════════════════════════════════════════════
test('E. 暗色修复 color 用 var(--el-text-color-primary) (浅色文字)', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const m = stripped.match(/html\.dark\s+\.el-popper\.is-dark\s*\{([\s!S]*?)\}/)
  expect(m, '暗色修复块不存在').not.toBeNull()
  expect(
    m![1],
    '暗色修复 color 必须用 var(--el-text-color-primary) (暗色下为浅色 #e5eaf3).'
  ).toMatch(/color\s*:\s*var\(--el-text-color-primary\)/)
})

// ════════════════════════════════════════════════════════════════════════
// F. 亮色修复 color 用 var(--el-text-color-primary) (深色)
// ════════════════════════════════════════════════════════════════════════
test('F. 亮色修复 color 用 var(--el-text-color-primary) (深色文字)', () => {
  const content = readText(DARK_FILE)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  const m = stripped.match(/html:not\(\.dark\)\s+\.el-popper\.is-dark\s*\{([\s!S]*?)\}/)
  expect(m, '亮色修复块不存在').not.toBeNull()
  expect(
    m![1],
    '亮色修复 color 必须用 var(--el-text-color-primary) (亮色下为深色 #000).'
  ).toMatch(/color\s*:\s*var\(--el-text-color-primary\)/)
})

// ════════════════════════════════════════════════════════════════════════
// G. main.ts 或 index.scss 至少一处引入 dark-mode-override
// ════════════════════════════════════════════════════════════════════════
test('G. main.ts 或 index.scss 至少一处引入 dark-mode-override', () => {
  const indexContent = readText(INDEX_FILE)
  const indexHasIt = /@use\s+['"]\.\/dark-mode-override['"]|@import\s+['"]\.\/dark-mode-override/.test(indexContent)

  const mainTsPath = join(CLIENT_ROOT, 'src', 'main.ts')
  let mainHasIt = false
  if (existsSync(mainTsPath)) {
    const mainContent = readText(mainTsPath)
    mainHasIt = /import\s+['"]\.\/styles\/dark-mode-override/.test(mainContent) ||
      /from\s+['"]\.\/styles\/dark-mode-override/.test(mainContent)
  }

  expect(
    indexHasIt || mainHasIt,
    'main.ts 或 index.scss 至少一处必须引入 dark-mode-override.scss.\n' +
      '当前 mainHasIt=' + mainHasIt + ', indexHasIt=' + indexHasIt + '.'
  ).toBe(true)
})

// ════════════════════════════════════════════════════════════════════════
// H. 守门脚本存在
// ════════════════════════════════════════════════════════════════════════
test('H. 守门脚本 check-styles-coordination.mjs 存在', () => {
  expect(existsSync(GUARD_SCRIPT), `守门脚本不存在: ${GUARD_SCRIPT}`).toBe(true)
})

// ════════════════════════════════════════════════════════════════════════
// I. AGENTS.md 含协调规则章节
// ════════════════════════════════════════════════════════════════════════
test('I. AGENTS.md 含 "多 Agent 并发修改 styles/ 防撞机制" 章节', () => {
  expect(existsSync(AGENTS_MD), `AGENTS.md 不存在: ${AGENTS_MD}`).toBe(true)
  const content = readText(AGENTS_MD)
  expect(
    content,
    'AGENTS.md 必须含 "## 多 Agent 并发修改 styles/ 防撞机制（2026-07-06 立）" 章节'
  ).toMatch(/## 多 Agent 并发修改 styles\/ 防撞机制（2026-07-06 立）/)
})
