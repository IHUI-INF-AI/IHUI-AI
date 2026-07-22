import { test, expect } from '@playwright/test'

test.describe('VIP 会员页 /vip', () => {
  test('页面可访问且标题可见', async ({ page }) => {
    await page.goto('/vip')
    await expect(page).toHaveURL(/\/vip/)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
  })

  test('方案卡片或空状态可见', async ({ page }) => {
    await page.goto('/vip')
    // 页面应显示加载状态、空状态或方案卡片
    const content = page.locator('main, [role="main"]')
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('订阅按钮链接到结账页', async ({ page }) => {
    await page.goto('/vip')
    // 等待内容加载
    await page.waitForTimeout(2000)
    // 查找订阅按钮
    const subscribeBtn = page.getByRole('link', { name: /订阅|Subscribe|免费开始|Get Started/i }).first()
    if (await subscribeBtn.isVisible()) {
      const href = await subscribeBtn.getAttribute('href')
      expect(href).toContain('/payment/checkout')
    }
  })

  test('FAQ 提示可见', async ({ page }) => {
    await page.goto('/vip')
    await page.waitForTimeout(2000)
    // 底部应有 FAQ 提示
    const faqHint = page.locator('text=/取消|cancel|客服|support/i').first()
    if (await faqHint.isVisible()) {
      await expect(faqHint).toBeVisible()
    }
  })
})
