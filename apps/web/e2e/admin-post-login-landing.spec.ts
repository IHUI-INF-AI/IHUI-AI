// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, ADMIN_USER } from './fixtures'
import type { Page } from '@playwright/test'

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

// 大屏落点有两个等价形态:路由 `/admin/monitor/wallboard`,与它入库后的同页呈现
// `/admin/monitor/panels?view=wallboard`(前者现在是客户端 replace 过去)。
// 只认前者的话,`toHaveURL` 必须抢在 replace 之前那一瞬才命中 ⇒ 用例随时翻红;两形态都收才稳。
const WALLBOARD = /\/admin\/monitor\/(wallboard|panels\?view=wallboard)/
const AUTHORIZE_BUTTON = /授权并跳转|授权|Authorize|进入网站/i
const OAUTH_STATUS = '/api/auth/oauth-status'

/**
 * 打开登录页并切到账号密码 tab。
 * 首个 tab 由**异步**地区判定决定:判定未返回或返回 5xx(CI 里 `/api/auth/oauth-status` 会吃到
 * FST_UNDER_PRESSURE 503)时按 locale 兜底,境内档首个 tab 是二维码,而进入二维码面板会按产品
 * 既定流程自动弹协议通知窗 —— 遮罩会把密码 tab 的 click 拦成 20s 超时(2026-11-02/03 长期红的直接原因)。
 * 所以先等地区判定请求落地(成功/失败都算落地),再按真实用户路径处理:弹窗在场就点「同意」,
 * 不在场直接切 tab。等待全部锚定页面自身状态,不 sleep、不抬 click 超时。
 */
async function openPasswordTab(page: Page, query = '') {
  const regionSettled = page
    .waitForResponse((r) => r.url().includes(OAUTH_STATUS), { timeout: 20_000 })
    .catch(() => null)
  await page.goto(`/sso/login${query}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await regionSettled
  // 判定落地后 React 还需提交一帧才会重排 tab / 弹窗;等两帧渲染完成,而不是 sleep 固定时长。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
  // 境内兜底首屏(qr)可能弹协议窗(共享 LoginForm 那扇,或宿主自带门禁那扇)。遮罩会拦掉
  // 密码 tab 的 click,所以按真实用户路径处理:有可见弹窗就点「同意」,直到清空 —— 不 sleep、
  // 不抬 click 超时。`last()` 是因为两扇同时在场时后挂载的在更上层,点它才不会被遮罩拦住。
  for (let i = 0; i < 4; i += 1) {
    const visibleAgree = page.getByTestId('agreement-notice-agree').filter({ visible: true })
    const remaining = await visibleAgree.count()
    if (remaining === 0) break
    await visibleAgree.last().click({ timeout: 10_000 })
    await expect
      .poll(() => page.getByTestId('agreement-notice-agree').filter({ visible: true }).count(), {
        timeout: 10_000,
      })
      .toBeLessThan(remaining)
  }
  await expect(
    page.getByTestId('agreement-notice-agree').filter({ visible: true }),
    '切 tab 前不应再残留可见的协议窗遮罩',
  ).toHaveCount(0, { timeout: 10_000 })
  const passwordTab = page.getByTestId('login-tab-password')
  await expect(passwordTab, '密码 tab 应可见').toBeVisible({ timeout: 10_000 })
  await passwordTab.click({ timeout: 20_000 })
}

/** 切到账号密码 tab → 填 admin 凭据 → 勾协议(勾不上走 notice-dialog 兜底)。 */
async function preparePasswordLogin(page: Page, query = '') {
  await openPasswordTab(page, query)
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
async function submitLogin(page: Page) {
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
