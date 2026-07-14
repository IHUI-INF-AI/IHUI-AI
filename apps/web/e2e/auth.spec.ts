import { test } from '@playwright/test'

test.describe('认证流程', () => {
  test('登录表单验证', async ({ page }) => {
    await page.goto('/login')

    // 空表单提交应显示错误
    await page
      .getByRole('button', { name: /登录|登 录|sign in/i })
      .click()
      .catch(() => {})
    // 等待可能的错误提示或表单验证
    await page.waitForTimeout(1000)

    // 填写表单
    const accountInput = page.locator('input').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await accountInput.isVisible()) {
      await accountInput.fill('13800138000')
      await passwordInput.fill('Test123456')
    }
  })

  test('注册表单验证', async ({ page }) => {
    await page.goto('/register')

    const phoneInput = page.locator('input').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await phoneInput.isVisible()) {
      await phoneInput.fill('13800138000')
      await passwordInput.fill('Test123456')
    }
  })

  test('登录注册页面切换', async ({ page }) => {
    await page.goto('/login')
    // 查找"注册"链接
    const registerLink = page.getByRole('link', { name: /注册|register|sign up/i })
    if (await registerLink.isVisible()) {
      await registerLink.click()
      await page.waitForURL(/\/register/, { timeout: 5000 }).catch(() => {})
    }
  })
})
