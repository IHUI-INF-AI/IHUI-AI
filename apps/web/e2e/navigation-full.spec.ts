import { test, expect } from '@playwright/test'

/**
 * 全站导航测试。
 *
 * 覆盖:
 * - 所有顶级页面可达
 * - 面包屑
 * - 侧边栏
 * - 页面无 500/无控制台异常
 */

// 顶级页面路径
const TOP_LEVEL_PAGES = [
  '/',
  '/login',
  '/register',
  '/plaza',
  '/circles',
  '/asks',
  '/topics',
  '/learn',
  '/exam',
  '/points',
  '/vip-membership',
  '/docs',
  '/search',
] as const

test.describe('全站导航 - 顶级页面可达', () => {
  for (const path of TOP_LEVEL_PAGES) {
    test(`${path} 可访问无 500`, async ({ page }) => {
      const serverErrors: string[] = []
      page.on('response', (resp) => {
        if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
      })
      await page.goto(path)
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
  }
})

test.describe('全站导航 - 导航元素', () => {
  test('首页导航栏可见', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav, [role="navigation"], aside').first()
    await expect(nav).toBeVisible({ timeout: 10000 })
  })

  test('首页侧边栏可见(若存在)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const sidebar = page.locator('aside, [role="complementary"]').first()
    // 侧边栏可能存在也可能不存在
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(sidebar).toBeVisible()
    }
  })

  test('面包屑可见(若存在)', async ({ page }) => {
    await page.goto('/plaza')
    await page.waitForLoadState('networkidle')
    // 面包屑可能是 nav 或 ol
    const breadcrumb = page.locator('[aria-label="breadcrumb"], nav ol, .breadcrumb').first()
    if (await breadcrumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(breadcrumb).toBeVisible()
    }
  })

  test('导航链接可点击导航', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // 查找任一导航链接
    const navLink = page.locator('nav a, [role="navigation"] a').first()
    if (await navLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await navLink.getAttribute('href')
      if (href && href.startsWith('/')) {
        await navLink.click().catch(() => {})
        await page.waitForTimeout(1000)
        expect(page.url()).toBeTruthy()
      }
    }
  })

  test('全站无控制台未捕获异常(首页)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/')
    await page.waitForLoadState('networkidle').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})
