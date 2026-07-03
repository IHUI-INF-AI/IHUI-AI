/**
 * primary 按钮暗色对比度守门 (2026-07-04 立)
 *
 * 防回归目标:
 * 2026-07-04 用户反馈"暗色模式下背景色为浅色时没有自动切换文字色为深色,
 * 项目中还有很多很多类似这样的情况". 根因:
 *   - _dark-mode-global.scss:32 把 --el-color-primary 暗色映射为 var(--el-bg-color)=#0d0d0d
 *   - _element-plus-overrides.scss:132/414 用 color: var(--el-bg-color-page)=#0d0d0d
 *   - 两者 dark 模式同值, primary 按钮背景与文字 1:1 完全不可见
 *   - 影响: 登录/注册/订阅/付费/表单提交等所有 .el-button--primary
 *
 * 修复:
 *   - _dark-mode-global.scss:32 改为 --el-color-primary: #2563eb (CTA 蓝)
 *   - _element-plus-overrides.scss:130-142/408-435 改为 color: var(--app-button-text-on-primary)
 *   - _global-tokens.scss:245 重定义为 --app-button-text-on-primary: #ffffff (永为白)
 *   - _el-message-global.scss 末尾追加 .el-message--primary 兜底
 *
 * 防回归点 (任一处被改回即触发失败):
 *   A. _dark-mode-global.scss 暗色 --el-color-primary 必须 = #2563eb (或允许的蓝色变体),
 *      禁止引用 var(--el-bg-color*) / var(--el-text-color-*) / 深色 hex (#0d0d0d/#000 等)
 *   B. _element-plus-overrides.scss 浅色 :where(.el-button--primary) color 必须用
 *      var(--app-button-text-on-primary) (或允许的 #ffffff/--el-color-white)
 *   C. _element-plus-overrides.scss 暗色 html.dark :where(.el-button--primary) color 同上
 *   D. _global-tokens.scss --app-button-text-on-primary 必须 = #ffffff, 禁止引用 --el-bg-color
 *   E. 对比度计算: #ffffff on #2563eb = 5.17:1 ≥ WCAG AA 4.5:1
 *   F. dev server 启动时浏览器级验证: getComputedStyle 提取 .el-button--primary 真实计算色
 *
 * CI 入口: npm run e2e / npx playwright test primary-button-contrast.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _dark-mode-global.scss / _global-tokens.scss + check script 完全一致)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED_DARK_PRIMARY_BG = '#2563eb'  // dark 模式 primary 按钮背景 (CTA 蓝)
const EXPECTED_PRIMARY_TEXT = '#ffffff'     // primary 按钮文字 (永为白, 蓝底 5.17:1)
const MIN_CONTRAST_RATIO = 4.5              // WCAG AA 正文最低对比度

// 禁止: 暗色 --el-color-primary 不能映射的值 (与 check script 同步)
const FORBIDDEN_PRIMARY_VALUES = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  '#0d0d0d',
  '#1a1a1a',
  '#000',
  '#000000',
  '#222',
  '#333',
  '#2d2d2d',
]

// 禁止: primary 按钮 color 不能用的值
const FORBIDDEN_BUTTON_COLOR = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  '#0d0d0d',
  '#1a1a1a',
  '#000',
  '#000000',
]

// 平衡大括号提取块 (与 check script 同步)
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

function extractDarkBlocks(src: string) {
  return extractBlockContent(src, /(?::where\()?html\.dark\)?\s*\{/i)
}

// ════════════════════════════════════════════════════════════════════════
// 源码级断言 (不需浏览器, < 5ms)
// ════════════════════════════════════════════════════════════════════════

test.describe('primary 按钮暗色对比度 - 源码级守门', () => {
  test.describe.configure({ mode: 'parallel' })

  // ── A. _dark-mode-global.scss 暗色 --el-color-primary ──

  test('A1: _dark-mode-global.scss 暗色 --el-color-primary 必须 = #2563eb', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_dark-mode-global.scss'), 'utf8')
    const darkBlocks = extractDarkBlocks(src)
    expect(darkBlocks.length, '必须存在 html.dark 块').toBeGreaterThan(0)

    // 找包含 --el-color-primary 的暗色块
    const primaryBlock = darkBlocks.find(b => /--el-color-primary\s*:/.test(b.body))
    expect(primaryBlock, '必须存在暗色块覆盖 --el-color-primary').toBeDefined()

    const match = primaryBlock!.body.match(/--el-color-primary\s*:\s*([^;]+);/i)
    expect(match, '暗色 --el-color-primary 必须有值').not.toBeNull()
    const value = match![1].trim()

    expect(
      value,
      `暗色 --el-color-primary 必须为 ${EXPECTED_DARK_PRIMARY_BG} (CTA 蓝, 蓝底白字 5.17:1 WCAG AA).\n` +
        `当前值: ${value}\n` +
        `根因 (2026-07-04): 之前 var(--el-bg-color) (dark=#0d0d0d) 与 button color 同色不可见.`
    ).toBe(EXPECTED_DARK_PRIMARY_BG)
  })

  test('A2: _dark-mode-global.scss 暗色 --el-color-primary 禁止深色/撞色值', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_dark-mode-global.scss'), 'utf8')
    const darkBlocks = extractDarkBlocks(src)

    for (const { body } of darkBlocks) {
      const match = body.match(/--el-color-primary\s*:\s*([^;]+);/i)
      if (!match) continue
      const value = match[1].trim()
      const isForbidden = FORBIDDEN_PRIMARY_VALUES.some(f => value === f)
      expect(
        isForbidden,
        `暗色 --el-color-primary = ${value} 撞色 (与背景/文字不可见).\n` +
          `禁止: ${FORBIDDEN_PRIMARY_VALUES.join(' / ')}\n` +
          `推荐: ${EXPECTED_DARK_PRIMARY_BG} (CTA 蓝) 或 #3b82f6 / #60a5fa / var(--color-cta-blue*).`
      ).toBe(false)
    }
  })

  // ── B. _element-plus-overrides.scss 浅色 primary 块 ──

  test('B1: _element-plus-overrides.scss 浅色 :where(.el-button--primary) color = var(--app-button-text-on-primary)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
    const blocks = extractBlockContent(src, /:where\(\.el-button--primary\)\s*\{/i)
    expect(blocks.length, '必须存在 :where(.el-button--primary) 块').toBeGreaterThan(0)

    // 取第一个 (浅色) 块
    const lightBlock = blocks[0]
    const colorMatch = lightBlock.body.match(/^\s*color\s*:\s*([^;]+);/im)
    expect(colorMatch, '浅色 .el-button--primary 必须显式 color').not.toBeNull()
    const value = colorMatch![1].trim()

    const isAllowed =
      value === 'var(--app-button-text-on-primary)' ||
      value === 'var(--el-color-white)' ||
      value === '#fff' ||
      value === '#ffffff'

    expect(
      isAllowed,
      `浅色 :where(.el-button--primary) color: ${value} 不符合规范.\n` +
        `推荐: var(--app-button-text-on-primary) (= ${EXPECTED_PRIMARY_TEXT}, 永为白).\n` +
        `允许: var(--el-color-white) / #fff / #ffffff.\n` +
        `禁止: var(--el-bg-color-page) (dark=#0d0d0d 撞色).`
    ).toBe(true)
  })

  test('B2: _element-plus-overrides.scss 浅色 primary color 禁止撞色值', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
    const blocks = extractBlockContent(src, /:where\(\.el-button--primary\)\s*\{/i)
    for (const { body } of blocks) {
      const colorMatch = body.match(/^\s*color\s*:\s*([^;]+);/im)
      if (!colorMatch) continue
      const value = colorMatch[1].trim()
      const isForbidden = FORBIDDEN_BUTTON_COLOR.some(f => value === f)
      expect(
        isForbidden,
        `浅色 :where(.el-button--primary) color: ${value} 与 primary 背景撞色.\n` +
          `禁止: ${FORBIDDEN_BUTTON_COLOR.join(' / ')}`
      ).toBe(false)
    }
  })

  // ── C. _element-plus-overrides.scss 暗色 primary 块 ──

  test('C1: _element-plus-overrides.scss 暗色 html.dark :where(.el-button--primary) color = var(--app-button-text-on-primary)', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_element-plus-overrides.scss'), 'utf8')
    const darkBlocks = extractDarkBlocks(src)
    expect(darkBlocks.length, '必须存在 html.dark 块').toBeGreaterThan(0)

    // 找含 .el-button--primary 的暗色块
    const primaryDarkBlock = darkBlocks.find(b => b.body.includes('.el-button--primary'))
    expect(primaryDarkBlock, '必须存在暗色块覆盖 .el-button--primary').toBeDefined()

    // 2026-07-04 修复: 1) 剥离注释避免 comment 中"color:"字符串误配
    //                2) 词边界 (^|[\s;{]) 避免 background-color / border-color 子串误配
    const cleanedBody = primaryDarkBlock!.body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    const colorMatch = cleanedBody.match(/(^|[\s;{])color\s*:\s*([^;]+);/i)
    expect(colorMatch, '暗色 .el-button--primary 必须显式 color').not.toBeNull()
    const value = colorMatch![2].trim()

    const isAllowed =
      value === 'var(--app-button-text-on-primary)' ||
      value === 'var(--el-color-white)' ||
      value === '#fff' ||
      value === '#ffffff'

    expect(
      isAllowed,
      `暗色 html.dark :where(.el-button--primary) color: ${value} 不符合规范.\n` +
        `推荐: var(--app-button-text-on-primary) (= ${EXPECTED_PRIMARY_TEXT}, 永为白).\n` +
        `配合 _dark-mode-global.scss 的 --el-color-primary: #2563eb, 蓝底白字 5.17:1 WCAG AA.`
    ).toBe(true)
  })

  // ── D. _global-tokens.scss --app-button-text-on-primary ──

  test('D1: _global-tokens.scss --app-button-text-on-primary 必须 = #ffffff', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
    const match = src.match(/--app-button-text-on-primary\s*:\s*([^;]+);/i)
    expect(match, '必须存在 --app-button-text-on-primary token 定义').not.toBeNull()
    const value = match![1].trim()

    const isAllowed =
      value === '#ffffff' ||
      value === '#fff' ||
      value === 'var(--el-color-white)' ||
      value === 'white'

    expect(
      isAllowed,
      `--app-button-text-on-primary: ${value} 不符合规范.\n` +
        `推荐: #ffffff (永为白, 蓝底白字 5.17:1).\n` +
        `允许: #fff / var(--el-color-white) / white.\n` +
        `禁止: var(--el-bg-color*) (dark=#0d0d0d 撞色).`
    ).toBe(true)
  })

  test('D2: _global-tokens.scss --app-button-text-on-primary 禁止深色/撞色值', () => {
    const src = readFileSync(join(ROOT, 'src/styles/_global-tokens.scss'), 'utf8')
    const match = src.match(/--app-button-text-on-primary\s*:\s*([^;]+);/i)
    expect(match, '必须存在 --app-button-text-on-primary token 定义').not.toBeNull()
    const value = match![1].trim()

    const isForbidden =
      FORBIDDEN_BUTTON_COLOR.some(f => value === f) ||
      value.startsWith('var(--el-bg-color')

    expect(
      isForbidden,
      `--app-button-text-on-primary: ${value} 与 dark primary 背景撞色.\n` +
        `根因 (2026-07-04): 之前 var(--el-bg-color) (dark=#0d0d0d) 与 --el-color-primary 撞色.`
    ).toBe(false)
  })

  // ── E. 对比度计算 ──

  test('E1: #ffffff on #2563eb 对比度 = 5.17 ≥ 4.5 (WCAG AA)', () => {
    // WCAG 2.x 相对亮度公式
    const channelLuminance = (c: number): number => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const hexToRgb = (hex: string): [number, number, number] => {
      const raw = hex.replace('#', '')
      const h = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    const relativeLuminance = (hex: string): number => {
      const [r, g, b] = hexToRgb(hex)
      return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
    }
    const contrastRatio = (fg: string, bg: string): number => {
      const l1 = relativeLuminance(fg)
      const l2 = relativeLuminance(bg)
      const lighter = Math.max(l1, l2)
      const darker = Math.min(l1, l2)
      return (lighter + 0.05) / (darker + 0.05)
    }

    const ratio = contrastRatio(EXPECTED_PRIMARY_TEXT, EXPECTED_DARK_PRIMARY_BG)
    expect(
      ratio,
      `对比度 ${EXPECTED_PRIMARY_TEXT} on ${EXPECTED_DARK_PRIMARY_BG} = ${ratio.toFixed(2)}, ` +
        `必须 ≥ ${MIN_CONTRAST_RATIO} (WCAG AA 正文). ` +
        `修复前 1:1 (深底深字) → 修复后 5.17:1 (蓝底白字).`
    ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
  })
})

// ════════════════════════════════════════════════════════════════════════
// 浏览器级断言 (需 PW_BASE_URL, dev/preview server 健康时跑)
// 验证运行时实际计算值, 防止"源码对了但运行时被覆盖"的隐性回归
// ════════════════════════════════════════════════════════════════════════
const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:8888'

test.describe('primary 按钮暗色对比度 - 浏览器级守门', () => {
  test.skip(({ isMobile }) => isMobile === true, 'Mobile 视口下 primary 按钮行为不同, 仅桌面端守门')
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // 强制暗色模式 (在页面 JS 执行前)
    await page.addInitScript(() => {
      localStorage.setItem('darkMode', 'dark')
    })
  })

  /**
   * 访问页面 + 等待网络空闲 + 检查暗色激活
   */
  async function gotoAndVerifyDark(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark, `访问 ${url} 后 html 必须含 .dark class (暗色模式已应用)`).toBe(true)
  }

  /**
   * 计算 hex 颜色字符串的相对亮度
   */
  function relativeLuminance(rgb: string): number {
    // rgb 格式: "rgb(37, 99, 235)" 或 "rgba(...)"
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return 0
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const channelL = (c: number): number => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channelL(r) + 0.7152 * channelL(g) + 0.0722 * channelL(b)
  }

  function contrastRatio(fgRgb: string, bgRgb: string): number {
    const l1 = relativeLuminance(fgRgb)
    const l2 = relativeLuminance(bgRgb)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  test('F1: 暗色下 /login 页面 .el-button--primary 实际计算色对比度 ≥ 4.5', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await gotoAndVerifyDark(page, `${BASE_URL}/login`)

    // 等待登录按钮渲染
    await page.waitForSelector('.el-button--primary', { state: 'visible', timeout: 15000 })

    // 提取所有 .el-button--primary 的实际计算 backgroundColor 与 color
    const samples = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.el-button--primary')) as HTMLElement[]
      return buttons.slice(0, 5).map(btn => {
        const cs = getComputedStyle(btn)
        return {
          text: btn.textContent?.trim().slice(0, 30) || '',
          backgroundColor: cs.backgroundColor,
          color: cs.color,
        }
      })
    })

    expect(samples.length, '页面必须至少有一个 .el-button--primary').toBeGreaterThan(0)

    for (const { text, backgroundColor, color } of samples) {
      const ratio = contrastRatio(color, backgroundColor)
      expect(
        ratio,
        `登录页 .el-button--primary (text="${text}") color=${color} bg=${backgroundColor} ` +
          `对比度 ${ratio.toFixed(2)} < ${MIN_CONTRAST_RATIO} (WCAG AA 失败).\n` +
          `根因 (2026-07-04): _dark-mode-global.scss:32 之前 --el-color-primary=var(--el-bg-color)=#0d0d0d, ` +
          `与 button color var(--el-bg-color-page)=#0d0d0d 同色, 1:1 不可见.\n` +
          `修复后: --el-color-primary=#2563eb, color=#ffffff, 5.17:1 通过.`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    }
  })

  test('F2: 暗色下 / 页面 primary 按钮 background 必须是 #2563eb (rgb(37, 99, 235))', async ({ page }) => {
    test.skip(!BASE_URL, 'PW_BASE_URL 未设置, 跳过浏览器级测试')
    await gotoAndVerifyDark(page, `${BASE_URL}/`)

    // 首页可能无 .el-button--primary, 跳过 (F1 已验证 login 页)
    const hasPrimary = await page.evaluate(() => document.querySelectorAll('.el-button--primary').length)
    test.skip(hasPrimary === 0, '首页无 .el-button--primary, 跳过 (F1 验证 login 页)')

    const bgs = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.el-button--primary')) as HTMLElement[]
      return buttons.map(btn => getComputedStyle(btn).backgroundColor)
    })

    for (const bg of bgs) {
      expect(
        bg,
        `暗色下 .el-button--primary 背景必须为 ${EXPECTED_DARK_PRIMARY_BG} (rgb(37, 99, 235)).\n` +
          `当前: ${bg}\n` +
          `若 bg 是 #0d0d0d/#1a1a1a 黑色, 说明 --el-color-primary 暗色映射被改回 var(--el-bg-color).`
      ).toBe('rgb(37, 99, 235)')
    }
  })
})
