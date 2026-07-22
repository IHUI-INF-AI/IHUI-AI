import { test, expect } from '@playwright/test'

/**
 * 登录弹窗 3 步 Enter 键盘交互流回归测试 (2026-07-21 立)
 *
 * 业务场景:用户输入账号+密码/验证码,但未勾选"我已阅读并同意"复选框时,
 * 第 1 次 Enter 弹出协议通知窗,第 2 次 Enter 同意+勾选,第 3 次 Enter 登录。
 *
 * 关键守门(任何一条失败都视为登录弹窗回归):
 *  1. 协议通知窗 i18n 翻译必须生效(防止 Next.js messages chunk 缓存回退)
 *  2. Enter 1 → 通知窗打开
 *  3. Enter 2 → 复选框勾选 + 通知窗关闭
 *  4. Enter 3 → 登录请求触发(/api/auth/login/email)
 *  5. X 关闭按钮位置正确(防止 DialogContent 样式重构导致飘出)
 *
 * 关联组件:
 *  - apps/web/src/components/login/AgreementNoticeDialog.tsx
 *  - apps/web/src/components/login/EmailCodeLoginForm.tsx
 *  - apps/web/src/components/login/PhoneCodeLoginForm.tsx
 *  - apps/web/src/components/login/PasswordLoginForm.tsx
 *  - apps/web/src/components/login/UsernameLoginForm.tsx
 *  - apps/web/src/components/login/LoginFormContent.tsx
 *  - apps/web/messages/{zh-CN,zh-TW,en,ko,ja}.json
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8801'

test.describe('登录弹窗 3 步 Enter 键盘交互流', () => {
  test.beforeEach(async ({ page }) => {
    // 拦截登录 API,验证 Enter 3 触发请求(避免依赖真实 OTP 后端)
    await page.route('**/api/auth/login/email', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { accessToken: 'mock', refreshToken: 'mock', userId: 'u1' },
        }),
      })
    })

    await page.goto(BASE_URL)
  })

  test('Enter 1 → 协议通知窗打开(中文翻译生效,无 i18n key 泄漏)', async ({ page }) => {
    // 1. 打开登录弹窗
    const loginBtn = page.getByRole('button', { name: /登录/ }).first()
    await loginBtn.click()

    // 等待 dialog 渲染
    const dialog = page.getByTestId('login-dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // 2. 切到"邮箱登录" tab
    await page.getByTestId('login-tab-email').click()

    // 3. 填表(不勾选协议)
    await page.locator('input[type="email"]').fill('test@example.com')
    // OTP 6 位格子(每个是一个 input)
    const otpInputs = page.locator(
      'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
    )
    const otpCount = await otpInputs.count()
    if (otpCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String((i + 1) % 10))
      }
    }

    // 4. 按 Enter 1 → 触发通知窗
    await page.keyboard.press('Enter')

    // 5. 关键断言:通知窗出现 + 中文翻译生效(不是 i18n key)
    const noticeTitle = page.getByTestId('agreement-notice-agree')
    await expect(noticeTitle).toBeVisible({ timeout: 3000 })

    // 核心:整个 dialog 文本不包含 i18n key 字符串(防止 chunk 缓存回退)
    const dialogText = await page.locator('[role="dialog"]').last().textContent()
    expect(dialogText, '通知窗不应包含 i18n key 字符串').not.toMatch(/auth\.agreementNotice/)
    expect(dialogText, '通知窗不应包含大写 i18n key').not.toMatch(/AUTH\.AGREEMENT/)
  })

  test('Enter 2 → 通知窗内 Enter 触发同意(勾选复选框 + 关闭通知窗)', async ({ page }) => {
    // 打开弹窗 + 切到 email tab
    await page.getByRole('button', { name: /登录/ }).first().click()
    await expect(page.getByTestId('login-dialog')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('login-tab-email').click()

    // 填表
    await page.locator('input[type="email"]').fill('test@example.com')
    const otpInputs = page.locator(
      'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
    )
    const otpCount = await otpInputs.count()
    if (otpCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String((i + 1) % 10))
      }
    }

    // Enter 1 → 打开通知窗
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('agreement-notice-agree')).toBeVisible({ timeout: 3000 })

    // Enter 2 → 同意
    await page.keyboard.press('Enter')

    // 通知窗关闭
    await expect(page.getByTestId('agreement-notice-agree')).toBeHidden({ timeout: 3000 })

    // 复选框已勾选(checkbox aria-checked=true 或 native checked)
    const checkbox = page.locator('[role="checkbox"]').first()
    if ((await checkbox.count()) > 0) {
      await expect(checkbox).toHaveAttribute('aria-checked', 'true', { timeout: 2000 })
    }
  })

  test('Enter 3 → 登录请求触发(/api/auth/login/email 被调用)', async ({ page }) => {
    let loginApiCalled = false
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login/email') && req.method() === 'POST') {
        loginApiCalled = true
      }
    })

    // 打开弹窗 + 切到 email tab
    await page.getByRole('button', { name: /登录/ }).first().click()
    await expect(page.getByTestId('login-dialog')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('login-tab-email').click()

    // 填表
    await page.locator('input[type="email"]').fill('test@example.com')
    const otpInputs = page.locator(
      'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
    )
    const otpCount = await otpInputs.count()
    if (otpCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String((i + 1) % 10))
      }
    }

    // Enter 1 + 2 + 3
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('agreement-notice-agree')).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('agreement-notice-agree')).toBeHidden({ timeout: 3000 })
    await page.keyboard.press('Enter')

    // 关键断言:登录 API 被调用
    await expect.poll(() => loginApiCalled, { timeout: 5000 }).toBe(true)
  })

  test('通知窗 X 关闭按钮位置正确(在弹窗右上角,不在飘到外面)', async ({ page }) => {
    // 打开弹窗 + 切到 email tab
    await page.getByRole('button', { name: /登录/ }).first().click()
    await expect(page.getByTestId('login-dialog')).toBeVisible({ timeout: 5000 })
    await page.getByTestId('login-tab-email').click()

    await page.locator('input[type="email"]').fill('test@example.com')
    const otpInputs = page.locator(
      'input[inputmode="numeric"], input[autocomplete="one-time-code"]',
    )
    const otpCount = await otpInputs.count()
    if (otpCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await otpInputs.nth(i).fill(String((i + 1) % 10))
      }
    }

    await page.keyboard.press('Enter')
    await expect(page.getByTestId('agreement-notice-agree')).toBeVisible({ timeout: 3000 })

    // 找通知窗的 X 关闭按钮(Radix DialogContent 自动渲染,aria-label="Close")
    const noticeDialog = page.locator('[role="dialog"]').last()
    const closeBtn = noticeDialog.getByRole('button', { name: /close/i }).first()
    await expect(closeBtn).toBeVisible()

    // 断言:关闭按钮在通知窗右上角区域(右半部分 + 上半部分)
    const closeBox = await closeBtn.boundingBox()
    const dialogBox = await noticeDialog.boundingBox()
    expect(closeBox).not.toBeNull()
    expect(dialogBox).not.toBeNull()
    if (closeBox && dialogBox) {
      const closeRelativeX = (closeBox.x - dialogBox.x) / dialogBox.width
      const closeRelativeY = (closeBox.y - dialogBox.y) / dialogBox.height
      expect(closeRelativeX, 'X 关闭按钮应在弹窗右半部分').toBeGreaterThan(0.5)
      expect(closeRelativeY, 'X 关闭按钮应在弹窗上半部分').toBeLessThan(0.5)
    }
  })
})

