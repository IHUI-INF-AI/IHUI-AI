#!/usr/bin/env node
/**
 * 暗色浮层内 primary 按钮双层蓝边 + 中间白线视觉 bug 轻量级守门 (pre-commit)
 *
 * 目的: 防止 _element-plus-overrides.scss 中的"暗色 primary inset 白环规则"
 *       把 inset 1px 半透明白环应用到浮层内 (ElMessageBox/ElNotification/...)
 *       2026-07-03 用户反馈暗色通知内 primary 按钮出现"双层蓝边 + 中间白线"
 *       2026-07-04 源头改造: 用 :not(:where(.el-xxx) *) 在源头排除浮层,
 *         旧"先加后减"双层结构 (浮层作用域内 border-width:0 + box-shadow:none 重置)
 *         已删除. 新守门检查:
 *           1. 主规则用 :not(:where(.el-xxx) *) 主动排除 8 类浮层容器
 *           2. 8 类浮层容器全部列出 (新增 el-tooltip, el-popover 防御)
 *           3. 浮层内主规则块不再含 inset 白环 (box-shadow 不含 rgb(255 255 255 / 0.18))
 *           4. 浮层作用域外保留 inset 白环 (sidebar darkSurface 需要)
 *
 * 与 e2e/dark-overlay-primary-button-no-double-border.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, <10ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-dark-overlay-primary-button-no-double-border.mjs          # 全量检查
 *   node scripts/check-dark-overlay-primary-button-no-double-border.mjs --staged # 仅当目标文件 staged 时才检查
 *
 * 退出码:
 *   0 - 通过
 *   1 - 缺少必要规则 (视为回归)
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientRoot = join(__dirname, '..')
const OVERRIDES_STYLE = join(clientRoot, 'src/styles/_element-plus-overrides.scss')

const onlyStaged = process.argv.includes('--staged')

if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: clientRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const targetRelative = 'src/styles/_element-plus-overrides.scss'
    if (!stagedFiles.includes(targetRelative)) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

if (!existsSync(OVERRIDES_STYLE)) {
  console.error(`[FAIL] 样式文件不存在: ${OVERRIDES_STYLE}`)
  process.exit(1)
}

const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')

const errors = []

// 检查 1: 主规则必须用 :not(:where(.el-xxx) *) 主动排除 8 类浮层容器
//   新结构: html.dark :where(.el-button--primary):not(:where(.el-message-box, .el-notification, ...) *) { ... }
//   旧结构 (2026-07-04 已废弃): 浮层作用域内 border-width: 0 + box-shadow: none 重置
const REQUIRED_OVERLAY_CLASSES = [
  '.el-message-box',
  '.el-notification',
  '.el-dialog',
  '.el-message',
  '.el-popper',
  '.el-dropdown-menu',
  '.el-tooltip',
  '.el-popover',
]

// 检查 1a: 主规则块必须用 :not(:where(... *) 语法
//   格式: html.dark { ... :where(.el-button--primary):not(:where(.el-xxx) *) { ... } }
//   html.dark 和 :where(.el-button--primary) 在不同行, 中间可能有多行
const mainRuleWithNot = scss.match(
  /html\.dark\s*\{[\s\S]*?:where\(\.el-button--primary\):not\(:where\([^)]*\)\s*\*\)/,
)
if (!mainRuleWithNot) {
  errors.push(
    '主规则 (html.dark :where(.el-button--primary)) 必须用 :not(:where(.el-xxx) *) 主动排除浮层容器 (2026-07-04 源头改造硬约束)',
  )
}

// 检查 1b: :not() 内的 8 类浮层容器必须全部列出
if (mainRuleWithNot) {
  for (const cls of REQUIRED_OVERLAY_CLASSES) {
    const re = new RegExp(`:not\\(:where\\([^)]*${cls.replace(/\./g, '\\.')}[^)]*\\)\\s*\\*\\)`)
    if (!re.test(scss)) {
      errors.push(
        `主规则 :not(:where(... *)) 内缺少 ${cls} (必须主动排除 8 类浮层: ElMessageBox/ElNotification/ElDialog/ElMessage/ElPopper/ElDropdown/ElTooltip/ElPopover)`,
      )
    }
  }
}

// 检查 2: 浮层内的 primary 按钮主规则块不能再含 inset 白环
//   找到 html.dark :where(.el-button--primary):not(...) { ... } 块, 检查不含 rgb(255 255 255 / 0.18)
//   这确保浮层内不应用白环
const mainRuleBlock = scss.match(
  /html\.dark\s*:where\(\.el-button--primary\):not\(:where\([^)]*\)\s*\*\)\s*\{([\s\S]*?)\n\}/,
)
if (mainRuleBlock) {
  const blockBody = mainRuleBlock[1]
  // 白环标志: rgb(255 255 255 / 0.18) 或 rgba(255,255,255,0.18)
  if (/rgb\(\s*255\s+255\s+255\s*\/\s*0?\.18\s*\)/.test(blockBody)) {
    errors.push(
      '主规则块 (含 :not() 排除浮层) 内不应该再含 inset 白环 rgb(255 255 255 / 0.18) - :not() 主动排除后, 浮层内按钮不会匹配本规则, 但块内白环会误导未来阅读者',
    )
  }
}

// 检查 3: 旧"先加后减"双层结构不能复活
//   旧版 (2026-07-03): 浮层作用域内 border-width: 0 + box-shadow: none 重置块
//   新版 (2026-07-04): 浮层内主规则根本不会匹配, 不需要重置
//   防止有人手动重新加回重置块, 与 :not() 冲突
const oldResetBlock = scss.match(
  /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{[^}]*box-shadow:\s*none[^}]*border-width:\s*0/s,
)
if (oldResetBlock) {
  errors.push(
    '检测到旧版"先加后减"双层结构 (浮层作用域内 border-width: 0 + box-shadow: none 重置). 2026-07-04 源头改造后, :not() 已主动排除浮层, 不需要重置块, 移除它',
  )
}

// 检查 4: 浮层内基础样式块必须保留 (颜色/文字, 不含 inset 白环)
//   新结构: html.dark { ... :where(.el-message-box, .el-notification, ...) :where(.el-button--primary) { ... } }
//   这是浮层内按钮的"基础色"块, 必须保留
const overlayBaseBlock = scss.match(
  /html\.dark\s*\{[\s\S]*?:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{([\s\S]*?)\n\}/,
)
if (!overlayBaseBlock) {
  errors.push(
    '缺少浮层内 primary 按钮基础样式块: html.dark :where(.el-message-box, .el-notification, ...) :where(.el-button--primary) { ... } (2026-07-04 源头改造后, 浮层内按钮需要单独基础色)',
  )
} else {
  const body = overlayBaseBlock[1]
  if (!/background-color\s*:\s*var\(--el-color-primary\)/.test(body)) {
    errors.push('浮层内 primary 基础样式块必须含 background-color: var(--el-color-primary)')
  }
  if (!/color\s*:\s*var\(--app-button-text-on-primary\)/.test(body)) {
    errors.push('浮层内 primary 基础样式块必须含 color: var(--app-button-text-on-primary) (永定白字)')
  }
  // 浮层内不能含 inset 白环
  if (/rgb\(\s*255\s+255\s+255\s*\/\s*0?\.18\s*\)/.test(body)) {
    errors.push('浮层内 primary 基础样式块不应该含 inset 白环 rgb(255 255 255 / 0.18)')
  }
}

if (errors.length > 0) {
  console.error('[FAIL] 暗色浮层 primary 按钮无双层蓝边守门失败:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  console.error('')
  console.error('修复: 在 _element-plus-overrides.scss 的 html.dark 块内, 主规则用 :not() 主动排除浮层:')
  console.error('  :where(.el-button--primary):not(:where(.el-message-box, .el-notification, .el-dialog, .el-message, .el-popper, .el-dropdown-menu, .el-tooltip, .el-popover) *) {')
  console.error('    background-color: var(--el-color-primary);')
  console.error('    color: var(--app-button-text-on-primary);')
  console.error('    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18);')
  console.error('  }')
  console.error('  // 浮层内基础样式块')
  console.error('  :where(.el-message-box, .el-notification, .el-dialog, .el-message, .el-popper, .el-dropdown-menu) :where(.el-button--primary) {')
  console.error('    background-color: var(--el-color-primary);')
  console.error('    color: var(--app-button-text-on-primary);')
  console.error('  }')
  console.error('参考: e2e/dark-overlay-primary-button-no-double-border.spec.ts')
  process.exit(1)
}

console.log('[OK] 暗色浮层 primary 按钮无双层蓝边守门通过 (:not() 源头排除 8 类浮层 + 浮层内基础样式块 + 无旧重置块)')
