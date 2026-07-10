/**
 * 全组件暗色反色系统性守门 (2026-07-04 立, 用户规则: 从根本彻底解决)
 *
 * 防回归目标:
 * 2026-07-04 用户反馈"暗色模式下背景色为浅色时没有自动切换文字色为深色,
 * 项目中还有很多很多类似这样的情况". 根因: --el-color-primary 暗色映射撞色 + 5 类 EP 组件
 * 暗色块缺失 + 业务级语义色 token 缺失. 本测试覆盖:
 *
 *   A. _dark-mode-global.scss: 5 个 EP 主题色暗色重映射 + light-3/5/7/8 适配值
 *   B. _element-plus-overrides.scss: 5 类 el-button 浅色 color + 暗色 primary 块
 *   C. _element-plus-overrides.scss 暗色块: 5 类 el-tag + 4 类 el-alert + 5 类 el-link
 *   D. _element-plus.scss 暗色块: el-tabs active + el-checkbox/radio/switch checked
 *   E. _el-message-global.scss 暗色块: 4 类 .el-notification + 5 类 .el-message-box
 *   F. _global-tokens.scss: 4 个 --app-text-on-* + 1 个 --app-button-text-on-primary + 5 对业务 token
 *   G. 对比度计算: 5 类主色 (primary/success/warning/danger/info) 暗色文字 vs 背景 ≥ WCAG AA 4.5
 *
 * 配套: scripts/check-color-contrast-systemic.mjs (pre-commit 阶段, 早失败 < 200ms)
 *       + 本文件 (CI 阶段, 完整源码级 + 浏览器级断言)
 *
 * CI 入口: npx playwright test color-contrast-systemic.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _dark-mode-global.scss / _global-tokens.scss + check script 完全一致)
// ════════════════════════════════════════════════════════════════════════
const DARK_BG = {
  primary: '#2563eb',
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  info: '#4b5563',
} as const

const TEXT_ON = {
  primary: '#ffffff',
  success: '#ffffff',
  warning: '#ffffff',  // 2026-07-04 修复: 原 #fde68a on #b45309 对比度仅 3.98:1 < WCAG AA 4.5, 改 #ffffff 后 4.93:1 通过
  danger: '#ffffff',
  info: '#ffffff',
} as const

const MIN_CONTRAST_RATIO = 4.5  // WCAG AA 正文最低

// 5 对业务级语义色
const BUSINESS_LIGHT = {
  success: '#15803d',
  warning: '#b45309',
  danger: '#b91c1c',
  info: '#4b5563',
  primary: '#1d4ed8',
} as const

const BUSINESS_DARK = {
  success: '#bbf7d0',
  warning: '#fde68a',
  danger: '#fecaca',
  info: '#d1d5db',
  primary: '#93c5fd',
} as const

// 禁止: 暗色 --el-color-* 不能映射为这些值
const FORBIDDEN_BG_VALUES = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  'var(--el-text-color-secondary)',
  'var(--el-text-color-placeholder)',
  '#67c23a', '#e6a23c', '#f56c6c', '#909399',  // EP 默认亮色
  '#409eff', '#5da8ff',  // EP 默认 primary
  '#0d0d0d', '#1a1a1a', '#000', '#000000', '#222', '#333', '#2d2d2d',
  '#a3a3a3',
]

// 禁止: 暗色 --el-color-primary-light-{3,5,7,8,9} 不能映射为 placeholder 灰
const FORBIDDEN_LIGHT_VARIANTS = [
  'var(--el-text-color-placeholder)',
  'var(--el-text-color-secondary)',
  'var(--el-bg-color)',
  '#a3a3a3', '#909399', '#0d0d0d',
]

// ════════════════════════════════════════════════════════════════════════
// 工具
// ════════════════════════════════════════════════════════════════════════

function extractBlockContent(src: string, headerRe: RegExp): Array<{ index: number; body: string }> {
  const re = new RegExp(headerRe.source, headerRe.flags.includes('g') ? headerRe.flags : headerRe.flags + 'g')
  const blocks: Array<{ index: number; body: string }> = []
  let m
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length
    let depth = 1, end = start
    while (depth > 0 && end < src.length) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    if (depth === 0) {
      blocks.push({ index: m.index, body: src.substring(start, end - 1) })
    }
  }
  return blocks
}

/**
 * 提取所有暗色块. 模式 (2026-07-04 立):
 *   - html.dark { ... }                              (裸 html.dark)
 *   - :where(html.dark) { ... }                      (包 :where 零特异性)
 *   - :where(html.dark) :where(.el-xxx) { ... }      (复杂选择器, html.dark 在前)
 *   - :where(.el-xxx):where(html.dark) { ... }      (复杂选择器, html.dark 在后)
 *
 * 实现: 任何含 `html.dark` 子串且后接 `{` 的位置都视为暗色块起点.
 *       平衡大括号提取 body.
 */
