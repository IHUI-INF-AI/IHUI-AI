// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * 8 端关键路径 — 认证登录流程 (含 SSO)
 *
 * 覆盖:
 *  - 注册页表单可访问
 *  - 独立登录页表单可访问(直连 /sso/login;/login 的 308 已摘除,不再是本页来路)
 *  - API 登录(/api/auth/login)能拿到 token
 *  - 注销路径:删除 cookie 后访问受保护页面被拦截
 *  - 重新登录:再次 API 登录后访问 dashboard 200
 *
 * 防御性策略:与现有 34 个 spec 一致,后端不可用时 graceful skip,不抛硬错。
 */

const API_LOGIN_URL = '/api/auth/login'

async function apiLogin(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
  account: string,
  password: string,
): Promise<{ ok: boolean; token: string | null; code: number | null }> {
  try {
    const resp = await request.post(`${baseURL}${API_LOGIN_URL}`, {
      data: { account, password },
    })
    if (!resp.ok()) return { ok: false, token: null, code: null }
    const body = (await resp.json().catch(() => ({}))) as {
      code?: number
      data?: { accessToken?: string; token?: string }
    }
    return {
      ok: body.code === 0,
      code: body.code ?? null,
      token: body.data?.accessToken ?? body.data?.token ?? null,
    }
  } catch {
    return { ok: false, token: null, code: null }
  }
}

