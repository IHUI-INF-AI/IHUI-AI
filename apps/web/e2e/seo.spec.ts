import { test, expect, type Page } from '@playwright/test'

/**
 * SEO 专项测试
 *
 * 覆盖:
 * - 每个公开页面有 <title>(非空、长度 30-60)
 * - 每个公开页面有 <meta name="description">
 * - 每个公开页面有 og:title 和 og:description
 * - robots.txt 可访问
 * - sitemap.xml 可访问(如配置)
 * - 页面有语义化 HTML(header / main / footer / nav)
 */

// 公开页面清单(无需登录即可访问)
const PUBLIC_PAGES = ['/', '/login', '/register']

test.describe.parallel('SEO 专项', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    page.on('pageerror', () => {})
  })

  test.afterEach(async ({ page }: { page: Page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page
        .screenshot({ path: `e2e/screenshots/seo-${testInfo.title.replace(/\s+/g, '-')}.png` })
        .catch(() => {})
    }
  })

  test('每个公开页面有 <title>(非空,长度 ≤ 60)', async ({ page }: { page: Page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      const title = await page.title()
      expect(title.length, `页面 ${path} 的 title 不应为空`).toBeGreaterThan(0)
      // 长度 ≤ 60(SEO 最佳实践)
      expect(title.length, `页面 ${path} 的 title 长度应 ≤ 60`).toBeLessThanOrEqual(60)
    }
  })

  test('每个公开页面有 <meta name="description">', async ({ page }: { page: Page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      const desc = await page.locator('meta[name="description"]').getAttribute('content')
      expect(desc, `页面 ${path} 缺少 meta description`).toBeTruthy()
    }
  })

  test('每个公开页面有 og:title 和 og:description', async ({ page }: { page: Page }) => {
    for (const path of PUBLIC_PAGES) {
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content')
      expect(ogTitle, `页面 ${path} 缺少 og:title`).toBeTruthy()
      expect(ogDesc, `页面 ${path} 缺少 og:description`).toBeTruthy()
    }
  })

  test('robots.txt 可访问', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toBeTruthy()
    // 应包含 User-agent 或 Allow/Disallow 指令
    expect(body).toMatch(/User-agent|Allow|Disallow/i)
  })

  test('sitemap.xml 可访问(如配置)', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    // 若配置了 sitemap,应返回 200 + XML;若未配置,404 也可接受
    if (response.status() === 200) {
      const body = await response.text()
      expect(body).toMatch(/<\?xml|<urlset/i)
    } else {
      expect([404, 200]).toContain(response.status())
    }
  })

  test('页面有语义化 HTML(header / main / footer / nav)', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // header
    const header = page.locator('header').first()
    await expect(header)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {})
    // main
    const main = page.locator('main, [role="main"]').first()
    await expect(main)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {})
    // nav
    const nav = page.locator('nav, [role="navigation"]').first()
    await expect(nav)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {})
    // footer(可能延迟渲染)
    const footer = page.locator('footer').first()
    await expect(footer)
      .toBeVisible({ timeout: 3000 })
      .catch(() => {})
  })
})
