// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, ADMIN_USER } from './fixtures'

/**
 * admin 登录落点 —— 真实浏览器端到端守门(AGENTS §17)
 *
 * 业务契约(单一真相源 `apps/web/src/lib/post-login-landing.ts`):
 *   - admin 账号(`roleId >= 1`)在**无显式 redirect** 时,登录完成后落到生产在线监控大屏
 *     `/admin/monitor/wallboard`;
 *   - 带**显式 redirect** 时,原样回到该目标(大屏落点绝不旁路显式目标)。
 *
 * 与 vitest 单测互补:单测覆盖各落点的判据分支,本 spec 用真实浏览器验证
 * 「真实提交登录 → 落点决策 → 真实导航」。
 *
 * ⚠️ 本机 dev 环境事实(影响断言方式,非本特性缺陷):
 *   `apps/api/.env` 设了 `COOKIE_DOMAIN=.aizhs.top`,于是登录响应下发的 httpOnly
 *   `auth_token` 带 `Domain=.aizhs.top`;而 e2e 访问的是 `localhost:8801`,域不匹配 →
 *   浏览器拒收该 cookie → `proxy.ts` 的 `/admin/*` 登录守卫 307 打回 `/sso/login`。
 *   生产环境 web 源就是 aizhs.top,域匹配,cookie 正常落盘,守卫放行。
 *   故此处拆两条真实浏览器断言:
 *     - 「真实密码登录」测:断言**落点决策** = 大屏(可观测证据 = SSO 页对落点目标发起的
 *       守卫探测请求),不依赖 cookie 域是否匹配;
 *     - 「已登录授权跳转」测:用**有效 localhost 会话**注入(见 e2e/fixtures.ts),
 *       让守卫真放行,断言**最终 URL** 真落到大屏。
 */

const WALLBOARD = /\/admin\/monitor\/wallboard/
const AUTHORIZE_BUTTON = /授权并跳转|授权|Authorize/i

/** 打开 SSO 登录页 → 账号密码 tab → 填 admin 凭据 → 勾协议(勾不上走 notice-dialog 兜底)。 */
async function preparePasswordLogin(page: import('@playwright/test').Page, query = '') {
  await page.goto(`/sso/login${query}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await page.getByTestId('login-tab-password').click({ timeout: 20_000 })
  const account = page.locator('#login-form-account')
  await expect(account).toBeVisible({ timeout: 15_000 })
  await account.fill(ADMIN_USER.account)
  await page.getByTestId('login-password-input').fill(ADMIN_USER.password)
  const box = page.getByTestId('agreement-checkbox-box')
  if (await box.count()) {
    await box
      .first()
      .click({ timeout: 3_000 })
      .catch(() => null)
  }
}

/** 提交登录;弹出协议提示框时点「同意」后再提交一次。 */
async function submitLogin(page: import('@playwright/test').Page) {
  await page.getByTestId('login-submit').click({ timeout: 15_000 })
  const noticeAgree = page.getByTestId('agreement-notice-agree')
  if (await noticeAgree.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await noticeAgree.click()
    await page.getByTestId('login-submit').click({ timeout: 15_000 })
  }
}

test.describe('admin 登录落点(真实浏览器)', () => {
  test('真实密码登录:admin 落点决策 = 生产在线监控大屏', async ({ page }) => {
    test.setTimeout(90_000)
    await preparePasswordLogin(page)

    // 登录成功后,SSO 页会先对落点目标发起守卫探测(HEAD)——以此作为"落点决策 = 大屏"
    // 的真实浏览器可观测证据(与本机 cookie 域是否匹配无关)。
    const probe = page.waitForRequest(
      (req) =>
        req.url().includes('/admin/monitor/wallboard') &&
        (req.method() === 'HEAD' || req.method() === 'GET'),
      { timeout: 40_000 },
    )
    await submitLogin(page)
    const req = await probe
    expect(req.url(), 'admin 登录后的落点目标应为大屏').toContain('/admin/monitor/wallboard')

    // 登录确实成功:页面转入"已登录"授权卡(而非仍是登录表单)
    await expect(page.getByRole('button', { name: AUTHORIZE_BUTTON }).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('已登录 admin 授权跳转 ⇒ 落到生产在线监控大屏(真实导航)', async ({ adminPage }) => {
    test.setTimeout(90_000)
    await adminPage.goto('/sso/login', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const authorize = adminPage.getByRole('button', { name: AUTHORIZE_BUTTON }).first()
    await expect(authorize).toBeVisible({ timeout: 30_000 })
    await authorize.click()
    await expect(adminPage).toHaveURL(WALLBOARD, { timeout: 30_000 })
  })

  test('已登录 admin 带显式 redirect ⇒ 回到显式目标,不被大屏旁路', async ({ adminPage }) => {
    test.setTimeout(90_000)
    await adminPage.goto('/sso/login?redirect=/settings', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })
    const authorize = adminPage.getByRole('button', { name: AUTHORIZE_BUTTON }).first()
    await expect(authorize).toBeVisible({ timeout: 30_000 })
    await authorize.click()
    await expect(adminPage).toHaveURL(/\/settings/, { timeout: 30_000 })
    await expect(adminPage).not.toHaveURL(WALLBOARD)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
