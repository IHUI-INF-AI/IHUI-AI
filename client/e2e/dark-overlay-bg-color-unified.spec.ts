/**
 * 暗色浮层底色统一硬约束源码级守门 (2026-07-03 立)
 *
 * 配套 pre-commit 守门: scripts/check-dark-overlay-bg-color-unified.mjs
 *
 * 防回归目标: 防止 6 类浮层组件 (ElMessageBox / ElNotification / ElDialog /
 *   ElMessage / ElPopper / ElDropdown) 的 background-color 被误加 hardcode 颜色
 *   (如 #ffffff / white / black / rgb(...)), 导致暗色浮层底色偏离 #1a1a1a.
 *
 * 设计意图:
 *   - 浮层底色必须用 var(--el-bg-color) / var(--el-bg-color-overlay) 系列
 *   - 暗色模式下 --el-bg-color = --el-bg-color-overlay = --color-dark-bg-3 = #1a1a1a
 *   - 这是浮层内 primary 按钮对比度 4.5:1 的前提 (WCAG AA)
 *
 * 验证项 (纯源码级, 不需要浏览器):
 *   1) _element-plus-overrides.scss 中浮层组件 background-color 必须用 var(--el-bg-color*)
 *   2) _el-message-box.scss 中 .el-message-box background-color 必须用 var(--el-bg-color*)
 *   3) _el-message-global.scss 中 .el-message background-color 必须用 var(--el-bg-color*)
 *   4) _session-expired-notification.scss 中 .el-notification background 必须用 var(--el-bg-color*)
 *   5) 浮层组件规则块内禁止 hardcode 颜色 (#xxx / rgb / white / black 等)
 *
 * CI 入口: npx playwright test e2e/dark-overlay-bg-color-unified.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLIENT_ROOT = join(__dirname, '..')

// 浮层组件选择器清单 (6 类)
// 注: .el-popper 用 .el-popper.el-dropdown-menu__popper 子类, 因为 .el-popper.is-dark
//     是 Element Plus 设计的反差 tooltip (暗色下背景=浅色文字色), 不属于"浮层底色统一"范畴
const OVERLAY_SELECTORS = ['.el-message-box', '.el-notification', '.el-dialog', '.el-message', '.el-popper.el-dropdown-menu__popper', '.el-dropdown-menu']

// hardcode 颜色检测正则 (匹配 background / background-color 属性值)
// 允许 var(...) (含 fallback), 禁止 #xxx / rgb(...) / rgba(...) / white / black 等
const HARDCODE_COLOR_RE = /(?:background|background-color)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgb[a]?\s*\(|\bwhite\b|\bblack\b|\bred\b|\bgreen\b|\bblue\b|\byellow\b|\borange\b|\bgray\b|\bgrey\b)/i

/**
 * 在 scss 文本中找到 selector 出现的所有位置, 返回每个位置后紧邻的规则块内容.
 * 支持 :where() 包裹, 支持逗号分隔的多选择器.
 * 简化做法: 取后 1500 字符, 用括号深度找匹配的右大括号.
 */
function findRuleBlocks(scss: string, selector: string): string[] {
  const selEscaped = selector.replace(/\./g, '\\.')
  const re = new RegExp(`(:where\\(\\s*)?${selEscaped}(\\s*,\\s*[.a-zA-Z-]+)*\\s*\\)?\\s*\\{`, 'g')
  const blocks: string[] = []
  let match
  while ((match = re.exec(scss)) !== null) {
    const startIdx = match.index + match[0].length
    const ctx = scss.slice(startIdx, startIdx + 1500)
    let depth = 1
    let blockEnd = -1
    for (let i = 0; i < ctx.length; i++) {
      if (ctx[i] === '{') depth++
      else if (ctx[i] === '}') {
        depth--
        if (depth === 0) {
          blockEnd = i
          break
        }
      }
    }
    if (blockEnd !== -1) {
      blocks.push(ctx.slice(0, blockEnd))
    }
  }
  return blocks
}

/**
 * 2026-07-04 新增: 从规则块中提取 immediate 内容 (depth 1 区间), 跳过嵌套块.
 * 用于排除 .el-message-box--error 等错误态嵌套块中的 hardcode 颜色误报.
 * immediate 内容 = outer { 之后到第一个内嵌 { 之前的字符.
 */
function extractImmediateBlock(block: string): string {
  let out = ''
  for (let i = 0; i < block.length; i++) {
    if (block[i] === '{') break
    out += block[i]
  }
  return out
}