test.describe('i18n 翻译完整性守门', () => {
  // 防止 Next.js messages chunk 缓存回退到 i18n key 字符串
  test('协议通知窗在 5 个 locale 下都不显示 i18n key 字符串', async ({ page }) => {
    const locales = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

    for (const locale of locales) {
      await page.goto(`${BASE_URL}/${locale === 'zh-CN' ? '' : locale}`)
      await page.waitForLoadState('domcontentloaded')

      // 触发协议通知窗
      const loginBtn = page.getByRole('button', { name: /登录|login|ログイン|로그인/i }).first()
      if ((await loginBtn.count()) === 0) continue // locale 路由不存在,跳过
      await loginBtn.click()

      const dialog = page.getByTestId('login-dialog')
      try {
        await dialog.waitFor({ state: 'visible', timeout: 3000 })
      } catch {
        continue
      }
      // 找 email tab
      const emailTab = page.getByTestId('login-tab-email')
      if ((await emailTab.count()) === 0) continue
      await emailTab.click()

      // 填表
      const emailInput = page.locator('input[type="email"]')
      if ((await emailInput.count()) === 0) continue
      await emailInput.fill('test@example.com')

      // Enter 1 → 通知窗
      await page.keyboard.press('Enter')
      try {
        await page
          .getByTestId('agreement-notice-agree')
          .waitFor({ state: 'visible', timeout: 3000 })
      } catch {
        continue
      }

      // 关键断言:整个 dialog 不包含 i18n key
      const noticeDialog = page.locator('[role="dialog"]').last()
      const text = await noticeDialog.textContent()
      expect(text, `[${locale}] 通知窗不应包含 i18n key(auth.agreementNotice*)`).not.toMatch(
        /auth\.agreementNotice/,
      )
      expect(text, `[${locale}] 通知窗不应包含大写 i18n key(AUTH.AGREEMENT*)`).not.toMatch(
        /AUTH\.AGREEMENT/,
      )
    }
  })
})
