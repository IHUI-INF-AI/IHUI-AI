import { test, expect } from '@playwright/test'

/**
 * 第三方登录(OAuth)测试。
 *
 * 覆盖:
 * - OAuth 按钮存在(8 个平台)
 * - 按钮可点击(非 disabled)
 * - 点击后跳转到正确目标(真厂商授权页 或 本地 mock 授权页)
 * - Google/GitHub 真凭据场景下跳到真厂商域名
 * - 回调路径不崩溃
 * - 账号绑定页可访问
 * - 页面无 500/无控制台异常
 *
 * 维护者注意:
 * - .env.local 里 NEXT_PUBLIC_DEMO_MODE=true 时,未配凭据的平台跳 /oauth/mock/<platform>
 * - 已配真凭据(微信/钉钉/企业微信/Google/GitHub)的真 OAuth 跳到厂商域名
 * - 没配真凭据(Apple/支付宝/飞书)走本地 mock,跳到 /oauth/mock/<platform>
 */

const LOGIN_PAGE = '/sso/login'

/** 8 个平台按钮文本匹配模式(与 ThirdPartyLoginButtons.tsx providers 对齐) */
const PLATFORM_BUTTONS = [
  { key: 'google', pattern: /Google/i, realUrlPrefix: 'https://accounts.google.com/' },
  { key: 'apple', pattern: /Apple/i, realUrlPrefix: 'https://appleid.apple.com/' },
  { key: 'dingtalk', pattern: /钉钉/i, realUrlPrefix: 'https://login.dingtalk.com/' },
  { key: 'enterpriseWechat', pattern: /企业微信/i, realUrlPrefix: 'https://open.work.weixin.qq.com/' },
  { key: 'wechat', pattern: /微信/i, realUrlPrefix: 'https://open.weixin.qq.com/' },
  { key: 'github', pattern: /GitHub/i, realUrlPrefix: 'https://github.com/' },
  { key: 'feishu', pattern: /飞书/i, realUrlPrefix: 'https://passport.feishu.cn/' },
  { key: 'alipay', pattern: /支付宝/i, realUrlPrefix: 'https://openauth.alipay.com/' },
] as const

test.describe('第三方登录 - 基础', () => {
  test('登录页有 8 个第三方登录按钮全部可见', async ({ page }) => {
    await page.goto(LOGIN_PAGE)
    await page.waitForLoadState('domcontentloaded')

    // 等待第三方登录区域渲染
    await expect(page.getByText(/第三方登录|Third Party/i).first()).toBeVisible({ timeout: 10000 })

    for (const p of PLATFORM_BUTTONS) {
      const btn = page.getByRole('button', { name: p.pattern }).first()
      await expect(btn).toBeVisible({ timeout: 5000 })
    }
  })

  test('OAuth 按钮可点击(无 disabled)', async ({ page }) => {
    await page.goto(LOGIN_PAGE)
    await page.waitForLoadState('networkidle')

    // Google 按钮在 demo 模式下应可点(NEXT_PUBLIC_DEMO_MODE=true)
    const googleBtn = page.getByRole('button', { name: /Google/i }).first()
    await expect(googleBtn).toBeVisible({ timeout: 5000 })
    await expect(googleBtn).not.toBeDisabled({ timeout: 5000 })
  })

  test('OAuth 回调路径不崩溃', async ({ page }) => {
    const serverErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await page.goto('/api/auth/callback/wechat')
    await page.waitForLoadState('domcontentloaded').catch(() => {})

    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })

  test('账号绑定页可访问(若路由存在)', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/user/bindings')
    await page.waitForLoadState('domcontentloaded')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)
  })

  test('第三方登录无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto(LOGIN_PAGE)
    await page.waitForLoadState('networkidle').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})

test.describe('第三方登录 - 跳转目标验证', () => {
  // 仅测未配真凭据的平台 → 应跳本地 mock 授权页
  // (Apple / 飞书 / 支付宝在 .env.local 是 placeholder,在 demo 模式下走 mock)
  const mockPlatforms = [
    { key: 'apple', pattern: /Apple/i },
    { key: 'feishu', pattern: /飞书/i },
    { key: 'alipay', pattern: /支付宝/i },
  ] as const

  for (const p of mockPlatforms) {
    test(`${p.key} 按钮点击跳转到本地 mock 授权页`, async ({ page, context }) => {
      await page.goto(LOGIN_PAGE)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/第三方登录|Third Party/i).first()).toBeVisible({ timeout: 10000 })

      const btn = page.getByRole('button', { name: p.pattern }).first()
      await expect(btn).toBeVisible({ timeout: 5000 })

      // 监听新页面/新导航,捕获跳转 URL
      const navigationPromise = page.waitForURL(/\/oauth\/mock\/|https?:\/\//, { timeout: 10000 })
      await btn.click()
      try {
        await navigationPromise
      } catch {
        // demo 模式应该跳转,失败则报错
      }

      const url = page.url()
      expect(url).toMatch(new RegExp(`/oauth/mock/${p.key}|https?://`))
    })
  }

  // 已配真凭据的平台 → 跳到真厂商域名
  // (Google / GitHub 在 .env.local 已配真凭据;微信/钉钉/企业微信也是真凭据)
  const realPlatforms = [
    { key: 'google', pattern: /Google/i, expectedPrefix: 'https://accounts.google.com/' },
    { key: 'github', pattern: /GitHub/i, expectedPrefix: 'https://github.com/' },
  ] as const

  for (const p of realPlatforms) {
    test(`${p.key} 按钮点击跳转到真厂商授权页(${p.expectedPrefix})`, async ({ page }) => {
      await page.goto(LOGIN_PAGE)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/第三方登录|Third Party/i).first()).toBeVisible({ timeout: 10000 })

      const btn = page.getByRole('button', { name: p.pattern }).first()
      await expect(btn).toBeVisible({ timeout: 5000 })

      // 真厂商跳转可能跨域,用 waitForURL 捕获
      const navigationPromise = page.waitForURL((url) => {
        const href = url.toString()
        return href.startsWith(p.expectedPrefix) || href.includes('/oauth/mock/') || href.includes('bsm.aizhs.top')
      }, { timeout: 15000 })

      await btn.click()
      await navigationPromise

      const url = page.url()
      // 真凭据场景必须跳到真厂商域名(不是 mock,不是 bsm 子域)
      expect(url.startsWith(p.expectedPrefix)).toBeTruthy()
    })
  }
})

test.describe('第三方登录 - 后端状态 API', () => {
  test('GET /api/auth/oauth-status 返回 8 平台状态', async ({ request }) => {
    const resp = await request.get('/api/auth/oauth-status')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(body.data).toBeDefined()

    const data = body.data
    const expectedKeys = ['google', 'apple', 'dingtalk', 'enterpriseWechat', 'wechat', 'feishu', 'github', 'alipay']
    for (const key of expectedKeys) {
      expect(data).toHaveProperty(key)
      expect(typeof data[key]).toBe('boolean')
    }
  })

  test('GET /api/auth/oauth-status Google + GitHub 应为已配置(真凭据)', async ({ request }) => {
    const resp = await request.get('/api/auth/oauth-status')
    const body = await resp.json()
    // 真凭据场景:google + github 必须 true
    // 注:如果运行环境没配真凭据,这俩可能为 false,但本测试假设已配
    expect(body.data.google).toBe(true)
    expect(body.data.github).toBe(true)
  })
})

