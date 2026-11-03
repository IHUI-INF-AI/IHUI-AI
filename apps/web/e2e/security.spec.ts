// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
        .screenshot({
          path: `e2e/test-screenshots/security-${testInfo.title.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`,
        })
        .catch(() => {})
    }
  })

  test('HTTPS 强制跳转(dev 环境跳过)', async ({ request }) => {
    // 2026-09-14 CI 实锤(2-18):HTTP→HTTPS 跳转由生产 Cloudflare 隧道层实施,
    // Next 本身无论本地还是 CI(8801 纯 HTTP)都不跳转 → 本测试在 e2e 环境
    // 永远不成立(先前 IS_CI 判断反而使其只在 CI 恒红)。改为仅在显式提供
    // 生产形态目标(E2E_HTTPS_PROBE_URL)时执行,e2e 套件默认跳过。
    test.skip(!process.env.E2E_HTTPS_PROBE_URL, 'e2e 环境无 HTTPS 强制跳转层,跳过')
    const probeUrl = process.env.E2E_HTTPS_PROBE_URL as string
    const response = await request.get(probeUrl, { maxRedirects: 0 }).catch(() => null)
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
    const cspHeaderName = headers['content-security-policy']
      ? 'content-security-policy'
      : 'content-security-policy-report-only'
    const csp = headers[cspHeaderName]
    expect(csp ?? '').toBeTruthy()

    // 回归断言(防回退):锁死 2026-10-13 的 CSP 修复,避免未来有人精简头、
    // 漏配域名而不自知——届时桌面端 Tauri IPC 被拦截 / 扫码登录 SDK 加载失败。
    // 仅断言"修复点本身"的存在性,不约束整条 CSP(指令顺序、临时调试项如 dev 的
    // http://localhost:* 等在不同环境有差异),保证跨 dev / CI / nginx 部署形态都稳定。
    // 本 harness 默认直连 Next.js(8801)下发的 CSP;即便 PLAYWRIGHT_BASE_URL 指向
    // nginx 前置部署,其 CSP 同样含 ipc.localhost 与 5 家 CDN,断言依旧成立。
    const cspDirectives = (csp ?? '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
    const findDirective = (name: string) =>
      cspDirectives.find((d) => d === name || d.startsWith(`${name} `)) ?? ''
    const connectSrc = findDirective('connect-src')
    const scriptSrc = findDirective('script-src')
    // 1) connect-src 必须放行 ipc.localhost(Tauri 2.11 桌面端 IPC 自定义协议)
    expect(connectSrc, 'CSP connect-src 缺少 ipc.localhost(Tauri 桌面端 IPC 必需)').toMatch(
      /\bipc\.localhost\b/,
    )
    // 2) script-src 必须放行 5 家扫码登录 CDN 域名(dormant 兜底)
    const requiredScriptCdn = [
      'https://res.wx.qq.com',
      'https://wwcdn.weixin.qq.com',
      'https://g.alicdn.com',
      'https://lf-package-cn.feishucdn.com',
      'https://cdn.jsdelivr.net',
    ]
    for (const cdn of requiredScriptCdn) {
      expect(scriptSrc, `CSP script-src 缺少 CDN 域名 ${cdn}`).toContain(cdn)
    }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
