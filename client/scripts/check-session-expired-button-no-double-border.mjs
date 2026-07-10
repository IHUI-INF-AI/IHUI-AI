#!/usr/bin/env node
/**
 * 会话过期通知内"重新登录"按钮双层蓝边 + 中间白线视觉 bug 轻量级守门 (pre-commit)
 *
 * 目的: 防止 _session-expired-notification.scss 的按钮重置规则被误删/重写
 *       2026-07-03 用户反馈暗色通知内 primary 按钮出现"双层蓝边 + 中间白线"视觉 bug
 *       Element Plus 暗色 .el-button--primary 默认有 2px 蓝边 + inset 1px 白环
 *       在 32px 蓝色按钮上叠加显示为视觉错误
 *       修法是在通知作用域内局部重置 border-width: 0 + box-shadow: none
 *
 * 与 e2e/session-expired-button-no-double-border.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, <10ms)
 *   - e2e 测试: 完整源码级 + 浏览器级断言 (CI 阶段)
 *   两者并存: pre-commit 拦截 + CI 兜底
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
const SESSION_EXPIRED_STYLE = join(clientRoot, 'src/styles/_session-expired-notification.scss')

const onlyStaged = process.argv.includes('--staged')

if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: clientRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const targetRelative = 'src/styles/_session-expired-notification.scss'
    if (!stagedFiles.includes(targetRelative)) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

if (!existsSync(SESSION_EXPIRED_STYLE)) {
  console.error(`[FAIL] 样式文件不存在: ${SESSION_EXPIRED_STYLE}`)
  process.exit(1)
}

const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')

const errors = []

// 检查 1: .el-button--primary 必须重置 border-width: 0
const block1Match = scss.match(/\.session-expired-notification[\s\S]*?\.el-button--primary\s*\{[^}]*border-width:\s*0/)
if (!block1Match) {
  errors.push('缺少 .session-expired-notification 作用域下 .el-button--primary { border-width: 0 } 重置 (Element Plus 暗色 primary 默认 2px 蓝边, 在通知内显示为外层蓝边)')
}

// 检查 2: .el-button--primary 必须重置 box-shadow: none
const block2Match = scss.match(/\.session-expired-notification[\s\S]*?\.el-button--primary\s*\{[^}]*box-shadow:\s*none/)
if (!block2Match) {
  errors.push('缺少 .session-expired-notification 作用域下 .el-button--primary { box-shadow: none } 重置 (Element Plus inset 1px 白环在 32px 蓝色按钮上显示为"中间白线")')
}

// 检查 3: hover/active/focus 状态也必须 box-shadow: none
const block3Match = scss.match(/&:hover[\s\S]*?&:active[\s\S]*?&:focus[\s\S]*?&:focus-visible\s*\{[\s\S]*?box-shadow:\s*none/)
if (!block3Match) {
  errors.push('缺少 :hover/:active/:focus/:focus-visible 状态 box-shadow: none 覆盖 (鼠标悬停时白环会重新出现)')
}

// 检查 4: 默认 el-button (取消按钮) 也必须重置 box-shadow: none
const block4Match = scss.match(/\.el-button:not\(\.el-button--primary\)\s*\{[^}]*box-shadow:\s*none/)
if (!block4Match) {
  errors.push('缺少 .el-button:not(.el-button--primary) { box-shadow: none } 重置 (取消按钮也会出现"白边"视觉问题)')
}

if (errors.length > 0) {
  console.error('[FAIL] 会话过期通知按钮双层蓝边守门失败:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  console.error('')
  console.error('修复: 在 .session-expired-notification 作用域下追加 .el-button--primary { border-width: 0; box-shadow: none; } 重置, 同时给 hover/active/focus 加 box-shadow: none, 默认 el-button 也加 box-shadow: none')
  console.error('参考: e2e/session-expired-button-no-double-border.spec.ts (5 用例源码级断言)')
  process.exit(1)
}

console.log('[OK] 会话过期通知按钮无双层蓝边守门通过 (border-width: 0 + box-shadow: none + 4 个状态覆盖)')
