// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * 认证流程 E2E(2026-08-28 根因重写)
 *
 * 落点:/sso/login 直连。/login 一度被 redirects.config.ts 的 308 整页顶到这里,
 * 该条已于 2026-10-22 摘除(/login 恢复"打开全局登录弹窗 + 回前一页"的软路由语义,
 * 判据锁 apps/web/tests/auth-login-route-redirect.test.ts);/sso/login 页面本身不变。
 * /sso/login 渲染 AuthShellPage 全屏遮罩 + AuthShell 统一登录卡片:
 * - 登录态 4 tab(邮箱/手机/账号/扫码),复用主站 LoginFormContent
 * - 注册入口是卡片内"立即注册" button → setMode('register') → RegisterFormContent
 *   (手机注册/邮箱注册 Tabs),无独立 /register 页(/register 同样 301 到 /sso/register)
 *
 * 旧用例按 getByRole('link', { name: /注册/ }) + waitForURL(/\/register/) 断言已过时:
 * link selector 会误中 sidebar"注册中心"导航链接,click 被全屏遮罩拦截 30s 超时。
 */

async function openSsoLogin(page: import('@playwright/test').Page) {
  // 直连 /sso/login(旧路径 /login 的 308 已于 2026-10-22 摘除,它现在是弹窗软路由)
  await page.goto('/sso/login')
  await expect(page).toHaveURL(/\/sso\/login/)
  // 判据认"登录卡片到位"这件事,不认话术档位:/sso/login 无显式 redirect 时是普通登录口径
  // (「登录」),带 redirect 的子项目回跳仍是「统一登录」。此前只认后者,靠的是 bootstrap
  // 未就绪那一瞬骨架期仍渲染 sso:title —— 竞态绿灯,不是证据。
  const heading = page.getByRole('heading', { name: /登录/ })
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

    // 切换到注册模式:标题含「注册」+ 出现「手机注册/邮箱注册」Tabs。
    // 2026-10-22:/sso/login 无显式 redirect 时按「本站自己人」出普通文案(「注册」),
    // 带 redirect 的子项目回跳仍是「统一注册」⇒ 判据认"切到注册态"这件事,不认话术档位。
    await expect(page.getByRole('heading', { name: /注册/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /手机注册/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /邮箱注册/ })).toBeVisible()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
