// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'
import { ensureLoginDialogOpen } from './open-login-dialog'

/**
 * "记住密码"功能 E2E 验证 (2026-10-17)
 *
 * 完整流程:
 *   1. 登录页输入 admin/admin123,勾选"记住密码" → 登录成功
 *   2. 验证 localStorage 中存了账号+口令
 *   3. 清除 session token(模拟用户关闭浏览器)
 *   4. 刷新页面 → 自动登录(免重填) → 验证登录成功
 *   5. 反向:不勾选"记住密码" → localStorage 中只有账号,无口令
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8801'

const test = base.extend<{ freshPage: Page; freshContext: BrowserContext }>({
  freshContext: async ({ browser }, use) => {
    const context = await browser.newContext()
    // 隐藏 Next.js dev overlay
    await context.addInitScript(() => {
      // @ts-expect-error - 全局变量
      window.__NEXT_DEV_INDICATOR_DISMISSED = true
    })
    await use(context)
    await context.close()
  },
  freshPage: async ({ freshContext }, use) => {
    const page = await freshContext.newPage()
    await use(page)
    await page.close()
  },
})

/** 打开登录弹窗并切到密码 tab */
async function openLoginDialog(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await ensureLoginDialogOpen(page)
  await expect(page.getByTestId('login-dialog')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('login-tab-password').click()
  await expect(page.locator('#login-form-account')).toBeVisible({ timeout: 3000 })
}

/** 读取 localStorage 中 ihui-remember-credentials 的账号和口令 */
async function getStoredCredentials(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ihui-remember-credentials')
    if (!raw) return null
    try {
      return JSON.parse(raw as string)
    } catch {
      return null
    }
  })
}

/** 读取 localStorage 中 ihui-auto-login 标志 */
async function getAutoLoginFlag(page: Page): Promise<boolean | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('ihui-auto-login')
    if (raw === null) return null
    return raw === 'true' || raw === '1'
  })
}

/** 清除 session token(模拟浏览器关闭) */
async function clearSession(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('ihui-auth-session')
    localStorage.removeItem('ihui-refresh-token')
    // 也清 cookie(如果有 httpOnly 的)
    document.cookie = 'ihui_auth_session=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    document.cookie = 'ihui_refresh_token=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })
}

test.describe('"记住密码"功能验证', () => {
  test('勾选"记住密码"→ 登录 → localStorage 存了口令 → 刷新后自动登录', async ({
    freshPage: page,
  }) => {
    test.setTimeout(120000)

    // ===== 步骤 1: 打开登录页,输入 admin/admin123,勾选"记住密码" =====
    await openLoginDialog(page)

    // 勾选协议 checkbox
    const agreementCheckbox = page.getByTestId('agreement-checkbox')
    await expect(agreementCheckbox).toBeVisible({ timeout: 3000 })
    const box = await agreementCheckbox.boundingBox()
    if (box) {
      await page.mouse.click(box.x + 8, box.y + 8)
      await expect(agreementCheckbox).toHaveAttribute('aria-checked', 'true', { timeout: 2000 })
    }

    // 输入账号密码
    await page.locator('#login-form-account').fill('admin')
    await page.getByTestId('login-password-input').fill('admin123')

    // 勾选"记住密码" checkbox(2026-10-17 新增)
    const rememberCheckbox = page.getByTestId('remember-password-checkbox')
    await expect(rememberCheckbox).toBeVisible({ timeout: 3000 })
    const rememberBox = await rememberCheckbox.boundingBox()
    if (rememberBox) {
      await page.mouse.click(rememberBox.x + 8, rememberBox.y + 8)
      await expect(rememberCheckbox).toHaveAttribute('aria-checked', 'true', { timeout: 2000 })
    } else {
      // 兜底:直接 click
      await rememberCheckbox.click()
    }

    // 提交登录
    await page.getByTestId('login-submit').click()
    await page.waitForTimeout(3000)

    // ===== 步骤 2: 验证 localStorage 中存了账号+口令 =====
    const stored = await getStoredCredentials(page)
    expect(stored, 'localStorage 中 ihui-remember-credentials 应存在').toBeTruthy()
    expect((stored as any).account, '账号应为 admin').toBe('admin')
    expect((stored as any).password, '口令应为 admin123').toBe('admin123')

    // ===== 步骤 3: 验证 autoLogin 标志为 true =====
    const autoLogin = await getAutoLoginFlag(page)
    expect(autoLogin, 'ihui-auto-login 应为 true').toBe(true)

    // ===== 步骤 4: 清除 session(模拟浏览器关闭)后刷新,验证自动登录 =====
    await clearSession(page)

    // 刷新页面
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(5000)

    // 验证:页面应已自动登录(不需要手动输入密码)
    // 检查:用户 avatar / 侧栏应该显示已登录状态
    // 简单验证:不再显示登录弹窗
    const dialogVisible = await page.getByTestId('login-dialog').isVisible().catch(() => false)
    expect(dialogVisible, '自动登录后不应再显示登录弹窗').toBe(false)

    console.log('[remember-password] ✅ 勾选"记住密码" → 登录 → localStorage 存了口令 → 刷新后自动登录')
  })

  test('不勾选"记住密码"→ 登录 → localStorage 只有账号,无口令', async ({
    freshPage: page,
  }) => {
    test.setTimeout(120000)

    await openLoginDialog(page)

    // 勾选协议 checkbox
    const agreementCheckbox = page.getByTestId('agreement-checkbox')
    await expect(agreementCheckbox).toBeVisible({ timeout: 3000 })
    const box = await agreementCheckbox.boundingBox()
    if (box) {
      await page.mouse.click(box.x + 8, box.y + 8)
    }

    // 输入账号密码(不勾选"记住密码")
    await page.locator('#login-form-account').fill('admin')
    await page.getByTestId('login-password-input').fill('admin123')

    // 验证"记住密码" checkbox 默认为未勾选
    const rememberCheckbox = page.getByTestId('remember-password-checkbox')
    await expect(rememberCheckbox).toBeVisible({ timeout: 3000 })
    const rememberState = await rememberCheckbox.getAttribute('aria-checked')
    expect(rememberState, '默认应不勾选"记住密码"').toBe('false')

    // 提交登录(不勾选"记住密码")
    await page.getByTestId('login-submit').click()
    await page.waitForTimeout(3000)

    // 验证 localStorage 中只有账号,无口令
    const stored = await getStoredCredentials(page)
    expect(stored, 'localStorage 中 ihui-remember-credentials 应存在').toBeTruthy()
    expect((stored as any).account, '账号应为 admin').toBe('admin')
    expect((stored as any).password, '不勾选时口令应为空串').toBe('')

    // autoLogin 标志应为 false
    const autoLogin = await getAutoLoginFlag(page)
    expect(autoLogin, '不勾选时 ihui-auto-login 应为 false').toBe(false)

    console.log('[remember-password] ✅ 不勾选"记住密码" → localStorage 只有账号,无口令')
  })
})
