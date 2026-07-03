/**
 * 暗色浮层底色统一硬约束浏览器级守卫 (2026-07-03 立)
 *
 * 配套源码级 spec: dark-overlay-bg-color-unified.spec.ts
 *
 * 本 spec 在浏览器运行时验证 6 类浮层组件的暗色底色确实渲染为 #1a1a1a:
 *   - ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown
 *
 * 运行: PW_BASE_URL=http://localhost:8888 npx playwright test e2e/dark-overlay-bg-color-unified-visual.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { FRONTEND_URL } from '../config/ports'

const SKIP_BROWSER = !process.env.PW_BASE_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

const DARK_BG_COLOR = 'rgb(26, 26, 26)' // #1a1a1a

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

test.describe('暗色浮层底色统一硬约束浏览器级守卫', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('networkidle')
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
})
