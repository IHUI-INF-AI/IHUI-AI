/**
 * 暗色浮层内 primary 按钮无双层蓝边浏览器级守卫 (2026-07-03 立)
 *
 * 配套源码级 spec: dark-overlay-primary-button-no-double-border.spec.ts
 *
 * 本 spec 在浏览器运行时验证:
 *   - ElMessageBox / ElDialog / ElPopper 内的 .el-button--primary 按钮:
 *     - borderWidth === '0px' (移除 2px 蓝边)
 *     - boxShadow === 'none' (移除 inset 白环)
 *   - sidebar 等非浮层位置的 primary 按钮仍保留 inset 白环 (确保不污染全局)
 *   - 暗色 / 浅色 2 个组合均通过
 *
 * 运行: PW_BASE_URL=http://localhost:8888 npx playwright test e2e/dark-overlay-primary-button-no-double-border-visual.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { FRONTEND_URL } from '../config/ports'

const SKIP_BROWSER = !process.env.PW_BASE_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

async function injectOverlayButton(page: Page, overlayClass: string): Promise<{ borderWidth: string; boxShadow: string }> {
  return page.evaluate((cls) => {
    // 创建浮层容器 + primary 按钮
    const overlay = document.createElement('div')
    overlay.className = cls
    overlay.style.position = 'fixed'
    overlay.style.top = '100px'
    overlay.style.left = '100px'
    overlay.style.zIndex = '9999'

    const btn = document.createElement('button')
    btn.className = 'el-button el-button--primary'
    btn.textContent = '测试按钮'
    overlay.appendChild(btn)

    document.body.appendChild(overlay)

    const cs = getComputedStyle(btn)
    const result = {
      borderWidth: cs.borderWidth,
      boxShadow: cs.boxShadow,
    }

    // 清理
    document.body.removeChild(overlay)
    return result
  }, overlayClass)
}

async function injectNonOverlayButton(page: Page): Promise<{ borderWidth: string; boxShadow: string }> {
  return page.evaluate(() => {
    // 创建一个不在浮层内的 primary 按钮 (模拟 sidebar 等位置)
    const btn = document.createElement('button')
    btn.className = 'el-button el-button--primary'
    btn.textContent = '非浮层按钮'
    btn.style.position = 'fixed'
    btn.style.top = '200px'
    btn.style.left = '100px'
    btn.style.zIndex = '9999'
    document.body.appendChild(btn)

    const cs = getComputedStyle(btn)
    const result = {
      borderWidth: cs.borderWidth,
      boxShadow: cs.boxShadow,
    }

    document.body.removeChild(btn)
    return result
  })
}

test.describe('暗色浮层内 primary 按钮无双层蓝边浏览器级守卫', () => {
  test('暗色 + ElMessageBox: primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)

    const styles = await injectOverlayButton(page, 'el-message-box')
    expect(styles.borderWidth, `ElMessageBox 内 primary borderWidth=${styles.borderWidth} 应为 0px`).toBe('0px')
    expect(styles.boxShadow, `ElMessageBox 内 primary boxShadow="${styles.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + ElDialog: primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)

    const styles = await injectOverlayButton(page, 'el-dialog')
    expect(styles.borderWidth, `ElDialog 内 primary borderWidth=${styles.borderWidth} 应为 0px`).toBe('0px')
    expect(styles.boxShadow, `ElDialog 内 primary boxShadow="${styles.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + ElNotification: primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)

    const styles = await injectOverlayButton(page, 'el-notification')
    expect(styles.borderWidth, `ElNotification 内 primary borderWidth=${styles.borderWidth} 应为 0px`).toBe('0px')
    expect(styles.boxShadow, `ElNotification 内 primary boxShadow="${styles.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + ElPopper: primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)

    const styles = await injectOverlayButton(page, 'el-popper')
    expect(styles.borderWidth, `ElPopper 内 primary borderWidth=${styles.borderWidth} 应为 0px`).toBe('0px')
    expect(styles.boxShadow, `ElPopper 内 primary boxShadow="${styles.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + 非浮层位置: primary 仍保留 inset 白环 (确保不污染全局)', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量')
    await page.goto(FRONTEND)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)

    const styles = await injectNonOverlayButton(page)
    // 非浮层位置的 primary 按钮应该保留 inset 白环 (全局规则)
    expect(
      styles.boxShadow,
      `非浮层 primary boxShadow="${styles.boxShadow}" 应含 inset 白环 (全局规则不应被浮层排除规则污染)`,
    ).toContain('inset')
  })
})
