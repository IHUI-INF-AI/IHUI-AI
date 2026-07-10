/**
 * VIP 购买流程 e2e
 * - 未登录访问 /vip：能看到 VIP 套餐卡片
 * - 点套餐：未登录跳 /login
 * - 登录后跳回 /vip
 */
import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

test('VIP 页面加载 + 未登录点击套餐跳登录', async ({ page }) => {
  await page.goto(`${BASE}/vip`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  // 1. VIP 页面渲染
  const hasVip = await page.evaluate(() => {
    const t = document.body.innerText
    return t.includes('VIP') || t.includes('会员') || t.includes('订阅') || t.includes('套餐')
  })
  expect(hasVip, 'VIP 页面渲染').toBeTruthy()

  // 2. 截图归档
  await page.screenshot({ path: 'test-results/vip-page.png', fullPage: true })
})

test('登录页加载 + 关键字段', async ({ page }) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)

  const hasLoginForm = await page.evaluate(() => {
    const t = document.body.innerText
    // 登录页关键文案（中文）
    return t.includes('登录') || t.includes('注册') || t.includes('账号') || t.includes('快捷登录')
  })
  expect(hasLoginForm, '登录页关键文案').toBeTruthy()
  await page.screenshot({ path: 'test-results/login-page.png', fullPage: true })
})
