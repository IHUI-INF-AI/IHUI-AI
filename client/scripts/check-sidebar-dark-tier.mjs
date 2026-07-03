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
 *   - e2e 测试: 完整源码级断言 (CI 阶段, 28 用例含 chromium + Mobile Chrome)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 触发范围 (staged 模式):
 *   - client/src/styles/_sidebar-layout.scss
 *   - client/src/components/SidebarChatHistory.vue
 *   - client/src/components/login/UniversalLogin.vue
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
  // _sidebar-layout.scss dark mode 4 条 token (v3 加深版)
  sidebarSurface: '#2a2d37',
  sidebarNewChat: '#1f2229',
  sidebarActive: '#0f1117',
  sidebarHover: '#000',
  // SidebarChatHistory.vue dark 容器背景
  chatHistoryDarkBg: '#42454f',
  // 全局 _theme-tokens 必须保持不变 (本批次仅 sidebar 局部加深)
  globalDarkSurface: '#6a6d77',
  // UniversalLogin.vue html.dark .submit-btn 文字色
  loginDarkText: '#1a1a1a',
  loginDarkTextHover: '#0a0a0a',
}

// 旧值检查已改为结构性 token-by-token, 见 checkSidebarLayoutScss() 第 3 段
// (因 v3 surface=#2a2d37 撞 v2 new-chat, 简单"不能含某 hex"会自相矛盾)

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

  // 3. 结构性反向断言: 按 token 名逐个验证当前值不是 v1/v2 旧值
  //    (不能用"dark 块内不能含某 hex"的简单判断, 因为 v3 surface=#2a2d37
  //    恰好等于 v2 new-chat, 简单包含判断会自相矛盾)
  const darkBlockMatch = src.match(/html\.dark\s*\{[^}]*--app-sidebar-color-surface:[^}]*\}/i)
  if (darkBlockMatch) {
    const darkBlock = darkBlockMatch[0]
    // 每个 token 历史上的旧值 (按 token 列出, 避免 v3 surface 与 v2 new-chat 撞值)
    const tokenHistory = {
      '--app-sidebar-color-surface': { old: ['#6a6d77', '#3a3d47'] }, // v1, v2
      '--app-sidebar-color-new-chat': { old: ['#5a5d67', '#2a2d37'] }, // v1, v2
      '--app-sidebar-color-active':   { old: ['#4f5259', '#1f2229'] }, // v1, v2
      '--app-sidebar-color-hover':    { old: [] }, // hover 从未改过
    }
    for (const [name, { old }] of Object.entries(tokenHistory)) {
      const m = darkBlock.match(new RegExp(`${name}:\\s*([#a-zA-Z0-9]+)`, 'i'))
      if (!m) continue
      const currentVal = m[1].toLowerCase()
      for (const oldVal of old) {
        if (currentVal === oldVal.toLowerCase()) {
          const line = findLineNumber(darkBlock, `${name}:`)
          const expectedNow = name === '--app-sidebar-color-surface'
            ? EXPECTED.sidebarSurface
            : name === '--app-sidebar-color-new-chat'
              ? EXPECTED.sidebarNewChat
              : name === '--app-sidebar-color-active'
                ? EXPECTED.sidebarActive
                : EXPECTED.sidebarHover
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} ${name} 当前值 ${currentVal} 等于历史旧值 ${oldVal}.\n` +
              `          该值已被 v3 升级, 改回旧值 = 回归.\n` +
              `          历史: v1 (${oldVal}) → v2 → v3 (${expectedNow})`
          )
        }
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

function checkUniversalLoginVue() {
  // UniversalLogin.vue 暗色模式登录按钮文字色必须为偏黑色 (#1a1a1a),
  // 替代 Element Plus 默认 --el-color-white (#ffffff). 用户反馈"应该偏黑色".
  const rel = 'client/src/components/login/UniversalLogin.vue'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  // 1. html.dark .submit-btn 块内必须显式 color: #1a1a1a
  const darkTextPattern = new RegExp(
    `html\\.dark[\\s\\S]*?\\.submit-btn\\s*\\{[\\s\\S]*?color:\\s*${EXPECTED.loginDarkText.replace('#', '\\#')}`,
    'i'
  )
  if (!darkTextPattern.test(src)) {
    const line = findLineNumber(src, 'html\\.dark[\\s\\S]*?\\.submit-btn')
    errors.push(
      `[REGRESSION] ${rel}:${line || '?'} html.dark .submit-btn 必须显式 color: ${EXPECTED.loginDarkText} (偏黑文字).\n` +
        `          原代码未设 color, fallback 到 Element Plus 默认 --el-color-white (#ffffff).\n` +
        `          在 #3b82f6 蓝底上用户反馈"应该偏黑色". 暗色模式用深色文字与项目设计语言一致.\n` +
        `          对比度 ${EXPECTED.loginDarkText} on #3b82f6 = 4.83:1 (WCAG AA 通过).`
    )
  }

  // 2. .submit-btn:hover 块内必须有 color: #0a0a0a (更深)
  const hoverTextPattern = new RegExp(
    `\\.submit-btn[\\s\\S]*?:hover[\\s\\S]*?color:\\s*${EXPECTED.loginDarkTextHover.replace('#', '\\#')}`,
    'i'
  )
  if (!hoverTextPattern.test(src)) {
    const line = findLineNumber(src, '\\.submit-btn[\\s\\S]*?:hover')
    errors.push(
      `[REGRESSION] ${rel}:${line || '?'} .submit-btn:hover 必须含 color: ${EXPECTED.loginDarkTextHover} (比默认更深, hover 反馈更强).`
    )
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
const checkLogin = !onlyStaged || shouldCheck('client/src/components/login/UniversalLogin.vue', stagedFiles)

if (checkSidebarLayout) checkSidebarLayoutScss()
if (checkChatHistory) checkSidebarChatHistoryVue()
if (checkGlobalTokens) checkGlobalThemeTokens()
if (checkLogin) checkUniversalLoginVue()

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
  console.error(`    4. UniversalLogin.vue:`)
  console.error(`       html.dark .submit-btn { color: ${EXPECTED.loginDarkText}; ... }`)
  console.error(`       .submit-btn:hover:not(.is-disabled) { color: ${EXPECTED.loginDarkTextHover}; ... }`)
  console.error(`\n  若确需改色, 同步更新:`)
  console.error(`    - e2e/sidebar-dark-color-tier.spec.ts 的 EXPECTED_DARK_TIER / EXPECTED_CHAT_HISTORY_DARK_BG / EXPECTED_LOGIN_DARK_TEXT`)
  console.error(`    - scripts/check-sidebar-dark-tier.mjs 的 EXPECTED 对象`)
  console.error(`    - project_memory.md 暗色 sidebar 色阶 + 登录按钮文字色记忆条目`)
  process.exit(1)
}

console.log(`✓ [check-sidebar-dark-tier] 通过 (sidebar dark tier = ${EXPECTED.sidebarSurface} / ${EXPECTED.sidebarNewChat} / ${EXPECTED.sidebarActive} / ${EXPECTED.sidebarHover}, chat-history = ${EXPECTED.chatHistoryDarkBg}, login dark text = ${EXPECTED.loginDarkText}, global darkSurface = ${EXPECTED.globalDarkSurface})`)
