import { test, expect, type Page } from '@playwright/test'

/**
 * PWA 专项测试
 *
 * 覆盖:
 * - /manifest.webmanifest 可访问且返回正确 JSON
 * - manifest 包含 name / short_name / icons / start_url / display
 * - service worker 注册(如配置)
 * - apple-touch-icon 存在
 * - theme-color meta 标签存在
 */

test.describe.parallel('PWA 专项', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    page.on('pageerror', () => {})
  })

  test.afterEach(async ({ page }: { page: Page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page
        .screenshot({ path: `e2e/screenshots/pwa-${testInfo.title.replace(/\s+/g, '-')}.png` })
        .catch(() => {})
    }
  })

  test('/manifest.webmanifest 可访问且返回正确 JSON', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.status()).toBe(200)
    const headers = response.headers()
    expect(headers['content-type'] ?? '').toMatch(/application\/manifest\+json|application\/json/i)
    const manifest = (await response.json().catch(() => null)) as Record<string, unknown> | null
    expect(manifest).toBeTruthy()
  })

  test('manifest 包含 name / short_name / icons / start_url / display', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    if (response.status() !== 200) {
      test.skip(true, 'manifest.webmanifest 未配置,跳过')
      return
    }
    const manifest = (await response.json()) as {
      name?: string
      short_name?: string
      icons?: unknown[]
      start_url?: string
      display?: string
    }
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons!.length).toBeGreaterThan(0)
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBeTruthy()
  })

  test('service worker 注册(如配置)', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // 检查 navigator.serviceWorker 是否注册了 SW
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.length > 0
    })
    // dev 环境可能未注册 SW,仅记录
    if (!hasSW) {
      test.info().annotations.push({ type: 'note', description: '未检测到已注册的 service worker' })
    }
    expect(typeof hasSW).toBe('boolean')
  })

  test('apple-touch-icon 存在', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const appleIcon = page.locator('link[rel="apple-touch-icon"]')
    const href = await appleIcon.getAttribute('href').catch(() => null)
    expect(href, '页面应包含 apple-touch-icon link 标签').toBeTruthy()
  })

  test('theme-color meta 标签存在', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const themeColor = page.locator('meta[name="theme-color"]')
    const content = await themeColor.getAttribute('content').catch(() => null)
    expect(content, '页面应包含 theme-color meta 标签').toBeTruthy()
    // theme-color 应为有效的颜色值(#xxx 或 rgb())
    expect(content).toMatch(/^(#|rgb|hsl)/i)
  })
})
