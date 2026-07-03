#!/usr/bin/env node
/**
 * 暗色浮层内 primary 按钮双层蓝边 + 中间白线视觉 bug 轻量级守门 (pre-commit)
 *
 * 目的: 防止 _element-plus-overrides.scss 中的"浮层作用域排除规则"被误删/重写
 *       2026-07-03 用户反馈暗色通知内 primary 按钮出现"双层蓝边 + 中间白线"视觉 bug
 *       Element Plus 暗色 .el-button--primary 默认有 2px 蓝边 + inset 1px 白环
 *       在浮层 (ElMessageBox/ElNotification/ElDialog/ElMessage/ElPopper/ElDropdown)
 *       小尺寸蓝色按钮上叠加显示为视觉错误
 *       修法是浮层作用域内局部重置 border-width: 0 + box-shadow: none
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

// 检查 1: 必须含浮层作用域排除规则 (覆盖 6 类浮层组件)
//   选择器形如: :where(.el-message-box, .el-notification, .el-dialog, .el-message, .el-popper, .el-dropdown-menu) :where(.el-button--primary)
const REQUIRED_OVERLAY_CLASSES = [
  '.el-message-box',
  '.el-notification',
  '.el-dialog',
  '.el-message',
  '.el-popper',
  '.el-dropdown-menu',
]
for (const cls of REQUIRED_OVERLAY_CLASSES) {
  // 用宽松正则: 在 :where(...) 内某处出现 cls
  // 注: scss 选择器跨多行, 用 [\s\S]*? 匹配
  const re = new RegExp(
    `:where\\([^)]*${cls.replace(/\./g, '\\.')}[^)]*\\)\\s*:where\\(\\.el-button--primary\\)`,
  )
  if (!re.test(scss)) {
    errors.push(
      `缺少浮层作用域排除规则中的 ${cls} (浮层排除规则必须覆盖 6 类浮层组件: ElMessageBox/ElNotification/ElDialog/ElMessage/ElPopper/ElDropdown)`,
    )
  }
}

// 检查 2: 浮层排除规则必须重置 border-width: 0
//   通用做法: 找到浮层排除规则块, 在该块内检查
//   宽松匹配: ":where(.el-button--primary) {" 后跟 "border-width: 0" 在合理范围内
const blockBorderMatch = scss.match(
  /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{[^}]*border-width:\s*0/,
)
if (!blockBorderMatch) {
  errors.push('缺少浮层排除规则中 .el-button--primary { border-width: 0 } 重置 (Element Plus 暗色 primary 默认 2px 蓝边, 在浮层内显示为外层蓝边)')
}

// 检查 3: 浮层排除规则必须重置 box-shadow: none
const blockShadowMatch = scss.match(
  /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{[^}]*box-shadow:\s*none/,
)
if (!blockShadowMatch) {
  errors.push('缺少浮层排除规则中 .el-button--primary { box-shadow: none } 重置 (Element Plus inset 1px 白环在浮层小按钮上显示为"中间白线")')
}

// 检查 4: hover/active/focus/focus-visible 状态也必须 box-shadow: none
//   宽松匹配: 在浮层排除规则块内含 &:hover &:active &:focus &:focus-visible 的 box-shadow: none
const blockStatesMatch = scss.match(
  /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{[\s\S]*?&:hover[\s\S]*?&:active[\s\S]*?&:focus[\s\S]*?&:focus-visible\s*\{[\s\S]*?box-shadow:\s*none/,
)
if (!blockStatesMatch) {
  errors.push('缺少浮层排除规则中 :hover/:active/:focus/:focus-visible 状态 box-shadow: none 覆盖 (鼠标悬停时白环会重新出现)')
}

// 检查 5: 浮层排除规则必须在 html.dark 块内 (不能放到全局, 否则浅色模式也会被错误重置)
//   做法: 找到浮层排除规则的行号, 找到 html.dark { 的行号, 确认前者 > 后者
//   简化: 用 split('\n') 找行号
const lines = scss.split('\n')
let htmlDarkStart = -1
let overlayRuleStart = -1
for (let i = 0; i < lines.length; i++) {
  if (htmlDarkStart === -1 && /^html\.dark\s*\{/.test(lines[i].trim())) {
    htmlDarkStart = i
  }
  if (overlayRuleStart === -1 && /:where\(\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)/.test(lines[i])) {
    overlayRuleStart = i
  }
}
if (htmlDarkStart === -1) {
  errors.push('未找到 html.dark { 块起始 (浮层排除规则必须放在 html.dark 块内)')
} else if (overlayRuleStart === -1) {
  // 已在检查 1 报过, 此处不重复
} else if (overlayRuleStart < htmlDarkStart) {
  errors.push(`浮层排除规则位于 html.dark 块之外 (行 ${overlayRuleStart + 1} < html.dark 行 ${htmlDarkStart + 1}), 必须放在 html.dark 块内, 否则浅色模式也会被错误重置`)
}

if (errors.length > 0) {
  console.error('[FAIL] 暗色浮层 primary 按钮无双层蓝边守门失败:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  console.error('')
  console.error('修复: 在 _element-plus-overrides.scss 的 html.dark 块内, 全局 :where(.el-button--primary) 规则之后追加:')
  console.error('  :where(.el-message-box, .el-notification, .el-dialog, .el-message, .el-popper, .el-dropdown-menu) :where(.el-button--primary) {')
  console.error('    border-width: 0;')
  console.error('    box-shadow: none;')
  console.error('    &:hover, &:active, &:focus, &:focus-visible { box-shadow: none; }')
  console.error('  }')
  console.error('参考: e2e/dark-overlay-primary-button-no-double-border.spec.ts (4 用例源码级断言)')
  console.error('参考: e2e/dark-overlay-primary-button-no-double-border-visual.spec.ts (5 用例浏览器级断言)')
  process.exit(1)
}

console.log('[OK] 暗色浮层 primary 按钮无双层蓝边守门通过 (6 类浮层 + border-width: 0 + box-shadow: none + 4 状态 + html.dark 块内)')
