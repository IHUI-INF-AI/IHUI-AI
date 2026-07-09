import { test, expect } from '@playwright/test'

test.describe('冒烟测试', () => {
  test('首页可访问', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/IHUI|AI/i)
  })

  test('导航栏可见', async ({ page }) => {
    await page.goto('/')
    // 检查侧边栏或导航存在
    const nav = page.locator('nav, [role="navigation"], aside').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('登录页可访问', async ({ page }) => {
    await page.goto('/login')
    // 检查登录表单存在
    await expect(page.locator('input[type="text"], input[type="tel"], input[name="phone"], input[name="account"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('注册页可访问', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[type="text"], input[type="tel"], input[name="phone"]').first()).toBeVisible({ timeout: 10000 })
  })
})
