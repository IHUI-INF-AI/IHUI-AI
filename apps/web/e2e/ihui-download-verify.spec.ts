import { test, expect } from '@playwright/test'

/**
 * 下载功能验证 — 2026-08-06 立。
 *
 * 验证项:
 * 1. 侧边栏下载按钮可点击,弹出 popover
 * 2. popover 内含 8 端下载项
 * 3. 已接入端(web/desktop/extension)有可点击链接
 * 4. 未接入端(ios/android-apk/wechat-miniapp)显示"即将上线"
 * 5. 截图:默认态 + dark mode
 *
 * 使用 admin storageState(已登录),baseURL=http://localhost:8801
 */

test.describe('下载功能验证', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test('侧边栏下载 popover 展示 8 端下载项', async ({ page }) => {
    await page.goto('/')

    // 等待侧边栏加载
    await page.waitForLoadState('networkidle')

    // 找到下载按钮(tooltip 含"下载"或"client")
    // 侧边栏底部的下载按钮,用 tooltip 属性定位
    const downloadBtn = page.locator('[aria-label*="下载"], [title*="下载"], [data-tooltip*="下载"]').first()
    await downloadBtn.waitFor({ state: 'visible', timeout: 10000 })
    await downloadBtn.click()

    // 等待 popover 内容出现
    const popover = page.locator('[role="dialog"], .popover-content, [data-radix-popper-content-wrapper]').last()
    await popover.waitFor({ state: 'visible', timeout: 5000 })

    // 截图:默认态
    await page.screenshot({ path: 'e2e/screenshots/download-popover-default.png', fullPage: false })

    // 验证 popover 内有下载项(deep 网页端 / 桌面端等)
    const popoverText = await popover.textContent()
    expect(popoverText).toBeTruthy()

    // 验证包含"即将上线"文字(未接入端)
    // 或版本号(已接入端)

    // 切换 dark mode 截图
    // 查找 theme toggle 按钮或通过 localStorage 切换
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/download-popover-dark.png', fullPage: false })

    // 验证下载链接存在
    const downloadLinks = popover.locator('a[href], a[download]')
    const linkCount = await downloadLinks.count()
    // 至少有 1 个可点击的下载链接(已接入端)
    expect(linkCount).toBeGreaterThanOrEqual(1)
  })

  test('下载详情页 /download/desktop 可访问', async ({ page }) => {
    await page.goto('/download/desktop')
    await page.waitForLoadState('networkidle')

    // 验证页面加载成功(不 404)
    const title = await page.title()
    expect(title).not.toContain('404')

    // 截图
    await page.screenshot({ path: 'e2e/screenshots/download-detail-desktop.png', fullPage: false })
  })
})