test.describe('暗色浮层底色统一硬约束源码级守门', () => {
  // ===================================================================
  // 1) _element-plus-overrides.scss 中浮层组件 background-color 必须用 var(--el-bg-color*)
  // ===================================================================
  test('1/5 _element-plus-overrides.scss: 浮层组件 background-color 必须用 var(--el-bg-color*)', () => {
    const filePath = join(CLIENT_ROOT, 'src/styles/_element-plus-overrides.scss')
    if (!existsSync(filePath)) {
      test.skip(true, `文件不存在: ${filePath}`)
      return
    }
    const scss = readFileSync(filePath, 'utf-8')

    // 4 类浮层组件在此文件有 background-color 规则 (.el-message-box / .el-message 在其他文件)
    // .el-popper 用 .el-popper.el-dropdown-menu__popper 子类 (避开 .is-dark tooltip 特殊场景)
    const selectorsToCheck = ['.el-notification', '.el-dialog', '.el-popper.el-dropdown-menu__popper', '.el-dropdown-menu']
    let checkedCount = 0
    for (const sel of selectorsToCheck) {
      const blocks = findRuleBlocks(scss, sel)
      for (const block of blocks) {
        // 仅检查含 background-color 的块
        if (/background-color\s*:/.test(block)) {
          checkedCount++
          // 必须用 var(--el-bg-color (允许 fallback: var(--el-bg-color-overlay, #1a1a1a))
          expect(
            /background-color\s*:\s*var\(--el-bg-color/.test(block),
            `${sel} 规则块内 background-color 必须用 var(--el-bg-color*) 系列变量\n` +
              `实际块内容:\n${block.slice(0, 200)}`,
          ).toBe(true)
        }
      }
    }
    // 至少检查到 1 个规则块 (否则说明 findRuleBlocks 失效)
    expect(checkedCount, '应至少检查到 1 个浮层组件的 background-color 规则块').toBeGreaterThan(0)
  })

  // ===================================================================
  // 2) _el-message-box.scss 中 .el-message-box background-color 必须用 var(--el-bg-color*)
  // ===================================================================
  test('2/5 _el-message-box.scss: .el-message-box background-color 必须用 var(--el-bg-color*)', () => {
    const filePath = join(CLIENT_ROOT, 'src/styles/_el-message-box.scss')
    if (!existsSync(filePath)) {
      test.skip(true, `文件不存在: ${filePath}`)
      return
    }
    const scss = readFileSync(filePath, 'utf-8')
    const blocks = findRuleBlocks(scss, '.el-message-box')
    let checkedCount = 0
    for (const block of blocks) {
      if (/background-color\s*:/.test(block)) {
        checkedCount++
        expect(
          /background-color\s*:\s*var\(--el-bg-color/.test(block),
          `.el-message-box 规则块内 background-color 必须用 var(--el-bg-color*)\n` +
            `实际块内容:\n${block.slice(0, 200)}`,
        ).toBe(true)
      }
    }
    expect(checkedCount, '应至少检查到 1 个 .el-message-box 的 background-color 规则块').toBeGreaterThan(0)
  })

  // ===================================================================
  // 3) _el-message-global.scss 中 .el-message background-color 必须用 var(--el-bg-color*)
  // ===================================================================
  test('3/5 _el-message-global.scss: .el-message background-color 必须用 var(--el-bg-color*)', () => {
    const filePath = join(CLIENT_ROOT, 'src/styles/_el-message-global.scss')
    if (!existsSync(filePath)) {
      test.skip(true, `文件不存在: ${filePath}`)
      return
    }
    const scss = readFileSync(filePath, 'utf-8')
    const blocks = findRuleBlocks(scss, '.el-message')
    let checkedCount = 0
    for (const block of blocks) {
      if (/background-color\s*:/.test(block)) {
        checkedCount++
        expect(
          /background-color\s*:\s*var\(--el-bg-color/.test(block),
          `.el-message 规则块内 background-color 必须用 var(--el-bg-color*)\n` +
            `实际块内容:\n${block.slice(0, 200)}`,
        ).toBe(true)
      }
    }
    // .el-message 在该文件可能无 background-color 规则 (取决于文件结构), 允许 0 个
    // 但只要检查到就必须用 var
    if (checkedCount === 0) {
      test.skip(true, '_el-message-global.scss 中无 .el-message 的 background-color 规则')
    }
  })

  // ===================================================================
  // 4) _session-expired-notification.scss 中 .el-notification background 必须用 var(--el-bg-color*)
  // ===================================================================
  test('4/5 _session-expired-notification.scss: .el-notification background 必须用 var(--el-bg-color*)', () => {
    const filePath = join(CLIENT_ROOT, 'src/styles/_session-expired-notification.scss')
    if (!existsSync(filePath)) {
      test.skip(true, `文件不存在: ${filePath}`)
      return
    }
    const scss = readFileSync(filePath, 'utf-8')
    // 该文件用 html.dark .session-expired-notification 作用域, 内部 background 用 var(--el-bg-color-overlay)
    // 检查全局 (不限定浮层组件选择器, 因 session-expired-notification 自身就是 ElNotification 的 customClass)
    // 仅检查 background 或 background-color 属性必须用 var(--el-bg-color*
    const matches = scss.match(/(?:background|background-color)\s*:\s*[^;]+;/g) || []
    let checkedCount = 0
    for (const m of matches) {
      // 排除 border-left-color (不是 background)
      if (/^(?:background|background-color)\s*:/.test(m)) {
        checkedCount++
        expect(
          /(?:background|background-color)\s*:\s*var\(--el-bg-color/.test(m),
          `_session-expired-notification.scss 中 background 属性必须用 var(--el-bg-color*)\n实际: ${m}`,
        ).toBe(true)
      }
    }
    expect(checkedCount, '应至少检查到 1 个 background 属性').toBeGreaterThan(0)
  })

  // ===================================================================
  // 5) 4 个文件 × 6 类浮层组件 immediate 规则块内禁止 hardcode 颜色
  //    2026-07-04 增强: 只检查 immediate block (跳过 .el-message-box--error 等嵌套块)
  // ===================================================================
  test('5/5 4 个文件 × 6 类浮层组件 immediate 规则块内禁止 hardcode 颜色', () => {
    const TARGET_FILES = [
      'src/styles/_element-plus-overrides.scss',
      'src/styles/_el-message-box.scss',
      'src/styles/_el-message-global.scss',
      'src/styles/_session-expired-notification.scss',
    ]
    const violations: string[] = []
    for (const relPath of TARGET_FILES) {
      const absPath = join(CLIENT_ROOT, relPath)
      if (!existsSync(absPath)) continue
      const scss = readFileSync(absPath, 'utf-8')
      for (const sel of OVERLAY_SELECTORS) {
        const blocks = findRuleBlocks(scss, sel)
        for (const block of blocks) {
          // 2026-07-04 修复: 只检查 immediate block, 跳过嵌套块
          const immediate = extractImmediateBlock(block)
          const m = immediate.match(HARDCODE_COLOR_RE)
          if (m) {
            violations.push(`${relPath} ${sel} immediate 规则块内含 hardcode 颜色: "${m[0]}"`)
          }
        }
      }
    }
    expect(
      violations,
      `浮层组件 immediate 规则块内发现 hardcode 颜色 (嵌套块如 .el-message-box--error 不在守门范围):\n` +
        `${violations.map((v) => '  - ' + v).join('\n')}\n` +
        `浮层主底色必须用 var(--el-bg-color) / var(--el-bg-color-overlay) (允许带 fallback)`,
    ).toHaveLength(0)
  })

  // ===================================================================
  // 6) 2026-07-04 增强: 验证嵌套块内的 hardcode 颜色不被误报
  //    例: .el-message-box--error { background-color: #281414 } 是错误态红调,
  //       不在浮层主底色统一守门范围
  // ===================================================================
  test('6/6 嵌套块 (如 .el-message-box--error 错误态) 不在守门范围, 允许 hardcode 颜色', () => {
    const filePath = join(CLIENT_ROOT, 'src/styles/_el-message-global.scss')
    if (!existsSync(filePath)) {
      test.skip(true, `文件不存在: ${filePath}`)
      return
    }
    const scss = readFileSync(filePath, 'utf-8')

    // 找到 :where(.el-message-box) 的 outer block
    const blocks = findRuleBlocks(scss, '.el-message-box')
    expect(blocks.length, '.el-message-box 应至少 1 个 outer block').toBeGreaterThan(0)

    let foundNestedErrorBlock = false
    for (const block of blocks) {
      // outer block 全文里应包含嵌套 .el-message-box--error 块
      if (block.includes('&.el-message-box--error') || block.includes('.el-message-box--error')) {
        foundNestedErrorBlock = true
        // 嵌套块内允许 hardcode #281414 (错误态红调)
        expect(
          /background-color\s*:\s*#281414/.test(block),
          'outer block 文本里嵌套的 .el-message-box--error 块应含 #281414 错误态红调',
        ).toBe(true)
        // 但 immediate content 不应含 hardcode
        const immediate = extractImmediateBlock(block)
        expect(
          HARDCODE_COLOR_RE.test(immediate),
          'immediate content (跳过嵌套块) 不应含 hardcode 颜色',
        ).toBe(false)
      }
    }
    expect(foundNestedErrorBlock, '应找到 .el-message-box--error 嵌套块').toBe(true)
  })
})
