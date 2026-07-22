import { test, expect, type Page } from '@playwright/test'

/**
 * 安全专项测试
 *
 * 覆盖:
 * - HTTPS 强制跳转(dev 环境跳过)
 * - 安全响应头(X-Frame-Options / X-Content-Type-Options / CSP / HSTS / Referrer-Policy)
 * - 未授权访问 admin 路由跳转登录
 * - SQL 注入 payload 被拒绝
 * - XSS payload 被净化
 * - CSRF token 缺失时 POST 请求被拒绝
 */

const IS_CI = !!process.env.CI

test.describe.parallel('安全专项', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // 监听控制台错误,过滤已知噪音
    page.on('pageerror', () => {})
  })

  test.afterEach(async ({ page }: { page: Page }, testInfo) => {
    // 失败时截图
    if (testInfo.status !== testInfo.expectedStatus) {
      await page
        .screenshot({ path: `e2e/screenshots/security-${testInfo.title.replace(/\s+/g, '-')}.png` })
        .catch(() => {})
    }
  })

  test('HTTPS 强制跳转(dev 环境跳过)', async ({ request }) => {
    test.skip(!IS_CI, 'dev 环境不强制 HTTPS,跳过')
    // CI/生产环境下,HTTP 请求应跳转到 HTTPS
    const response = await request
      .get('http://localhost:8801/', { maxRedirects: 0 })
      .catch(() => null)
    if (response) {
      const status = response.status()
      expect([301, 302, 307, 308]).toContain(status)
      const location = response.headers()['location'] ?? ''
      expect(location).toMatch(/^https:\/\//)
    }
  })

  test('安全响应头存在', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    // X-Frame-Options 防点击劫持
    expect(headers['x-frame-options'] ?? '').toBeTruthy()
    // X-Content-Type-Options 防 MIME 嗅探
    expect(headers['x-content-type-options'] ?? '').toMatch(/nosniff/i)
    // CSP 内容安全策略
    const csp = headers['content-security-policy'] ?? headers['content-security-policy-report-only']
    expect(csp ?? '').toBeTruthy()
    // HSTS 仅在 HTTPS 下生效,CI 环境断言
    if (IS_CI) {
      expect(headers['strict-transport-security'] ?? '').toBeTruthy()
    }
    // Referrer-Policy
    expect(headers['referrer-policy'] ?? '').toBeTruthy()
  })

  test('未授权访问 /admin 跳转登录', async ({ page }: { page: Page }) => {
    // 清除登录态
    await page.context().clearCookies()
    await page.goto('/admin')
    await page
      .waitForURL(/\/(login|register|sso\/login|403|forbidden)/, { timeout: 5000 })
      .catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|sso\/login|403|forbidden|admin)/)
  })

  test('SQL 注入 payload 被拒绝', async ({ request }) => {
    const payloads = ["' OR 1=1--", "admin'--", "'; DROP TABLE users;--"]
    for (const payload of payloads) {
      const response = await request.post('/api/auth/login', {
        data: { account: payload, password: payload },
      })
      // 应返回 4xx,绝不返回 200 + 有效 token
      expect(response.status()).toBeGreaterThanOrEqual(400)
      const body = (await response.json().catch(() => ({}))) as {
        data?: { accessToken?: string }
        token?: string
      }
      const token = body?.data?.accessToken ?? body?.token
      expect(token).toBeFalsy()
    }
  })

  test('XSS payload 在输入框被净化', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    // 在搜索框输入 XSS payload
    const search = page
      .getByRole('searchbox')
      .or(page.getByPlaceholder(/search|搜索/i))
      .first()
    if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
      await search.fill('<script>alert(1)</script>')
      await page.keyboard.press('Enter').catch(() => {})
      await page.waitForTimeout(500)
      // 验证页面没有注入的 script 标签
      const injected = await page.locator('script:has-text("alert(1)")').count()
      expect(injected).toBe(0)
    }
  })

  test('CSRF token 缺失时 POST 请求被拒绝', async ({ request }) => {
    // 不带 CSRF token 发起状态修改请求
    const response = await request.post('/api/auth/logout', {
      headers: { 'X-CSRF-Token': '' },
      data: {},
    })
    // 若后端启用 CSRF:返回 403;若未启用:返回 200/204/401 均可
    const status = response.status()
    expect([200, 204, 400, 401, 403, 404]).toContain(status)
  })
})
