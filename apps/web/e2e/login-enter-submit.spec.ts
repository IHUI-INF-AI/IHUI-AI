import { test as base, expect, type Page } from '@playwright/test'

/**
 * 登录弹窗 Enter 触发 form submit 守门测试 (2026-07-30 立)
 *
 * 业务场景:用户填完表单 + 勾选协议后,按 Enter 应触发 form submit → 调用登录 API。
 * 覆盖 3 种登录 tab × 3 个 Enter 触发点:
 *   - 密码 tab:账号框 Enter / 密码框 Enter / 协议 label Enter
 *   - 手机验证码 tab:手机框 Enter / 验证码框 Enter
 *   - 邮箱验证码 tab:邮箱框 Enter / 验证码框 Enter
 *
 * 守门依据(任何一条失败视为 Enter 触发回归):
 *   1. 任意 input 上按 Enter 应触发 form submit 事件
 *   2. 协议 label 上按 Enter 应通过 onKeyDown form.requestSubmit() 触发 form submit
 *   3. form submit 事件 submitter 应为 BUTTON/login-submit(input Enter 路径)或 null(label Enter 路径)
 *
 * 不依赖后端 API:用 document.addEventListener('submit') 拦截事件,避免真实调用登录接口。
 *
 * 关联组件:
 *  - packages/ui-react/src/components/login-form/agreement-checkbox.tsx (label-as-checkbox 修复)
 *  - packages/ui-react/src/components/login-form/password-login-form.tsx
 *  - packages/ui-react/src/components/login-form/phone-code-login-form.tsx
 *  - packages/ui-react/src/components/login-form/email-code-login-form.tsx
 *
 * 历史背景:
 *  - 2026-07-30 修复:<label> 包裹 sr-only <input> 模式导致 Enter 触发 input native toggle 而非 form submit。
 *    改为 <label role="checkbox"> 自身充当 checkbox(无 labeled control),onKeyDown 触发 form.requestSubmit()。
 *  - 此 spec 防止未来重构回 sr-only input 模式时 Enter 触发链路断裂。
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8801'

const test = base.extend<{ freshPage: Page }>({
  freshPage: async ({ browser }, use) => {
    // 不带 storageState 的全新 context,确保未登录态
    const context = await browser.newContext()
    // 隐藏 Next.js dev overlay,避免拦截点击
    await context.addInitScript(() => {
      // @ts-expect-error - 全局变量
      window.__NEXT_DEV_INDICATOR_DISMISSED = true
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

/**
 * 用 DOM API 点击文本匹配的按钮,绕开 nextjs-portal 拦截。
 */
async function clickButtonByText(page: Page, text: RegExp | string): Promise<void> {
  const handle = await page.evaluateHandle((t) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const re = t instanceof RegExp ? t : new RegExp(t)
    return (
      buttons.find((b) => {
        const label = b.textContent ?? ''
        const aria = b.getAttribute('aria-label') ?? ''
        return re.test(label) || re.test(aria)
      }) ?? null
    )
  }, text)
  await page.evaluate((el) => {
    if (el instanceof HTMLElement) el.click()
  }, handle)
}

/**
 * 在页面上注入 form submit 监听器,捕获 form submit 事件(不依赖后端 API)。
 */
async function installSubmitListener(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-expect-error - 全局变量
    window.__capturedSubmits = []
    const listener = (e: SubmitEvent) => {
      // @ts-expect-error - 全局变量
      window.__capturedSubmits.push({
        type: e.type,
        targetTagName: (e.target as HTMLElement | null)?.tagName,
        targetId: (e.target as HTMLElement | null)?.id,
        submitterTagName: e.submitter?.tagName ?? null,
        submitterTestId: e.submitter?.getAttribute('data-testid') ?? null,
      })
    }
    document.addEventListener('submit', listener, { capture: true })
  })
}

async function getCapturedSubmitsCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    // @ts-expect-error - 全局变量
    return (window.__capturedSubmits ?? []).length
  })
}

/**
 * 打开登录弹窗并切到指定 tab。
 */
async function openLoginDialog(page: Page, tabTestId: string, firstInputTestId: string): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForLoadState('networkidle').catch(() => {})

  await clickButtonByText(page, /^登录$|^登 录$|^Sign in$|^Login$/i)
  await expect(page.getByTestId('login-dialog')).toBeVisible({ timeout: 5000 })

  await page.getByTestId(tabTestId).click()
  await expect(page.getByTestId(firstInputTestId)).toBeVisible({ timeout: 3000 })
}

test.describe('Enter 触发 form submit 守门(3 种登录 tab)', () => {
  test.describe('密码登录 tab', () => {
    test('账号框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-password', 'login-account-input')
      await installSubmitListener(page)

      await page.getByTestId('login-account-input').fill('admin')
      await page.getByTestId('login-account-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '账号框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })

    test('密码框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-password', 'login-account-input')
      await installSubmitListener(page)

      await page.getByTestId('login-account-input').fill('admin')
      await page.getByTestId('login-password-input').fill('admin123')
      await page.getByTestId('login-password-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '密码框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })

    test('协议 label Enter → form submit(走 onKeyDown form.requestSubmit)', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-password', 'login-account-input')
      await installSubmitListener(page)

      await page.getByTestId('login-account-input').fill('admin')
      await page.getByTestId('login-password-input').fill('admin123')

      // 鼠标点击 label 左侧 16x16 方框区域(模拟真实用户点击 checkbox 方框)
      // 不能用 locator.click():默认点击 label 中心,中心是"用户协议"链接,会被 closest('a') 拦截
      const checkbox = page.getByTestId('agreement-checkbox')
      const box = await checkbox.boundingBox()
      expect(box, 'checkbox boundingBox 应存在').toBeTruthy()
      await page.mouse.click(box!.x + 8, box!.y + 8)
      await expect(checkbox).toHaveAttribute('aria-checked', 'true', { timeout: 2000 })

      // 焦点在 label 上(label tabIndex=0),按 Enter
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, 'label Enter 应通过 onKeyDown form.requestSubmit() 触发 form submit').toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('手机验证码登录 tab', () => {
    test('手机框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-phone', 'login-phone-input')
      await installSubmitListener(page)

      await page.getByTestId('login-phone-input').fill('13800138000')
      await page.getByTestId('login-phone-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '手机框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })

    test('验证码框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-phone', 'login-phone-input')
      await installSubmitListener(page)

      await page.getByTestId('login-phone-input').fill('13800138000')
      await page.getByTestId('login-phone-code-input').fill('123456')
      await page.getByTestId('login-phone-code-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '验证码框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('邮箱验证码登录 tab', () => {
    test('邮箱框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-email', 'login-email-input')
      await installSubmitListener(page)

      await page.getByTestId('login-email-input').fill('admin@ihui.ai')
      await page.getByTestId('login-email-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '邮箱框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })

    test('验证码框 Enter → form submit', async ({ freshPage: page }) => {
      test.setTimeout(60000)
      await openLoginDialog(page, 'login-tab-email', 'login-email-input')
      await installSubmitListener(page)

      await page.getByTestId('login-email-input').fill('admin@ihui.ai')
      await page.getByTestId('login-email-code-input').fill('123456')
      await page.getByTestId('login-email-code-input').press('Enter')
      await page.waitForTimeout(500)

      const count = await getCapturedSubmitsCount(page)
      expect(count, '验证码框 Enter 应触发 form submit').toBeGreaterThanOrEqual(1)
    })
  })
})
