#!/usr/bin/env node
/**
 * 侧边栏暗色色阶防回归轻量级守门 (pre-commit 用, 2026-07-03 立)
 *
 * 目的: 防止有人把 _sidebar-layout.scss 的 dark sidebar 色阶改回偏浅的旧值
 *       (#6a6d77 / #5a5d67 / #4f5259), 或把 SidebarChatHistory.vue 的
 *       .chat-history-body fallback 改回 #ffffff (会触发暗色模式白色 bug).
 *       本脚本在 pre-commit 阶段跑 (< 100ms), 与 e2e 守门互补:
 *
 * 与 e2e/sidebar-dark-color-tier.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整源码级断言 (CI 阶段, 22 用例含 chromium + Mobile Chrome)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 触发范围 (staged 模式):
 *   - client/src/styles/_sidebar-layout.scss
 *   - client/src/components/SidebarChatHistory.vue
 *   - client/src/styles/_theme-tokens.ts (防止全局 darkSurface 被改)
 *   - client/src/styles/_theme-tokens.scss
 *
 * 用法:
 *   node scripts/check-sidebar-dark-tier.mjs          # 全量检查
 *   node scripts/check-sidebar-dark-tier.mjs --staged # 仅 staged 文件触发
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归 (含具体文件:行号)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _sidebar-layout.scss dark 覆盖块 + e2e spec 完全一致)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  // _sidebar-layout.scss dark mode 4 条 token
  sidebarSurface: '#3a3d47',
  sidebarNewChat: '#2a2d37',
  sidebarActive: '#1f2229',
  sidebarHover: '#000',
  // SidebarChatHistory.vue dark 容器背景
  chatHistoryDarkBg: '#42454f',
  // 全局 _theme-tokens 必须保持不变 (本批次仅 sidebar 局部加深)
  globalDarkSurface: '#6a6d77',
}

// 禁止在 _sidebar-layout.scss dark 覆盖块内出现的旧值
const FORBIDDEN_OLD_VALUES = ['#6a6d77', '#5a5d67', '#4f5259']

// ════════════════════════════════════════════════════════════════════════
// 工具
// ════════════════════════════════════════════════════════════════════════

function readFile(p) {
  return fs.readFileSync(p, 'utf-8')
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out.split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
  } catch {
    return null
  }
}

function shouldCheck(relPath, stagedFiles) {
  if (!stagedFiles) return true // git 不可用 → 全量
  return stagedFiles.some(f => f.endsWith(relPath))
}

function findLineNumber(content, pattern) {
  const lines = content.split('\n')
  const regex = new RegExp(pattern)
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1
  }
  return -1
}

// ════════════════════════════════════════════════════════════════════════
// 检查项
// ════════════════════════════════════════════════════════════════════════

const errors = []

function checkSidebarLayoutScss() {
  const rel = 'client/src/styles/_sidebar-layout.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  // 1. dark 覆盖块必须含 4 条 token (精确值匹配)
  const tokenChecks = [
    { name: '--app-sidebar-color-surface', value: EXPECTED.sidebarSurface },
    { name: '--app-sidebar-color-new-chat', value: EXPECTED.sidebarNewChat },
    { name: '--app-sidebar-color-active', value: EXPECTED.sidebarActive },
    { name: '--app-sidebar-color-hover', value: EXPECTED.sidebarHover },
  ]

  for (const { name, value } of tokenChecks) {
    // html.dark { ... --name: value; ... } (同一规则块内)
    const pattern = new RegExp(
      `html\\.dark\\s*\\{[^}]*${name}:\\s*${value.replace('#', '\\#')}[^}]*\\}`,
      'i'
    )
    if (!pattern.test(src)) {
      const line = findLineNumber(src, `${name}:`)
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} dark mode ${name} 必须为 ${value}.\n` +
          `          2026-07-03 用户反馈旧值偏浅, 已加深. 改回旧值 = 回归.`
      )
    }
  }

  // 2. 必须用 html.dark (0,0,1), 不能用 :where(html.dark) (0,0,0)
  const whereMatch = src.match(/:where\(html\.dark\)\s*\{[^}]*--app-sidebar-color-surface:/)
  if (whereMatch) {
    errors.push(
      `[REGRESSION] ${rel} 禁止用 :where(html.dark) 覆盖 --app-sidebar-color-surface.\n` +
        `          :where() 特异性 0,0,0 会被 :root (0,0,1) 击败导致暗色覆盖静默失效.\n` +
        `          必须用 html.dark (特异性 0,0,1).`
    )
  }

  // 3. dark 覆盖块内不能含旧值
  const darkBlockMatch = src.match(/html\.dark\s*\{[^}]*--app-sidebar-color-surface:[^}]*\}/i)
  if (darkBlockMatch) {
    const darkBlock = darkBlockMatch[0]
    for (const oldVal of FORBIDDEN_OLD_VALUES) {
      if (darkBlock.includes(oldVal)) {
        errors.push(
          `[REGRESSION] ${rel} dark 覆盖块内含旧值 ${oldVal}.\n` +
            `          2026-07-03 用户反馈旧值偏浅, 已改为更深的色阶. 改回旧值 = 回归.`
        )
      }
    }
  }
}

function checkSidebarChatHistoryVue() {
  const rel = 'client/src/components/SidebarChatHistory.vue'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  // 1. .chat-history-body fallback 必须为 transparent, 不能是 #ffffff
  const transparentPattern = /\.chat-history-body\s*\{[^}]*background-color:\s*var\(--chat-history-body-bg,\s*transparent\)/
  if (!transparentPattern.test(src)) {
    // 检查是否退回到了 #ffffff
    const whitePattern = /\.chat-history-body\s*\{[^}]*background-color:\s*var\(--chat-history-body-bg,\s*#ffffff\)/
    if (whitePattern.test(src)) {
      const line = findLineNumber(src, '--chat-history-body-bg')
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} .chat-history-body fallback 退回 #ffffff.\n` +
          `          #ffffff 在 dark mode 下因 --chat-history-body-bg 未定义而 fallback 到白色,\n` +
          `          导致对话历史容器在暗色模式下显示为刺眼白色 (2026-07-03 用户反馈 bug).\n` +
          `          必须改回 transparent.`
      )
    } else {
      const line = findLineNumber(src, '--chat-history-body-bg')
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} .chat-history-body 必须含 background-color: var(--chat-history-body-bg, transparent).\n` +
          `          当前值与期望不符, 检查是否被误改.`
      )
    }
  }

  // 2. 必须含 html.dark .sidebar-chat-history 深色背景覆盖
  const darkBgPattern = new RegExp(
    `html\\.dark\\s+\\.sidebar-chat-history\\s*\\{[^}]*background-color:\\s*${EXPECTED.chatHistoryDarkBg.replace('#', '\\#')}`,
    'i'
  )
  if (!darkBgPattern.test(src)) {
    const line = findLineNumber(src, 'html\\.dark\\s+\\.sidebar-chat-history')
    errors.push(
      `[REGRESSION] ${rel}:${line || '?'} 必须含 html.dark .sidebar-chat-history { background-color: ${EXPECTED.chatHistoryDarkBg} }.\n` +
        `          dark mode 对话历史容器比 sidebar surface 浅 8 单位, 形成"卡片浮起"层次.\n` +
        `          删除此覆盖会导致容器在 dark 下透明, 露出 sidebar surface 颜色, 失去层次感.`
    )
  }
}

function checkGlobalThemeTokens() {
  // _theme-tokens.ts 全局 darkSurface 必须保持 #6a6d77
  const tsRel = 'client/src/styles/_theme-tokens.ts'
  const tsAbs = path.join(projectRoot, tsRel)
  if (fs.existsSync(tsAbs)) {
    const src = readFile(tsAbs)
    const pattern = new RegExp(`darkSurface:\\s*['"]${EXPECTED.globalDarkSurface}['"]`, 'i')
    if (!pattern.test(src)) {
      const line = findLineNumber(src, 'darkSurface:')
      errors.push(
        `[REGRESSION] ${tsRel}:${line || '?'} 全局 darkSurface 必须保持 ${EXPECTED.globalDarkSurface}.\n` +
          `          本批次仅 sidebar 局部加深, 不动全局 token.\n` +
          `          改全局 darkSurface 会影响 CTA 按钮 (#2563eb) / ghost 文字 (#e5eaf3) / miniapp 按钮的对比度联调,\n` +
          `          需重跑 check:contrast + 更新 THEME_INVARIANTS.`
      )
    }
  }

  // _theme-tokens.scss 全局 $theme-dark-surface 必须保持 #6a6d77
  const scssRel = 'client/src/styles/_theme-tokens.scss'
  const scssAbs = path.join(projectRoot, scssRel)
  if (fs.existsSync(scssAbs)) {
    const src = readFile(scssAbs)
    const pattern = new RegExp(`\\$theme-dark-surface:\\s*${EXPECTED.globalDarkSurface.replace('#', '\\#')}`, 'i')
    if (!pattern.test(src)) {
      const line = findLineNumber(src, '\\$theme-dark-surface:')
      errors.push(
        `[REGRESSION] ${scssRel}:${line || '?'} 全局 $theme-dark-surface 必须保持 ${EXPECTED.globalDarkSurface}.\n` +
          `          与 _theme-tokens.ts 桥接一致, 不能单边修改.`
      )
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════

const stagedFiles = onlyStaged ? getStagedFiles() : null

if (onlyStaged && stagedFiles && stagedFiles.length === 0) {
  console.log('[check-sidebar-dark-tier] 无 staged 文件, 跳过')
  process.exit(0)
}

// staged 模式下, 只检查 staged 文件涉及的范围; 否则全量检查
const checkSidebarLayout = !onlyStaged || shouldCheck('client/src/styles/_sidebar-layout.scss', stagedFiles)
const checkChatHistory = !onlyStaged || shouldCheck('client/src/components/SidebarChatHistory.vue', stagedFiles)
const checkGlobalTokens = !onlyStaged ||
  shouldCheck('client/src/styles/_theme-tokens.ts', stagedFiles) ||
  shouldCheck('client/src/styles/_theme-tokens.scss', stagedFiles)

if (checkSidebarLayout) checkSidebarLayoutScss()
if (checkChatHistory) checkSidebarChatHistoryVue()
if (checkGlobalTokens) checkGlobalThemeTokens()

if (errors.length > 0) {
  console.error(`\n❌ [check-sidebar-dark-tier] 发现 ${errors.length} 处回归:`)
  for (const e of errors) {
    console.error(`\n  ${e}`)
  }
  console.error(`\n  修复指南:`)
  console.error(`    1. _sidebar-layout.scss dark 覆盖块必须含 4 条 token:`)
  console.error(`       --app-sidebar-color-surface: ${EXPECTED.sidebarSurface}`)
  console.error(`       --app-sidebar-color-new-chat: ${EXPECTED.sidebarNewChat}`)
  console.error(`       --app-sidebar-color-active:  ${EXPECTED.sidebarActive}`)
  console.error(`       --app-sidebar-color-hover:   ${EXPECTED.sidebarHover}`)
  console.error(`    2. SidebarChatHistory.vue:`)
  console.error(`       .chat-history-body { background-color: var(--chat-history-body-bg, transparent) }`)
  console.error(`       html.dark .sidebar-chat-history { background-color: ${EXPECTED.chatHistoryDarkBg} }`)
  console.error(`    3. _theme-tokens.ts/.scss 全局 darkSurface 必须保持 ${EXPECTED.globalDarkSurface}`)
  console.error(`\n  若确需改色, 同步更新:`)
  console.error(`    - e2e/sidebar-dark-color-tier.spec.ts 的 EXPECTED_DARK_TIER / EXPECTED_CHAT_HISTORY_DARK_BG`)
  console.error(`    - scripts/check-sidebar-dark-tier.mjs 的 EXPECTED 对象`)
  console.error(`    - project_memory.md 暗色 sidebar 色阶记忆条目`)
  process.exit(1)
}

console.log(`✓ [check-sidebar-dark-tier] 通过 (sidebar dark tier = ${EXPECTED.sidebarSurface} / ${EXPECTED.sidebarNewChat} / ${EXPECTED.sidebarActive} / ${EXPECTED.sidebarHover}, chat-history = ${EXPECTED.chatHistoryDarkBg}, global darkSurface = ${EXPECTED.globalDarkSurface})`)
