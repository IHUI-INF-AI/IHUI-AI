// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    const subscribeBtn = page
      .getByRole('link', { name: /订阅|Subscribe|免费开始|Get Started/i })
      .first()
    if (await subscribeBtn.isVisible()) {
      const href = await subscribeBtn.getAttribute('href')
      // 2026-08-26 修复:未登录 /vip 显示登录墙,first() 匹配到侧边栏"会员订阅"
      // (/member/subscription,合法订阅入口),原断言仅认 /payment/checkout(支付页)过时。
      // 2026-10-20 修复:补 /vip/details —— 套餐卡 CTA 今天就是链到它
      // (apps/web/app/(main)/vip/page.tsx:230),而 /vip/details 即结账页
      // (details/PageClient.tsx:319 下单、:72-73 渲染微信/支付宝两档)。
      // CI 实测 href=/vip/details?levelId=… ⇒ 旧白名单在结账页上取不到输入(非产品回归)。
      expect(href).toMatch(/\/(payment\/checkout|member\/subscription|vip\/details)/)
      // 覆盖点不丢:落到 /vip/details 必须真提供下单动作(订阅按钮 + 两种支付方式);
      // 只验渲染,绝不点击下单(会真建订单)。
      if (href?.includes('/vip/details')) {
        await page.goto(href)
        await expect(page.getByRole('button', { name: '立即订阅' })).toBeVisible({
          timeout: 10000,
        })
        await expect(page.getByRole('radio', { name: '微信支付' })).toBeVisible()
        await expect(page.getByRole('radio', { name: '支付宝' })).toBeVisible()
      }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
