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
    // /login 会被中间件重定向到 /sso/login(统一登录);两者都接受
    await page.goto('/login')
    await expect(page).toHaveURL(/\/(sso\/)?login/)
    // 任意可见 input 即可(SSO 页用 type=text, 密码登录用 type=tel/password)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 })
  })

  test('注册页可访问', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 })
  })
})
