/**
 * 关键流程 E2E：开放平台→售卖区锚点、VIP→订单入口、登录页→设置重定向
 * 不依赖真实登录态，仅验证导航与锚点可达
 */
import { test, expect } from '@playwright/test'
import { gotoStable, LONG_TIMEOUT } from './helpers/page-actions'

test.describe('关键流程', () => {
  test.setTimeout(45000)

  test('开放平台进入后能到达售卖区锚点', async ({ page }) => {
    await gotoStable(page, '/open', { waitSelector: '.open-platform-container', timeout: 25000 })
    await page.goto('/open#sale-license', { waitUntil: 'load', timeout: 15000 })
    await expect(page).toHaveURL(/#sale-license/)
    await expect(page.locator('#sale-license, #sale-intro').first()).toBeVisible({ timeout: 8000 })
  })

  test('开放平台首屏可点击「立即开始」滚动到 feature-hub', async ({ page }) => {
    await gotoStable(page, '/open', { waitSelector: '.open-platform-container', timeout: 25000 })
    const cta = page.getByRole('button', { name: /立即开始|Get Started|開始/ }).first()
    await cta.click()
    await expect(page.locator('#feature-hub')).toBeInViewport({ timeout: 5000 })
  })

  test('开放平台售卖区导航可到达定价区块', async ({ page }) => {
    await gotoStable(page, '/open#sale-pricing', { timeout: 25000 })
    await expect(page).toHaveURL(/#sale-pricing/)
    await expect(page.locator('#sale-pricing')).toBeVisible({ timeout: 8000 })
  })

  test('VIP 页加载且含订阅/升级 CTA', async ({ page }) => {
    await gotoStable(page, '/vip', { timeout: 25000 })
    await expect(page).toHaveURL(/\/vip/)
    await page.waitForSelector('.vip-container, [class*="vip"], main', { timeout: LONG_TIMEOUT })
    const cta = page.getByRole('button', { name: /订阅|升级|开通|Subscribe|Upgrade/ }).first()
    await expect(cta).toBeVisible({ timeout: 8000 })
  })

  // 注: /settings 和 /dashboard 路由保护测试已统一迁移到 route-guard.spec.ts
})
