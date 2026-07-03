/**
 * 暗色浮层内 primary 按钮无双层蓝边源码级守门 (2026-07-03 立)
 *
 * 背景: _element-plus-overrides.scss 的 html.dark :where(.el-button--primary) 规则
 * 给所有暗色 primary 按钮加了 border-width: 2px + box-shadow: inset 1px 白环,
 * 在浮层 (#1a1a1a 底色) 内形成"双层蓝边 + 中间白线"视觉 bug。
 *
 * 修法: 在 html.dark 块内、全局 primary 按钮规则之后, 加浮层作用域排除规则:
 *   :where(.el-message-box, .el-notification, .el-dialog, .el-message,
 *          .el-popper, .el-dropdown-menu) :where(.el-button--primary) {
 *     border-width: 0; box-shadow: none;
 *     &:hover, &:active, &:focus, &:focus-visible { box-shadow: none; }
 *   }
 *
 * 覆盖组件: ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown
 * 不影响: sidebar 等非浮层位置的 CTA 按钮 (仍保留 inset 白环补强边界)
 *
 * 配套浏览器级 spec: dark-overlay-primary-button-no-double-border-visual.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const OVERRIDES_STYLE = join(ROOT, 'src/styles/_element-plus-overrides.scss')

test.describe('暗色浮层内 primary 按钮无双层蓝边源码级守门', () => {
  test('1/4 必须含浮层作用域排除规则 (覆盖 6 类浮层组件)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    expect(
      scss,
      '_element-plus-overrides.scss 缺少浮层作用域排除规则 (ElMessageBox/ElNotification/ElDialog/ElMessage/ElPopper/ElDropdown 内的 primary 按钮会有双层蓝边 + 中间白线视觉 bug)',
    ).toMatch(/\.el-message-box[\s\S]*?\.el-notification[\s\S]*?\.el-dialog[\s\S]*?\.el-message[\s\S]*?\.el-popper[\s\S]*?\.el-dropdown-menu[\s\S]*?:where\(\.el-button--primary\)/)
  })

  test('2/4 浮层排除规则必须重置 border-width: 0', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    // 在浮层排除规则块内必须有 border-width: 0
    const overlayBlockMatch = scss.match(
      /\.el-message-box[\s\S]*?:where\(\.el-button--primary\)\s*\{([^}]*)\}/,
    )
    expect(
      overlayBlockMatch,
      '_element-plus-overrides.scss 浮层排除规则块不存在',
    ).not.toBeNull()
    expect(
      overlayBlockMatch![1],
      '浮层排除规则块内缺少 border-width: 0 (Element Plus 暗色 primary 默认 2px 蓝边)',
    ).toMatch(/border-width:\s*0/)
  })

  test('3/4 浮层排除规则必须重置 box-shadow: none', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    const overlayBlockMatch = scss.match(
      /\.el-message-box[\s\S]*?:where\(\.el-button--primary\)\s*\{([^}]*)\}/,
    )
    expect(
      overlayBlockMatch,
      '_element-plus-overrides.scss 浮层排除规则块不存在',
    ).not.toBeNull()
    expect(
      overlayBlockMatch![1],
      '浮层排除规则块内缺少 box-shadow: none (Element Plus inset 1px 白环形成中间白线)',
    ).toMatch(/box-shadow:\s*none/)
  })

  test('4/4 浮层排除规则必须在 html.dark 块内 (不能放到全局)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    // 确认浮层排除规则在 html.dark { ... } 块内
    // 通过检查浮层排除规则之前有 html.dark 开头
    const overlayIndex = scss.indexOf('.el-message-box')
    expect(overlayIndex, '_element-plus-overrides.scss 缺少 .el-message-box 浮层排除规则').toBeGreaterThan(0)
    const beforeOverlay = scss.slice(0, overlayIndex)
    expect(
      beforeOverlay.includes('html.dark'),
      '浮层排除规则必须在 html.dark { } 块内 (暗色模式才需要移除 inset 白环, 亮色模式不受影响)',
    ).toBe(true)
  })
})
