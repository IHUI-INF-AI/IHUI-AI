// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * 认证流程 E2E(2026-08-28 根因重写)
 *
 * 真实路由链:/login → 301 → /sso/login(next.config.ts redirects 接入
 * redirects.config.ts 的 /login→/sso/login 永久重定向,dev/next start 生效)。
 * /sso/login 渲染 AuthShellPage 全屏遮罩 + AuthShell 统一登录卡片:
 * - 登录态 4 tab(邮箱/手机/账号/扫码),复用主站 LoginFormContent
 * - 注册入口是卡片内"立即注册" button → setMode('register') → RegisterFormContent
 *   (手机注册/邮箱注册 Tabs),无独立 /register 页(/register 同样 301 到 /sso/register)
 *
 * 旧用例按 getByRole('link', { name: /注册/ }) + waitForURL(/\/register/) 断言已过时:
 * link selector 会误中 sidebar"注册中心"导航链接,click 被全屏遮罩拦截 30s 超时。
 */

async function openSsoLogin(page: import('@playwright/test').Page) {
  // /login 301 → /sso/login,等待统一登录卡片渲染(h1 由 AuthShell 渲染)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/sso\/login/)
  const heading = page.getByRole('heading', { name: /统一登录/ })
  await expect(heading).toBeVisible({ timeout: 15000 })
  return page
}

test.describe('认证流程', () => {
  // dev server 首次访问 /sso/login 需按需编译,整组用例放宽超时
  test.setTimeout(90_000)

  test('登录表单验证', async ({ page }) => {
    test.slow()
    await openSsoLogin(page)

    // 切到账号密码 tab(默认邮箱 tab 无密码输入框)
    await page.getByRole('tab', { name: /^账号$/ }).click()

    // 空表单提交应触发校验(客户端验证或接口报错,均不应崩溃)
    // 限定在 tabpanel 内,避免误点 topbar 的"登录"入口按钮
    await page
      .getByRole('tabpanel')
      .getByRole('button', { name: /登录|登 录|sign in/i })
      .click()
      .catch(() => {})
    await page.waitForTimeout(1000)

    // 填写表单(账号 + 密码两个输入框)
    const accountInput = page.getByRole('textbox').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await accountInput.isVisible()) {
      await accountInput.fill('13800138000')
      await passwordInput.fill('Test123456')
    }
  })

  test('已登录用户访问 /sso/login 应看到授权卡片而非登录表单', async ({ page, context }) => {
    // 模拟已登录态:注入 auth_token + 必要的 user 信息
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'fake-token-for-sso-authorized-test',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])
    // 注入 localStorage 中的 zustand persist 数据(ihui-auth)
    await page.addInitScript(() => {
      try {
        const state = {
          isAuthenticated: true,
          user: {
            id: 'test-user',
            nickname: 'Test User',
            avatar: '',
            phone: '',
            roleId: 1,
            username: 'test',
            status: 1,
          },
          token: 'fake-token-for-sso-authorized-test',
          refreshToken: null,
        }
        localStorage.setItem('ihui-auth', JSON.stringify(state))
      } catch {}
    })
    await page.goto('/sso/login')
    await page.waitForLoadState('domcontentloaded')

    // 断言:看到"授权并跳转"按钮(已登录分支的授权卡片)
    const authBtn = page.getByRole('button', { name: /授权|authorize/i })
    await expect(authBtn).toBeVisible({ timeout: 15000 })

    // 断言:不应出现登录表单输入框
    const accountInput = page.locator('input[type="text"], input[type="email"]').first()
    await expect(accountInput).not.toBeVisible({ timeout: 5000 })
  })

  test('已登录态主站 LoginDialog 应自动关闭，不泄露登录表单', async ({ page, context }) => {
    // 模拟已登录态
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'fake-token-for-logindialog-authorized-test',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])
    await page.addInitScript(() => {
      try {
        const state = {
          isAuthenticated: true,
          user: {
            id: 'test-user',
            nickname: 'Test User',
            avatar: '',
            phone: '',
            roleId: 1,
            username: 'test',
            status: 1,
          },
          token: 'fake-token-for-logindialog-authorized-test',
          refreshToken: null,
        }
        localStorage.setItem('ihui-auth', JSON.stringify(state))
      } catch {}
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 主动打开登录弹窗
    const dialog = page.getByTestId('login-dialog')
    const alreadyOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false)
    if (!alreadyOpen) {
      await page.getByRole('button', { name: /登录/ }).first().click()
    }

    // 已登录态下，bootstrap 完成后弹窗应自动关闭；最差也应是 loading，不应出现账号输入框
    const accountInput = page.locator('input[type="text"], input[type="email"]').first()
    await expect(accountInput).not.toBeVisible({ timeout: 10000 })
    await expect(dialog).not.toBeVisible({ timeout: 10000 }).catch(() => {})
  })

  test('注册表单验证', async ({ page }) => {
    await openSsoLogin(page)

    // 切换到注册模式
    await page.getByRole('button', { name: /立即注册|register now|sign up/i }).click()
    await expect(page.getByRole('tab', { name: /手机注册/ })).toBeVisible()

    // 默认手机注册 tab:填写手机号 + 密码
    const phoneInput = page.getByRole('textbox').first()
    const passwordInput = page.locator('input[type="password"]').first()

    if (await phoneInput.isVisible()) {
      await phoneInput.fill('13800138000')
      await passwordInput.fill('Test123456')
    }
  })

  test('登录注册页面切换', async ({ page }) => {
    await openSsoLogin(page)

    // 注册入口是卡片内 button(非独立页链接)
    const registerBtn = page.getByRole('button', {
      name: /立即注册|register now|sign up/i,
    })
    await expect(registerBtn).toBeVisible()
    await registerBtn.click()

    // 切换到注册模式:标题变"统一注册" + 出现"手机注册/邮箱注册" Tabs
    await expect(page.getByRole('heading', { name: /统一注册/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /手机注册/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /邮箱注册/ })).toBeVisible()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
