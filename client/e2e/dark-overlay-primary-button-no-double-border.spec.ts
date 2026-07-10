/**
 * 暗色浮层内 primary 按钮无双层蓝边源码级守门 (2026-07-04 源头改造)
 *
 * 背景 (2026-07-03): _element-plus-overrides.scss 的 html.dark :where(.el-button--primary) 规则
 * 给所有暗色 primary 按钮加了 border-width: 2px + box-shadow: inset 1px 白环,
 * 在浮层 (#1a1a1a 底色) 内形成"双层蓝边 + 中间白线"视觉 bug。
 *
 * 旧修法 (2026-07-03): 浮层作用域内 border-width: 0 + box-shadow: none 重置
 *   - 依赖选择器顺序, 脆弱
 *   - 未来新增浮层组件容易漏
 *
 * 新修法 (2026-07-04): 用 :not(:where(.el-xxx) *) 在源头主动排除 8 类浮层
 *   :where(.el-button--primary):not(
 *     :where(.el-message-box, .el-notification, .el-dialog, .el-message,
 *            .el-popper, .el-dropdown-menu, .el-tooltip, .el-popover) *
 *   ) { ... 含 inset 白环 ... }
 *
 *   浮层内基础样式 (无白环) 单独块:
 *   :where(.el-message-box, .el-notification, ...) :where(.el-button--primary) { ... }
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

test.describe('暗色浮层内 primary 按钮无双层蓝边源码级守门 (2026-07-04 源头改造版)', () => {
  test('1/5 主规则必须用 :not(:where(.el-xxx) *) 主动排除 8 类浮层', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    expect(
      scss,
      '_element-plus-overrides.scss 主规则必须用 :not(:where(.el-xxx) *) 主动排除 8 类浮层容器',
    ).toMatch(
      /:where\(\.el-button--primary\):not\(:where\(\.el-message-box,\s*\.el-notification,\s*\.el-dialog,\s*\.el-message,\s*\.el-popper,\s*\.el-dropdown-menu,\s*\.el-tooltip,\s*\.el-popover\)\s*\*\)/,
    )
  })

  test('2/5 主规则块内必须含 inset 白环 (供 sidebar darkSurface 使用)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    const mainBlock = scss.match(
      /:where\(\.el-button--primary\):not\(:where\([^)]*\)\s*\*\)\s*\{([\s\S]*?)\n\}/,
    )
    expect(mainBlock, '主规则块不存在').not.toBeNull()
    expect(
      mainBlock![1],
      '主规则块内必须含 inset 1px 半透明白环 box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18) (sidebar darkSurface 上 CTA 蓝边界补强)',
    ).toMatch(/box-shadow:\s*inset\s+0\s+0\s+0\s+1px\s+rgb\(\s*255\s+255\s+255\s*\/\s*0?\.18\s*\)/)
  })

  test('3/5 浮层内基础样式块必须保留 (无 inset 白环)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    const overlayBlock = scss.match(
      /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{([\s\S]*?)\n\}/,
    )
    expect(
      overlayBlock,
      '浮层内 primary 基础样式块不存在 (:where(.el-message-box, .el-notification, ...) :where(.el-button--primary) { ... })',
    ).not.toBeNull()
    expect(
      overlayBlock![1],
      '浮层内基础样式块必须含 background-color: var(--el-color-primary) (蓝底)',
    ).toMatch(/background-color:\s*var\(--el-color-primary\)/)
    expect(
      overlayBlock![1],
      '浮层内基础样式块必须含 color: var(--app-button-text-on-primary) (永定白字)',
    ).toMatch(/color:\s*var\(--app-button-text-on-primary\)/)
    expect(
      overlayBlock![1],
      '浮层内基础样式块不能含 inset 白环 (rgb(255 255 255 / 0.18)) - 浮层底色 #1a1a1a 上白字蓝底已 4.5:1 对比度, 不需要白环',
    ).not.toMatch(/rgb\(\s*255\s+255\s+255\s*\/\s*0?\.18\s*\)/)
  })

  test('4/5 旧"先加后减"双层结构不能复活 (box-shadow: none + border-width: 0 重置块)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    // 旧版: 浮层作用域内 border-width: 0 + box-shadow: none 重置
    const oldReset = scss.match(
      /:where\([^)]*\.el-message-box[^)]*\)\s*:where\(\.el-button--primary\)\s*\{[^}]*box-shadow:\s*none[^}]*border-width:\s*0/s,
    )
    expect(
      oldReset,
      '检测到旧版"先加后减"双层结构 (浮层作用域内 border-width: 0 + box-shadow: none 重置). 2026-07-04 源头改造后, :not() 已主动排除浮层, 不需要重置块',
    ).toBeNull()
  })

  test('5/5 主规则必须在 html.dark 块内 (不能放到全局, 否则浅色模式也会被错误排除)', () => {
    const scss = readFileSync(OVERRIDES_STYLE, 'utf-8')
    const notIndex = scss.indexOf(':where(.el-button--primary):not(')
    expect(notIndex, '_element-plus-overrides.scss 缺少 :not() 排除规则').toBeGreaterThan(0)
    const beforeNot = scss.slice(0, notIndex)
    expect(
      beforeNot.includes('html.dark'),
      ':not() 排除规则必须在 html.dark { ... } 块内 (亮色模式不需要排除, 让 vendor 默认白环生效)',
    ).toBe(true)
  })
})