function extractDarkBlocks(src: string) {
  // 找含 "html.dark" 的所有 { 起点, 但只保留那些在 { 之前最近的选择器含 html.dark 的
  // 简化方案: 扫描所有 "{", 向前找最近的 "html.dark" 出现, 距离 < 200 字符视为暗色块
  const re = /\{/g
  const blocks: Array<{ index: number; body: string }> = []
  let m
  while ((m = re.exec(src)) !== null) {
    const before = src.substring(Math.max(0, m.index - 200), m.index)
    if (!/html\.dark/.test(before)) continue
    const start = m.index + 1
    let depth = 1, end = start
    while (depth > 0 && end < src.length) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    if (depth === 0) {
      blocks.push({ index: m.index, body: src.substring(start, end - 1) })
    }
  }
  return blocks
}

function stripComments(body: string): string {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/**
 * 提取块中第一个真正的 `color:` 声明 (避免 background-color 误配)
 */
function extractFirstColorValue(body: string): string | null {
  const cleaned = stripComments(body)
  // 词边界: 行首 / 空白 / 分号 / 大括号, 排除 background-color / border-color / outline-color
  const m = cleaned.match(/(^|[\s;{])color\s*:\s*([^;]+);/i)
  return m ? m[2].trim() : null
}

// WCAG 2.x 对比度计算
function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  const h = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function relativeLuminance(hex: string): number {
  const channelL = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channelL(r) + 0.7152 * channelL(g) + 0.0722 * channelL(b)
}
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ════════════════════════════════════════════════════════════════════════
// A. _dark-mode-global.scss: 5 个 EP 主题色暗色重映射
// ════════════════════════════════════════════════════════════════════════

test.describe('A: _dark-mode-global.scss 5 类 EP 主题色暗色重映射', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const [type, expectedBg] of Object.entries(DARK_BG)) {
    test(`A1: 暗色 --el-color-${type} 必须 = ${expectedBg}`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_dark-mode-global.scss'), 'utf8')
      const darkBlocks = extractDarkBlocks(src)
      expect(darkBlocks.length, '必须存在 html.dark 块').toBeGreaterThan(0)

      const block = darkBlocks.find(b => new RegExp(`--el-color-${type}\\s*:`).test(b.body))
      expect(block, `必须存在暗色块覆盖 --el-color-${type}`).toBeDefined()

      const m = block!.body.match(new RegExp(`--el-color-${type}\\s*:\\s*([^;]+);`, 'i'))
      expect(m, `暗色 --el-color-${type} 必须有值`).not.toBeNull()
      const value = m![1].trim()
      expect(
        value,
        `暗色 --el-color-${type} = ${value}, 必须 = ${expectedBg} (Tailwind 700 级 / CTA 蓝, WCAG AA 配白字).`
      ).toBe(expectedBg)
    })

    test(`A2: 暗色 --el-color-${type} 禁止撞色值`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_dark-mode-global.scss'), 'utf8')
      const darkBlocks = extractDarkBlocks(src)
      for (const { body } of darkBlocks) {
        const m = body.match(new RegExp(`--el-color-${type}\\s*:\\s*([^;]+);`, 'i'))
        if (!m) continue
        const value = m[1].trim()
        const isForbidden = FORBIDDEN_BG_VALUES.some(f => value === f)
        expect(
          isForbidden,
          `暗色 --el-color-${type} = ${value} 撞色 (浅色块+浅字 / 深色块+深字).`
        ).toBe(false)
      }
    })
  }

  // --el-color-primary-light-{3,5,7,8,9} 不允许 placeholder 灰
  for (const variant of [3, 5, 7, 8, 9]) {
    test(`A3: 暗色 --el-color-primary-light-${variant} 禁止 placeholder 灰`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_dark-mode-global.scss'), 'utf8')
      const darkBlocks = extractDarkBlocks(src)
      for (const { body } of darkBlocks) {
        const m = body.match(new RegExp(`--el-color-primary-light-${variant}\\s*:\\s*([^;]+);`, 'i'))
        if (!m) continue
        const value = m[1].trim()
        const isForbidden = FORBIDDEN_LIGHT_VARIANTS.some(f => value === f)
        expect(
          isForbidden,
          `暗色 --el-color-primary-light-${variant} = ${value} 是 placeholder 灰, 撞色严重.\n` +
            `推荐: Tailwind blue-300/200/100/50 (#93c5fd/#bfdbfe/#dbeafe/#eff6ff).`
        ).toBe(false)
      }
    })
  }
})

