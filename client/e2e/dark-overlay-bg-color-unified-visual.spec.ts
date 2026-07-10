/**
 * 暗色浮层底色统一硬约束浏览器级守卫 (2026-07-03 立, 2026-07-04 增强)
 *
 * 配套源码级 spec: dark-overlay-bg-color-unified.spec.ts
 *
 * 本 spec 在浏览器运行时验证 6 类浮层组件的暗色底色确实渲染为 #1a1a1a:
 *   - ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown
 *
 * 2026-07-04 增强: 新增 E1-E4 测试, 锚定"暗色下 --el-bg-color = --color-dark-bg-3"关系
 *   - E1: 暗色下 --el-bg-color 解析值 = rgb(26, 26, 26) = #1a1a1a
 *   - E2: 暗色下 --el-bg-color-overlay 解析值 = rgb(26, 26, 26) = #1a1a1a
 *   - E3: 暗色下 --color-dark-bg-3 解析值 = rgb(26, 26, 26) = #1a1a1a (锚点不被破坏)
 *   - E4: 浅色下 --el-bg-color ≠ rgb(26, 26, 26) (防止锚点意外影响浅色)
 *
 * 运行: PW_BASE_URL=http://localhost:8888 npx playwright test e2e/dark-overlay-bg-color-unified-visual.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { FRONTEND_URL } from '../config/ports'

const SKIP_BROWSER = !process.env.PW_BASE_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

const DARK_BG_COLOR = 'rgb(26, 26, 26)' // #1a1a1a
const LIGHT_BG_COLOR = 'rgb(255, 255, 255)' // #ffffff

async function injectOverlayAndGetBg(page: Page, overlayClass: string): Promise<string> {
  return page.evaluate((cls) => {
    const overlay = document.createElement('div')
    overlay.className = cls
    overlay.style.position = 'fixed'
    overlay.style.top = '100px'
    overlay.style.left = '100px'
    overlay.style.zIndex = '9999'
    overlay.style.width = '300px'
    overlay.style.height = '100px'
    document.body.appendChild(overlay)

    const cs = getComputedStyle(overlay)
    const result = cs.backgroundColor

    document.body.removeChild(overlay)
    return result
  }, overlayClass)
}

// ElPopper 基础类 (.el-popper) 默认透明, .el-popper.is-dark 是 Element Plus 设计的反差
// tooltip (暗色下背景=浅色文字色), 不属于"浮层底色统一"范畴.
// 本测试针对 .el-popper.el-dropdown-menu__popper (dropdown popper wrapper, 背景=var(--el-bg-color)),
// 与 _element-plus-overrides.scss 第 286 行一致.
async function injectDropdownPopperAndGetBg(page: Page): Promise<string> {
  return page.evaluate(() => {
    const overlay = document.createElement('div')
    overlay.className = 'el-popper el-dropdown-menu__popper'
    overlay.style.position = 'fixed'
    overlay.style.top = '100px'
    overlay.style.left = '100px'
    overlay.style.zIndex = '9999'
    overlay.style.width = '300px'
    overlay.style.height = '100px'
    document.body.appendChild(overlay)

    const cs = getComputedStyle(overlay)
    const result = cs.backgroundColor

    document.body.removeChild(overlay)
    return result
  })
}

// 2026-07-04 新增: 读 CSS 变量计算值
async function readCssVar(page: Page, varName: string): Promise<string> {
  return page.evaluate((name) => {
    const html = document.documentElement
    return getComputedStyle(html).getPropertyValue(name).trim()
  }, varName)
}

// 颜色转 rgb 函数: 把 ' #1a1a1a' / 'rgb(26, 26, 26)' / '#0d0d0d' 等都转成 'rgb(...)' 形式便于比较
function normalizeColor(c: string): string {
  const s = c.trim().toLowerCase()
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgb(${r}, ${g}, ${b})`
    }
  }
  return s
}

test.describe('暗色浮层底色统一硬约束浏览器级守卫', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
  })

  test('暗色 + ElMessageBox: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectOverlayAndGetBg(page, 'el-message-box')
    expect(bg, `ElMessageBox 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  test('暗色 + ElNotification: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectOverlayAndGetBg(page, 'el-notification')
    expect(bg, `ElNotification 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  test('暗色 + ElDialog: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectOverlayAndGetBg(page, 'el-dialog')
    expect(bg, `ElDialog 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  test('暗色 + ElMessage: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectOverlayAndGetBg(page, 'el-message')
    expect(bg, `ElMessage 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  test('暗色 + ElPopper.el-dropdown-menu__popper: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectDropdownPopperAndGetBg(page)
    expect(bg, `ElPopper.el-dropdown-menu__popper 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  test('暗色 + ElDropdownMenu: backgroundColor = #1a1a1a', async ({ page }) => {
    const bg = await injectOverlayAndGetBg(page, 'el-dropdown-menu')
    expect(bg, `ElDropdownMenu 暗色底色=${bg} 应为 ${DARK_BG_COLOR}`).toBe(DARK_BG_COLOR)
  })

  // ====================================================================
  // 2026-07-04 新增: 锚定"暗色下 --el-bg-color = --color-dark-bg-3"关系
  // 防止 --el-bg-color 在未来被重定义为别的值, 破坏浮层内 primary 按钮 4.5:1 对比度
  // ====================================================================

  test('E1 暗色 + --el-bg-color 解析值 = #1a1a1a (暗色浮层底色锚定)', async ({ page }) => {
    const value = await readCssVar(page, '--el-bg-color')
    expect(
      normalizeColor(value),
      `暗色下 --el-bg-color 解析值="${value}" 应解析为 ${DARK_BG_COLOR} (= #1a1a1a)`,
    ).toBe(DARK_BG_COLOR)
  })

  test('E2 暗色 + --el-bg-color-overlay 解析值 = #1a1a1a (暗色浮层底色锚定)', async ({ page }) => {
    const value = await readCssVar(page, '--el-bg-color-overlay')
    expect(
      normalizeColor(value),
      `暗色下 --el-bg-color-overlay 解析值="${value}" 应解析为 ${DARK_BG_COLOR} (= #1a1a1a)`,
    ).toBe(DARK_BG_COLOR)
  })

  test('E3 暗色 + --color-dark-bg-3 解析值 = #1a1a1a (锚点本身不被破坏)', async ({ page }) => {
    const value = await readCssVar(page, '--color-dark-bg-3')
    expect(
      normalizeColor(value),
      `暗色下 --color-dark-bg-3 解析值="${value}" 应解析为 ${DARK_BG_COLOR} (= #1a1a1a)\n` +
        `锚点 #1a1a1a 是暗色浮层底色统一的核心, 被破坏会引发浮层内 primary 按钮对比度问题`,
    ).toBe(DARK_BG_COLOR)
  })

  test('E4 浅色 + --el-bg-color ≠ #1a1a1a (防止锚点意外影响浅色)', async ({ page }) => {
    // 取消 dark 模式
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await page.waitForTimeout(200)

    const value = await readCssVar(page, '--el-bg-color')
    expect(
      normalizeColor(value),
      `浅色下 --el-bg-color 解析值="${value}" 不应为 ${DARK_BG_COLOR} (= #1a1a1a)`,
    ).not.toBe(DARK_BG_COLOR)
    // 浅色下 --el-bg-color 应是浅色 (如 #ffffff / rgb(255, 255, 255))
    expect(
      normalizeColor(value),
      `浅色下 --el-bg-color 解析值="${value}" 应为 ${LIGHT_BG_COLOR} 或其他浅色`,
    ).toBe(LIGHT_BG_COLOR)
  })
})