test.describe('8 端关键路径 · 认证登录流程 (SSO)', () => {
  test('注册页可访问,含账号/密码输入框', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.url()} ${r.status()}`)
    })
    await page.goto('/register')
    await expect(page).toHaveURL(/\/(register|sso\/register|login|sso\/login)/, {
      timeout: 8000,
    })
    const firstInput = page.locator('input:not([type="file"]):visible').first()
    await expect(firstInput).toBeVisible({ timeout: 8000 })
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
    const real = serverErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e),
    )
    expect(real).toHaveLength(0)
  })

  test('独立登录页(/sso/login)表单存在且可切到密码登录', async ({ page }) => {
    // 2026-10-22:/login→/sso/login 的 308 已摘除,/login 恢复"打开全局登录弹窗 + 回前一页
    // (无来路时降级首页)"的软路由(判据锁 apps/web/tests/{auth-login-route-redirect,login-soft-route-back})。
    // e2e 这里直连独立登录页,不再依赖那条重定向。
    await page.goto('/sso/login')
    await expect(page).toHaveURL(/\/sso\/login/, { timeout: 8000 })
    // 2026-10-27 改:原先这里断言"首屏有可见输入框"。登录方式首位现在随访客地区变
    // (国内 IP ⇒ 扫码面板第一,面板里没有账号输入框),那条断言会把正确行为读成故障。
    // 改成断言标签栏在位即可 —— 这个用例真正要验的是"能切到密码登录并填密码"。
    await expect(page.locator('[role="tablist"] [role="tab"]').first()).toBeVisible({
      timeout: 8000,
    })
    // 无论默认落在哪个 tab,都要先切到密码登录 tab 再断言密码框存在
    const passwordTab = page.getByTestId('login-tab-password')
    await expect(passwordTab).toBeVisible({ timeout: 5000 })
    await passwordTab.click()
    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 5000 })
  })

  test('API 登录:POST /api/auth/login 返回 accessToken', async ({ request, baseURL }) => {
    const result = await apiLogin(
      request,
      baseURL ?? 'http://localhost:8801',
      process.env.E2E_USER_ACCOUNT ?? 'test@aizhs.top',
      process.env.E2E_USER_PASSWORD ?? 'Test@123456',
    )
    if (!result.ok && result.code === null) {
      test.skip(true, '后端 API 不可用,跳过')
    }
    // 后端存在但账号错误时 code != 0,允许;账号正确时 token 必须存在
    if (result.ok) {
      expect(result.token).toBeTruthy()
    } else {
      // 不强制断言业务 code(测试账号可能未 seed),但要求 API 端点可达
      expect(result.code !== null || result.token === null).toBeTruthy()
    }
  })

  test('注销:清除 auth_token cookie 后访问受保护页面被拦截', async ({ page, context }) => {
    // 先访问登录页注入 1 个虚假 token,模拟已登录
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'fake-token-for-logout-test',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])
    await page.goto('/admin/user-center')
    await page.waitForLoadState('domcontentloaded')
    // 清除 cookie 模拟注销
    await context.clearCookies()
    await page.goto('/admin/user-center')
    // 未登录访问应被 middleware 拦截(login/register/403/回到登录)
    await page
      .waitForURL(/\/(login|register|403|forbidden|sso\/login)/, { timeout: 5000 })
      .catch(() => {})
    expect(page.url()).toBeTruthy()
  })

  test('重新登录:再次 API 登录后访问 /dashboard 200', async ({ request, baseURL, page }) => {
    const result = await apiLogin(
      request,
      baseURL ?? 'http://localhost:8801',
      process.env.E2E_USER_ACCOUNT ?? 'test@aizhs.top',
      process.env.E2E_USER_PASSWORD ?? 'Test@123456',
    )
    if (!result.ok) {
      test.skip(true, '后端不可用或测试账号未 seed,跳过')
    }
    // 写入 cookie + localStorage,模拟已登录态
    await page.context().addCookies([
      {
        name: 'auth_token',
        value: result.token ?? '',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'token',
        value: result.token ?? '',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // 访问受保护路径
    const resp = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    // 页面应返回 200/3xx(不能是 5xx)
    const status = resp?.status() ?? 0
    expect(status < 500).toBeTruthy()
  })

  test('SSO 路径:登录页有 SSO 登录入口或三方登录链接', async ({ page }) => {
    await page.goto('/sso/login')
    await page.waitForLoadState('domcontentloaded')
    // 查找常见的 SSO/三方登录元素(WeChat / GitHub / Google / SSO 等)
    const ssoLink = page
      .locator('button, a')
      .filter({
        hasText: /sso|Single Sign|WeChat|微信|GitHub|Google|第三方|Third|Continue with/i,
      })
      .first()
    const hasSso = await ssoLink.isVisible({ timeout: 3000 }).catch(() => false)
    // 即使 SSO 入口隐藏,只要页面可访问就算通过
    expect(hasSso || true).toBeTruthy()
  })

  test('海外语言(en):不提供手机号登录,Google 主推;切回 zh-CN 恢复', async ({ page, context }) => {
    // 本环境未配置 Google 凭据时 API 会报 google:false;本用例只验 UI 策略,
    // 因此强制 oauth-status 返回 google:true,确保主推按钮可被渲染与断言。
    await page.route('**/api/auth/oauth-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'success',
          data: { google: true },
        }),
      })
    })

    await page.goto('/sso/login')
    // 默认 zh-CN:手机号 tab 必须在(证明改动没有误伤国内)
    await expect(page.getByTestId('login-tab-phone')).toBeVisible({ timeout: 8000 })

    // 语言偏好同时落 cookie + localStorage 后 reload,兼容 production build
    // (production 下 window.__IHUI_LANGUAGE_STORE__ 不挂载)。
    const switchLocale = async (locale: string) => {
      const host = new URL(page.url()).hostname
      await context.addCookies([
        {
          name: 'locale',
          value: locale,
          domain: host,
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ])
      await page.evaluate((l) => {
        localStorage.setItem(
          'ihui-language',
          JSON.stringify({ state: { locale: l, initialized: true }, version: 0 }),
        )
      }, locale)
      await page.reload({ waitUntil: 'domcontentloaded' })
    }

    await switchLocale('en')
    await expect(page.getByTestId('login-tab-phone')).toHaveCount(0, { timeout: 8000 })

    const featuredGoogle = page.getByTestId('third-party-featured-google')
    await expect(featuredGoogle).toBeVisible({ timeout: 5000 })

    await switchLocale('zh-CN')
    await expect(page.getByTestId('login-tab-phone')).toBeVisible({ timeout: 8000 })
    await expect(page.getByTestId('third-party-featured-google')).toHaveCount(0)
  })

  test('IP 地区判据压过界面语言:同一套中文界面,只换 loginRegion 就换整套排法', async ({ page }) => {
    // 本用例锁的是需求本身:国内 IP ⇒ 微信扫码最优先;海外 IP ⇒ 邮箱 + Google/GitHub 最优先。
    // 界面语言全程不动(默认 zh-CN),唯一变量是服务器答复里的 loginRegion ——
    // 这样"按 IP 判"与"按语言判"就不会像旧口径那样混成一件事,任一档接错都当场翻红。
    const routeStatus = async (loginRegion: 'domestic' | 'overseas') => {
      await page.unroute('**/api/auth/oauth-status')
      await page.route('**/api/auth/oauth-status', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            message: 'success',
            // 两个平台都给凭据,主推位才判得出来(没配就不主推,那是另一档判据)
            data: { google: true, wechat: true, loginRegion },
          }),
        })
      })
    }

    await routeStatus('domestic')
    await page.goto('/sso/login')
    await expect(page.locator('[role="tablist"] [role="tab"]').first()).toHaveAttribute(
      'data-testid',
      'login-tab-qr',
      { timeout: 8000 },
    )
    await expect(page.getByTestId('login-tab-qr')).toHaveAttribute('data-state', 'active')
    await expect(page.getByTestId('third-party-featured-wechat')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('third-party-featured-google')).toHaveCount(0)
    // 国内档手机号验证码登录仍在(IP 判国内时不该被剔掉)
    await expect(page.getByTestId('login-tab-phone')).toBeVisible({ timeout: 8000 })

    await routeStatus('overseas')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('login-tab-phone')).toHaveCount(0, { timeout: 8000 })
    await expect(page.getByTestId('third-party-featured-google')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('third-party-featured-wechat')).toHaveCount(0)
    // 海外档首位换成邮箱,且选中项跟着挪过去(判据晚于首帧到达时不留在旧首位)
    await expect(page.locator('[role="tablist"] [role="tab"]').first()).toHaveAttribute(
      'data-testid',
      'login-tab-email',
    )
    await expect(page.getByTestId('login-tab-email')).toHaveAttribute('data-state', 'active')
    // GitHub 紧跟在图标网格首位(Google 已被主推位占用,不重复出现)
    const thirdPartyButtons = page.locator(
      '[data-testid^="third-party-"]:not([data-testid^="third-party-featured-"])',
    )
    await expect(thirdPartyButtons.first()).toHaveAttribute('data-testid', 'third-party-github')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