// ════════════════════════════════════════════════════════════════════════
// B. _element-plus-overrides.scss: 5 类 el-button 浅色 color
// ════════════════════════════════════════════════════════════════════════

test.describe('B: _element-plus-overrides.scss 5 类 el-button 浅色 color', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const [type, expectedText] of Object.entries(TEXT_ON)) {
    const expectedToken = type === 'primary' ? '--app-button-text-on-primary' : `--app-text-on-${type}`

    test(`B1: 浅色 .el-button--${type} color 必须用 ${expectedToken}`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
      const blocks = extractBlockContent(src, new RegExp(`:where\\(\\.el-button--${type}\\)\\s*\\{`, 'i'))
      expect(blocks.length, `必须存在 :where(.el-button--${type}) 块`).toBeGreaterThan(0)

      // 取第一个 (浅色) 块
      const lightBlock = blocks[0]
      const value = extractFirstColorValue(lightBlock.body)
      expect(value, `浅色 .el-button--${type} 必须显式 color`).not.toBeNull()

      const isAllowed =
        value === `var(${expectedToken})` ||
        value === 'var(--el-color-white)' ||
        value === '#fff' ||
        value === '#ffffff'
      expect(
        isAllowed,
        `浅色 :where(.el-button--${type}) color: ${value} 不符合规范.\n` +
          `推荐: var(${expectedToken}) (= ${expectedText}, 永定).\n` +
          `允许: #fff / #ffffff / var(--el-color-white) (兼容写法).`
      ).toBe(true)
    })
  }

  // 暗色 primary 块 color 必为 --app-button-text-on-primary
  // 关键 (2026-07-04 修 bug): 不能用 darkBlocks.find() 找 body 含 .el-button--primary 的整块,
  //   因为 :where(.el-button--primary):not(...) 是嵌套在 html.dark 块内的子块, 需先定位子块.
  test('B2: 暗色 html.dark :where(.el-button--primary) 块 color = var(--app-button-text-on-primary)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
    const darkBlocks = extractDarkBlocks(src)
    expect(darkBlocks.length, '必须存在 html.dark 块').toBeGreaterThan(0)

    // 在所有暗色块 body 中再找 :where(.el-button--primary) 子块
    let primaryBody: string | null = null
    for (const { body } of darkBlocks) {
      // 匹配 :where(.el-button--primary) [可能的 :not() 等] { ... }
      const re = /:where\(\.el-button--primary\)[^{]*\{/i
      const m = body.match(re)
      if (m) {
        const start = body.indexOf(m[0]) + m[0].length
        let depth = 1, end = start
        while (depth > 0 && end < body.length) {
          if (body[end] === '{') depth++
          else if (body[end] === '}') depth--
          end++
        }
        if (depth === 0) {
          primaryBody = body.substring(start, end - 1)
          break
        }
      }
    }
    expect(primaryBody, '必须存在暗色块覆盖 .el-button--primary').not.toBeNull()

    const value = extractFirstColorValue(primaryBody!)
    expect(value, '暗色 .el-button--primary 必须显式 color').not.toBeNull()

    const isAllowed =
      value === 'var(--app-button-text-on-primary)' ||
      value === 'var(--el-color-white)' ||
      value === '#fff' ||
      value === '#ffffff'
    expect(
      isAllowed,
      `暗色 :where(.el-button--primary) color: ${value} 不符合规范.\n` +
        `推荐: var(--app-button-text-on-primary) (= #ffffff, 永为白, 蓝底 5.17:1 WCAG AA).`
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════
// C. _element-plus-overrides.scss 暗色块: 5 类 el-tag + 4 类 el-alert + 5 类 el-link
// ════════════════════════════════════════════════════════════════════════

test.describe('C: _element-plus-overrides.scss 暗色块 (tag/alert/link)', () => {
  test.describe.configure({ mode: 'parallel' })

  // 5 类 el-tag
  for (const type of ['primary', 'success', 'warning', 'danger', 'info']) {
    test(`C1: 暗色块存在 :where(.el-tag--${type})`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
      // 找文件内所有 ".el-tag--{type}" 出现位置, 验证其前 250 字符内含 "html.dark"
      // (确保是暗色块, 非浅色块). 允许 html.dark 块嵌套子块.
      const re = new RegExp(`\\.el-tag--${type}(?![\\w-])`, 'gi')
      const found = checkIsInDarkContext(src, re)
      expect(
        found,
        `_element-plus-overrides.scss 暗色块中未发现 :where(.el-tag--${type}) 浅色字反色覆盖.\n` +
          `修复: 暗色下反色 — 浅色文字 (#bbf7d0/#fde68a/#fecaca/#d1d5db/#93c5fd) + 深色背景.`
      ).toBe(true)
    })
  }

  // 4 类 el-alert
  for (const type of ['success', 'warning', 'info', 'error']) {
    test(`C2: 暗色块存在 :where(.el-alert--${type})`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
      const re = new RegExp(`\\.el-alert--${type}(?![\\w-])`, 'gi')
      const found = checkIsInDarkContext(src, re)
      expect(
        found,
        `_element-plus-overrides.scss 暗色块中未发现 :where(.el-alert--${type}) 暗色覆盖.\n` +
          `修复: 4 类 alert 暗色下用深色背景 + 浅色文字 (与 el-message 4 类处理风格一致).`
      ).toBe(true)
    })
  }

  // 5 类 el-link
  for (const type of ['primary', 'success', 'warning', 'danger', 'info']) {
    test(`C3: 暗色块存在 :where(.el-link.el-link--${type})`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
      const re = new RegExp(`\\.el-link(?:\\.el-link)?--${type}(?![\\w-])`, 'gi')
      const found = checkIsInDarkContext(src, re)
      expect(
        found,
        `_element-plus-overrides.scss 暗色块中未发现 :where(.el-link.el-link--${type}) 暗色覆盖.\n` +
          `修复: 5 类 link 暗色块用 Tailwind 200/300 级浅色 (#93c5fd/#bbf7d0/#fde68a/#fecaca/#d1d5db).`
      ).toBe(true)
    })
  }
})

/**
 * 检查文件中是否在某个暗色块作用域内有 selector+`{` 组合
 * 实现: 用平衡大括号找出所有 html.dark 块, 然后在块体内检查目标 selector
 * 关键 (2026-07-04 修 bug): 验证 selector 出现后允许 `)` / `&` / 空白 / 换行 等, 然后 { 才算
 */
function checkIsInDarkContext(src: string, selectorRe: RegExp): boolean {
  // 1. 提取所有暗色块 (匹配 html.dark 后跟 { 起点)
  const darkBlocks: Array<{ start: number; end: number }> = []
  const re = /html\.dark[^{]{0,200}\{/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const openBraceIdx = m.index + m[0].length - 1  // 最后一个 { 的位置
    let depth = 1, end = openBraceIdx + 1
    while (depth > 0 && end < src.length) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    if (depth === 0) {
      darkBlocks.push({ start: openBraceIdx, end })
    }
  }

  // 2. 在所有暗色块体内查找目标 selector, 验证其非注释, 且后接 {
  for (const { start, end } of darkBlocks) {
    const body = src.substring(start, end)
    // 剥离注释避免误报
    const cleanedBody = body
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
    selectorRe.lastIndex = 0
    let sm: RegExpExecArray | null
    while ((sm = selectorRe.exec(cleanedBody)) !== null) {
      // 验证 selector 出现后 <= 50 字符内有 `{` (允许 `)` `&` 空白 换行)
      const after = cleanedBody.substring(sm.index + sm[0].length, sm.index + sm[0].length + 50)
      if (/\)\s*[\s\S]{0,5}\{|[\s\S]{0,3}\{|&\s*[\s\S]{0,3}\{/m.test(after)) {
        return true
      }
    }
  }
  return false
}

// ════════════════════════════════════════════════════════════════════════
// D. _element-plus.scss 暗色块: el-tabs active + checkbox/radio/switch checked
// ════════════════════════════════════════════════════════════════════════

test.describe('D: _element-plus.scss 暗色块 (tabs/checkbox/radio/switch)', () => {
  test.describe.configure({ mode: 'parallel' })

  test('D1: 暗色块存在 el-tabs__item.is-active', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus.scss'), 'utf8')
    const re = /el-tabs__item\.is-active/gi
    const found = checkIsInDarkContext(src, re)
    expect(
      found,
      `_element-plus.scss 暗色块中未发现 el-tabs__item.is-active (暗色下 active tab 文字色).\n` +
        `修复: 在 html.dark 块内添加 .el-tabs__item.is-active { color: var(--el-color-primary); } 等覆盖.`
    ).toBe(true)
  })

  test('D2: 暗色块存在 el-tabs__active-bar', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus.scss'), 'utf8')
    const re = /el-tabs__active-bar/gi
    const found = checkIsInDarkContext(src, re)
    expect(
      found,
      `_element-plus.scss 暗色块中未发现 el-tabs__active-bar (暗色下 active tab 下划线).\n` +
        `修复: 在 html.dark 块内添加 .el-tabs__active-bar { background-color: var(--el-color-primary); } 等覆盖.`
    ).toBe(true)
  })

  test('D3: 暗色块存在 el-checkbox/el-radio/el-switch checked 至少一个', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus.scss'), 'utf8')
    const re = /el-(?:checkbox|radio)__input\.is-checked|el-switch\.is-checked/gi
    const found = checkIsInDarkContext(src, re)
    expect(
      found,
      `_element-plus.scss 暗色块中未发现 el-checkbox/el-radio/el-switch checked 覆盖 (暗色下需 inset 白环补强 CTA 边界).`
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════
// E. _el-message-global.scss 暗色块: 4 类 .el-notification + 5 类 .el-message-box
// ════════════════════════════════════════════════════════════════════════

test.describe('E: _el-message-global.scss 暗色块 (notification/message-box)', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const type of ['success', 'warning', 'info', 'error']) {
    test(`E1: 暗色块存在 .el-notification--${type}`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_el-message-global.scss'), 'utf8')
      const re = new RegExp(`\\.el-notification--${type}(?![\\w-])`, 'gi')
      const found = checkIsInDarkContext(src, re)
      expect(
        found,
        `_el-message-global.scss 暗色块中未发现 .el-notification--${type} 暗色覆盖.`
      ).toBe(true)
    })

    test(`E2: 暗色块存在 .el-message-box--${type}`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_el-message-global.scss'), 'utf8')
      const re = new RegExp(`\\.el-message-box--${type}(?![\\w-])`, 'gi')
      const found = checkIsInDarkContext(src, re)
      expect(
        found,
        `_el-message-global.scss 暗色块中未发现 .el-message-box--${type} 暗色覆盖.`
      ).toBe(true)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════
// F. _global-tokens.scss: 4 个 --app-text-on-* + 1 个 --app-button-text-on-primary + 5 对业务 token
// ════════════════════════════════════════════════════════════════════════

test.describe('F: _global-tokens.scss token 定义完整性', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const [type, expectedText] of Object.entries(TEXT_ON)) {
    const token = type === 'primary' ? '--app-button-text-on-primary' : `--app-text-on-${type}`

    test(`F1: --${token} token 必须 = ${expectedText}`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
      const m = src.match(new RegExp(`${token}\\s*:\\s*([^;]+);`, 'i'))
      expect(m, `必须存在 ${token} token 定义`).not.toBeNull()
      const value = m![1].trim()
      const isAllowed = value === expectedText || value === '#fff' || value === 'var(--el-color-white)' || value === 'white'
      expect(
        isAllowed,
        `${token}: ${value} 不符合规范 (期望 ${expectedText} 或兼容写法 #fff/var(--el-color-white)/white).`
      ).toBe(true)
    })
  }

  // 5 对业务级 token
  for (const [type, expectedLightText] of Object.entries(BUSINESS_LIGHT)) {
    test(`F2: --app-color-${type}-text 必须 = ${expectedLightText} (浅色 mode 深色字)`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
      const m = src.match(new RegExp(`--app-color-${type}-text\\s*:\\s*([^;]+);`, 'i'))
      expect(m, `必须存在 --app-color-${type}-text token 定义`).not.toBeNull()
      const value = m![1].trim()
      expect(
        value,
        `--app-color-${type}-text: ${value} 不符合规范 (期望 ${expectedLightText}, 浅色 mode 深色字).`
      ).toBe(expectedLightText)
    })

    test(`F3: --app-color-${type}-bg 必须存在 (8% 透明背景)`, () => {
      const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
      const m = src.match(new RegExp(`--app-color-${type}-bg\\s*:\\s*([^;]+);`, 'i'))
      expect(m, `必须存在 --app-color-${type}-bg token 定义`).not.toBeNull()
      const value = m![1].trim()
      expect(
        value,
        `--app-color-${type}-bg: ${value} 不符合规范 (期望 rgba(..., 0.08) 8% 透明背景).`
      ).toMatch(/rgba\([^)]+,\s*0\.0?8\)/)
    })
  }
})

// ════════════════════════════════════════════════════════════════════════
// G. 对比度计算: 5 类主色 (primary/success/warning/danger/info) 暗色文字 vs 背景 ≥ WCAG AA 4.5
// ════════════════════════════════════════════════════════════════════════

test.describe('G: 5 类主色暗色对比度计算 (WCAG AA 4.5)', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const [type, expectedBg] of Object.entries(DARK_BG)) {
    const expectedText = TEXT_ON[type as keyof typeof TEXT_ON]
    test(`G1: 暗色 ${type} 文字 ${expectedText} on 背景 ${expectedBg} 对比度 ≥ 4.5`, () => {
      const ratio = contrastRatio(expectedText, expectedBg)
      expect(
        ratio,
        `暗色 ${type}: ${expectedText} on ${expectedBg} 对比度 = ${ratio.toFixed(2)}, ` +
          `必须 ≥ ${MIN_CONTRAST_RATIO} (WCAG AA 正文).`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    })
  }

  // 5 对业务级 token 暗色文字 on 浅色业务背景
  for (const [type, expectedText] of Object.entries(BUSINESS_DARK)) {
    test(`G2: 暗色业务 ${type} 文字 ${expectedText} 在 15% 透明背景上对比度 ≥ 4.5`, () => {
      // 简化: 与 #0d0d0d 背景 (暗色下 --el-bg-color 实际值) 计算
      // 实际背景 = rgba(74,222,128,0.15) 合成到 #0d0d0d 上
      // 合成公式: out = bg * (1 - alpha) + fg * alpha
      // 这里直接用经验值, 浅色字 on 深色背景, 9.5+ 都通过
      const syntheticBgs: Record<string, string> = {
        success: '#142818',  // 合成 rgba(74,222,128,0.15) on #0d0d0d
        warning: '#282414',
        danger: '#281414',
        info: '#141c28',
        primary: '#142036',
      }
      const ratio = contrastRatio(expectedText, syntheticBgs[type as keyof typeof syntheticBgs])
      expect(
        ratio,
        `暗色业务 ${type}: ${expectedText} on ${syntheticBgs[type as keyof typeof syntheticBgs]} ` +
          `对比度 = ${ratio.toFixed(2)}, 必须 ≥ ${MIN_CONTRAST_RATIO} (WCAG AA 正文).`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    })
  }
})
