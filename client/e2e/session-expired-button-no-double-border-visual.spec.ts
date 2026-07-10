/**
 * 会话过期通知内"重新登录/取消"按钮无双层蓝边浏览器级守卫 (2026-07-03 立)
 *
 * 配套源码级 spec: session-expired-button-no-double-border.spec.ts
 *
 * 本 spec 在浏览器运行时验证:
 *   - 触发 session-expired 事件后, 通知内 .el-button--primary 按钮:
 *     - borderWidth === '0px' (移除 2px 蓝边)
 *     - boxShadow === 'none' (移除 inset 白环)
 *   - 默认 .el-button (取消按钮) boxShadow === 'none' (移除白边)
 *   - hover 状态下 boxShadow 仍 === 'none' (状态切换不引入新阴影)
 *   - 暗色 / 浅色 / Desktop / Mobile Chrome 4 个组合均通过
 */
import { test, expect, type Page } from '@playwright/test'
import { FRONTEND_URL } from '../config/ports'

const SKIP_BROWSER = !process.env.PW_BASE_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

interface ButtonStyles {
  borderWidth: string
  boxShadow: string
  backgroundColor: string
}

async function getButtonStyles(page: Page, selector: string): Promise<ButtonStyles> {
  return page.evaluate((sel) => {
    const btn = document.querySelector(sel) as HTMLElement
    if (!btn) throw new Error(`button not found: ${sel}`)
    const cs = getComputedStyle(btn)
    return {
      borderWidth: cs.borderWidth,
      boxShadow: cs.boxShadow,
      backgroundColor: cs.backgroundColor,
    }
  }, selector)
}

async function triggerSessionExpired(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('session-expired', {
      detail: { reason: '测试触发: 验证按钮无双层边框' },
    }))
  })
  await page.locator('.session-expired-notification').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(600)
}

async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('#app *', { state: 'attached', timeout: 10000 })
  await page.waitForTimeout(100)
}

test.describe('会话过期通知按钮无双层蓝边浏览器级守卫', () => {
  test('浅色 + Desktop Chrome: .el-button--primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    await triggerSessionExpired(page)

    const primary = await getButtonStyles(page, '.session-expired-notification .el-button--primary')
    expect(primary.borderWidth, `浅色模式: borderWidth=${primary.borderWidth} 应为 0px`).toBe('0px')
    expect(primary.boxShadow, `浅色模式: boxShadow=${primary.boxShadow} 应为 none`).toBe('none')

    const cancel = await getButtonStyles(page, '.session-expired-notification .el-button:not(.el-button--primary)')
    expect(cancel.boxShadow, `浅色模式: 取消按钮 boxShadow=${cancel.boxShadow} 应为 none`).toBe('none')
  })

  test('暗色 + Desktop Chrome: .el-button--primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await triggerSessionExpired(page)

    const primary = await getButtonStyles(page, '.session-expired-notification .el-button--primary')
    expect(primary.borderWidth, `暗色模式: borderWidth=${primary.borderWidth} 应为 0px`).toBe('0px')
    expect(primary.boxShadow, `暗色模式: boxShadow="${primary.boxShadow}" 应为 none`).toBe('none')

    const cancel = await getButtonStyles(page, '.session-expired-notification .el-button:not(.el-button--primary)')
    expect(cancel.boxShadow, `暗色模式: 取消按钮 boxShadow="${cancel.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + Desktop Chrome: hover 状态 boxShadow 仍为 none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await triggerSessionExpired(page)

    const btn = page.locator('.session-expired-notification .el-button--primary')
    await btn.hover()
    await page.waitForTimeout(300)

    const styles = await getButtonStyles(page, '.session-expired-notification .el-button--primary')
    expect(styles.boxShadow, `暗色 hover: boxShadow="${styles.boxShadow}" 应为 none`).toBe('none')
  })

  test('暗色 + Mobile Chrome (Pixel 5): .el-button--primary borderWidth=0 + boxShadow=none', async ({ page }) => {
    test.skip(SKIP_BROWSER, '需 PW_BASE_URL 环境变量指向运行中的 dev/preview server')
    await page.goto(FRONTEND)
    await waitForAppReady(page)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await triggerSessionExpired(page)

    const primary = await getButtonStyles(page, '.session-expired-notification .el-button--primary')
    expect(primary.borderWidth).toBe('0px')
    expect(primary.boxShadow).toBe('none')
  })
})
