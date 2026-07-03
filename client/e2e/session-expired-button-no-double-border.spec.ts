/**
 * 会话过期通知内"重新登录/取消"按钮双层蓝边 + 中间白线视觉 bug 防回归 (2026-07-03 立)
 *
 * 背景: Element Plus 暗色 .el-button--primary 默认有:
 *   - border-width: var(--el-border-width-primary)  // = 2px
 *   - border-color: var(--el-color-primary)         // 暗色下 #409eff 蓝
 *   - box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18)
 * 设计意图: 补强 #2563eb CTA 蓝在 #6a6d77 darkSurface 上的边界 (1.001:1 → 3:1+)
 *
 * Bug: ElNotification 背景 = --el-bg-color-overlay = #1a1a1a (比 #6a6d77 深 64 单位),
 *      #409eff 蓝 on #1a1a1a 对比度 4.5:1 (WCAG AA 已通过), inset 白环不再需要.
 *      反而在小尺寸 (32px) 蓝色按钮上, 2px 蓝边 + inset 1px 白环 = "双层蓝边夹白线" 视觉 bug.
 *
 * 修法 (_session-expired-notification.scss .el-button--primary 局部重置):
 *   - border-width: 0     (移除 2px 蓝边, 蓝色背景已提供视觉边界)
 *   - box-shadow: none    (移除 inset 白环, 通知背景对比度足够)
 *   - hover/active/focus 也保持 none (避免状态切换时白环又出现)
 *
 * 本 spec 在源码级别保证:
 *   - _session-expired-notification.scss 必须重置 .el-button--primary 的 border-width: 0
 *   - 必须重置 box-shadow: none
 *   - 默认 el-button (取消按钮) 也必须重置 box-shadow: none
 *   - hover/active/focus 状态也必须 box-shadow: none
 *   - 重置规则必须在 .session-expired-notification 作用域内 (不污染全局)
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const SESSION_EXPIRED_STYLE = join(ROOT, 'src/styles/_session-expired-notification.scss')

test.describe('会话过期通知按钮双层蓝边 + 中间白线视觉 bug 源码级防回归', () => {
  test('1/5 .el-button--primary 必须重置 border-width: 0', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    expect(
      scss,
      '_session-expired-notification.scss 缺少 .el-button--primary { border-width: 0 } 重置 (Element Plus 暗色 primary 默认 2px 蓝边, 在通知内显示为外层蓝边)',
    ).toMatch(/\.el-button--primary\s*\{[^}]*border-width:\s*0/)
  })

  test('2/5 .el-button--primary 必须重置 box-shadow: none', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    expect(
      scss,
      '_session-expired-notification.scss 缺少 .el-button--primary { box-shadow: none } 重置 (Element Plus inset 1px 白环在 32px 蓝色按钮上显示为"中间白线")',
    ).toMatch(/\.el-button--primary\s*\{[^}]*box-shadow:\s*none/)
  })

  test('3/5 hover/active/focus 状态也必须 box-shadow: none', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    expect(
      scss,
      '_session-expired-notification.scss 缺少 :hover/:active/:focus/:focus-visible 状态覆盖 (鼠标悬停时白环会重新出现)',
    ).toMatch(/&:hover[\s\S]*?&:active[\s\S]*?&:focus[\s\S]*?&:focus-visible\s*\{[\s\S]*?box-shadow:\s*none/)
  })

  test('4/5 默认 el-button (取消按钮) 也必须重置 box-shadow: none', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    expect(
      scss,
      '_session-expired-notification.scss 缺少 .el-button:not(.el-button--primary) { box-shadow: none } 重置 (取消按钮也会出现"白边"视觉问题)',
    ).toMatch(/\.el-button:not\(\.el-button--primary\)\s*\{[^}]*box-shadow:\s*none/)
  })

  test('5/5 重置规则必须在 .session-expired-notification 作用域内 (不污染全局)', () => {
    const scss = readFileSync(SESSION_EXPIRED_STYLE, 'utf-8')
    const blockMatch = scss.match(/\.session-expired-notification[\s\S]*?\.el-button--primary\s*\{[^}]*box-shadow:\s*none/)
    expect(
      blockMatch,
      '_session-expired-notification.scss 的 .el-button--primary 重置必须在 .session-expired-notification 作用域内 (不能放到全局, 否则会影响 sidebar 等其他位置的 CTA 按钮)',
    ).not.toBeNull()
  })
})
