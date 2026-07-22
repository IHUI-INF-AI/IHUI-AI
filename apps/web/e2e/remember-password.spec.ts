import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

async function openLoginDialog(page: Page) {
  await page.goto(BASE_URL)
  await page.waitForLoadState('domcontentloaded')
  await page.getByRole('button', { name: '登录', exact: true }).first().click()
  await page.waitForSelector('[data-testid="login-dialog"]', { timeout: 10000 })
}

async function switchToPasswordTab(page: Page) {
  await page.getByTestId('login-tab-password').click()
  // 用 #account selector 等待密码表单渲染,比 getByLabel 更稳定
  await page.waitForSelector('#account', { timeout: 10000 })
}

test.describe('记住密码功能', () => {
  test('密码登录表单显示记住密码复选框(默认未勾选)', async ({ page }) => {
    await openLoginDialog(page)
    await switchToPasswordTab(page)

    const checkbox = page.getByTestId('remember-password-checkbox')
    await expect(checkbox).toBeVisible()
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  test('勾选记住密码后复选框状态正确', async ({ page }) => {
    await openLoginDialog(page)
    await switchToPasswordTab(page)

    const checkbox = page.getByTestId('remember-password-checkbox')
    await checkbox.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')

    // 再点一次取消勾选
    await checkbox.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  })

  test('记住密码复选框样式与协议复选框一致(16x16 方形)', async ({ page }) => {
    await openLoginDialog(page)
    await switchToPasswordTab(page)

    const checkbox = page.getByTestId('remember-password-checkbox')
    const box = await checkbox.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBe(16)
    expect(box!.height).toBe(16)

    // 验证圆角不是 rounded-full
    const borderRadius = await checkbox.evaluate((el) => {
      return window.getComputedStyle(el).borderRadius
    })
    expect(parseFloat(borderRadius)).toBeLessThanOrEqual(4)
  })

  test('勾选记住密码后复选框状态 + 表单可填写', async ({ page }) => {
    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 勾选记住密码
    await page.getByTestId('remember-password-checkbox').click()

    // 填写表单
    await page.locator('#account').fill('testuser_remember')
    await page.locator('#password').fill('TestPass123!')

    // 验证 localStorage 当前没有凭据(登录成功后才保存)
    const beforeLogin = await page.evaluate(() => {
      return localStorage.getItem('ihui-remember-credentials')
    })
    expect(beforeLogin).toBeNull()

    // 验证复选框勾选状态正确
    const checkbox = page.getByTestId('remember-password-checkbox')
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  test('有已保存凭据时自动填充 + 复选框默认勾选', async ({ page }) => {
    // 先写入模拟凭据
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify({ account: 'saveduser', password: 'SavedPass1' }))))
      localStorage.setItem('ihui-remember-credentials', data)
    })

    await openLoginDialog(page)
    await switchToPasswordTab(page)

    // 验证自动填充:账号和密码应该已填入
    const accountValue = await page.locator('#account').inputValue()
    const passwordValue = await page.locator('#password').inputValue()
    expect(accountValue).toBe('saveduser')
    expect(passwordValue).toBe('SavedPass1')

    // 验证记住密码复选框默认勾选(因为有已保存凭据)
    const checkbox = page.getByTestId('remember-password-checkbox')
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })

  test('i18n 翻译完整性(5 语言 rememberPassword 键存在)', async () => {
    // 直接检查 JSON 文件,不依赖 UI 交互(dev server 下多 locale 页面加载太慢)
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')
    const locales = ['zh-CN', 'en', 'zh-TW', 'ko', 'ja']
    for (const locale of locales) {
      const filePath = resolve(process.cwd(), 'messages', `${locale}.json`)
      const data = JSON.parse(readFileSync(filePath, 'utf8'))
      expect(data.auth?.rememberPassword, `${locale} missing auth.rememberPassword`).toBeTruthy()
    }
  })
})
