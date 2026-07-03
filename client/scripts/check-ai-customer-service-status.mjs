#!/usr/bin/env node
/**
 * 客服主题 .cs-status-* 样式迁回 chatheaderbar.vue 防回归 (2026-07-03) — 轻量级 pre-commit 守门
 *
 * 目的: pre-commit 阶段 (< 100ms) 拦截"将 .cs-status-* 5 块迁回 _customer-service-theme.scss"
 *       的回退行为, 避免 e2e 88 用例跑完才发现。
 *
 * 与 e2e/ai-customer-service-status-migrated.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整源码级断言 (CI 阶段, 含视口参数化)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-ai-customer-service-status.mjs          # 全量
 *   node scripts/check-ai-customer-service-status.mjs --staged # 仅 staged
 *
 * 退出码:
 *   0 - 通过
 *   1 - 迁移被回退
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const CHATHEADERBAR_VUE = path.join(
  clientRoot,
  'src/components/ai/chat-parts/chatheaderbar.vue'
)
const CUSTOMER_SERVICE_THEME_SCSS = path.join(
  clientRoot,
  'src/styles/ai-chat/_customer-service-theme.scss'
)
const AICHAT_VUE = path.join(clientRoot, 'src/components/ai/AIChat.vue')

const onlyStaged = process.argv.includes('--staged')

// 如果 --staged 且相关文件都不在 staged, 直接通过
if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const relevantFiles = [
      CHATHEADERBAR_VUE,
      CUSTOMER_SERVICE_THEME_SCSS,
      AICHAT_VUE,
    ].map((p) => path.relative(projectRoot, p).replace(/\\/g, '/'))
    const hasRelevant = relevantFiles.some((f) => stagedFiles.includes(f))
    if (!hasRelevant) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退到全量
  }
}

let hasError = false
const fail = (msg) => {
  console.error(`[FAIL] ${msg}`)
  hasError = true
}

// 1) chatheaderbar.vue 必须包含 5 个 .cs-status-* 选择器
if (!fs.existsSync(CHATHEADERBAR_VUE)) {
  fail(`chatheaderbar.vue 不存在: ${CHATHEADERBAR_VUE}`)
} else {
  const content = fs.readFileSync(CHATHEADERBAR_VUE, 'utf8')
  for (const sel of [
    '.cs-status-wrap',
    '.cs-status-indicator',
    '.cs-status-dot',
    '.cs-status-ring',
    '.cs-status-text',
  ]) {
    const re = new RegExp(`\\${sel}\\s*\\{`)
    if (!re.test(content)) {
      fail(
        `chatheaderbar.vue 缺失 ${sel} 块。2026-07-03 客服主题 .cs-status-* 5 块迁回子组件 scoped 块, 删这些块会导致客服主题下连接状态指示器没有布局。`
      )
    }
  }

  // 2) chatheaderbar.vue 必须包含 @keyframes cs-status-pulse
  if (!/@keyframes\s+cs-status-pulse\s*\{/.test(content)) {
    fail(
      'chatheaderbar.vue 缺失 @keyframes cs-status-pulse。scoped keyframe 不会跨组件共享, 必须随使用方迁到子组件。'
    )
  }
}

// 3) _customer-service-theme.scss 不再包含这 5 个选择器
if (!fs.existsSync(CUSTOMER_SERVICE_THEME_SCSS)) {
  fail(`_customer-service-theme.scss 不存在: ${CUSTOMER_SERVICE_THEME_SCSS}`)
} else {
  const content = fs.readFileSync(CUSTOMER_SERVICE_THEME_SCSS, 'utf8')
  for (const sel of [
    '.cs-status-wrap',
    '.cs-status-indicator',
    '.cs-status-dot',
    '.cs-status-ring',
    '.cs-status-text',
  ]) {
    const re = new RegExp(`^\\s*\\${sel}\\s*\\{`, 'm')
    if (re.test(content)) {
      fail(
        `_customer-service-theme.scss 重新包含 ${sel} 块。已迁回 chatheaderbar.vue, 不要回退。`
      )
    }
  }

  // 4) _customer-service-theme.scss 不再包含 @keyframes cs-status-pulse
  if (/@keyframes\s+cs-status-pulse\s*\{/.test(content)) {
    fail(
      '_customer-service-theme.scss 重新包含 @keyframes cs-status-pulse。已迁回 chatheaderbar.vue, 不要回退。'
    )
  }
}

// 5) AIChat.vue 仍 @use customer-service-theme
if (!fs.existsSync(AICHAT_VUE)) {
  fail(`AIChat.vue 不存在: ${AICHAT_VUE}`)
} else {
  const content = fs.readFileSync(AICHAT_VUE, 'utf8')
  if (!/@use\s+['"]@\/styles\/ai-chat\/customer-service-theme['"]/.test(content)) {
    fail(
      'AIChat.vue 缺失 @use customer-service-theme。本批次仅删 cs-status-* 5 块, FAQ/console 块仍需保留, 删 @use 会导致这些块失效。'
    )
  }
}

if (hasError) {
  console.error('\n[FAIL] 客服主题 .cs-status-* 样式迁回 chatheaderbar.vue 守门失败')
  console.error('  历史教训: 2026-07-03 发现 _header.scss 父 @use partial 与子组件 scoped 块不匹配')
  console.error('  修复参考: AGENTS.md "Vue scoped + @use partial 规范" 章节')
  process.exit(1)
}

console.log('[OK] 客服主题 .cs-status-* 样式迁回 chatheaderbar.vue 守门通过')
process.exit(0)
