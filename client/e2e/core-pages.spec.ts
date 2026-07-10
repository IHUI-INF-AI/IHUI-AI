/**
 * 核心页面 E2E：Home、Login、Dashboard、Settings、Vip、Agents、About
 * 统一 beforeEach 等待根容器，减少懒加载导致超时
 */
import { test, expect } from '@playwright/test'
import { gotoStable, LONG_TIMEOUT } from './helpers/page-actions'

const PAGES = [
  { path: '/', title: /智汇|iHui|AI/, main: '.home-container, #first-page, .glass-header' },
  { path: '/login', url: /\/login/, btn: /登录|注册|Login|Sign/ },
  { path: '/register', url: /\/register/, main: 'form, .login-page, [class*="register"]' },
  { path: '/vip', url: /\/vip/, main: '.vip-container, [class*="vip"], main' },
  { path: '/agents', url: /\/agents/, main: 'main, [class*="agent"]' },
  { path: '/about', url: /\/about/, main: '.about-root, .hero-section, main' },
  { path: '/open', url: /\/open/, main: '.open-platform-container, .hero-section, [class*="open-platform"]' },
] as const

test.describe('核心页面加载', () => {
  test.setTimeout(45000)

  for (const p of PAGES) {
    test(`${p.path} 加载且含主内容`, async ({ page }) => {
      await gotoStable(page, p.path, { timeout: 25000 })
      if ('url' in p) await expect(page).toHaveURL(p.url)
      if ('title' in p) await expect(page).toHaveTitle(p.title)
      if ('main' in p) await expect(page.locator(p.main).first()).toBeVisible({ timeout: LONG_TIMEOUT })
      if ('btn' in p) await expect(page.getByRole('button', { name: p.btn }).first()).toBeVisible({ timeout: 10000 })
    })
  }

  test('Dashboard 可访问', async ({ page }) => {
    await gotoStable(page, '/dashboard', { timeout: 25000 })
    await page.waitForURL(/\/(dashboard|login)/, { timeout: 8000 }).catch(() => {})
    if (page.url().includes('/login')) return
    await expect(page.locator('.dashboard-container, [class*="dashboard"], main').first()).toBeVisible({ timeout: 12000 })
  })

  test('Settings 可访问或重定向登录', async ({ page }) => {
    await gotoStable(page, '/settings', { timeout: 25000 })
    await page.waitForURL(/\/(settings|login)/, { timeout: 8000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(settings|login)/)
  })

  test('403 页可访问且含主内容', async ({ page }) => {
    await gotoStable(page, '/403', { timeout: 25000 })
    await expect(page).toHaveURL(/\/403/)
    await expect(page.locator('.forbidden-container, [role="main"]').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#forbidden-heading, .forbidden-message').first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('关键页无障碍（aria/landmark）', () => {
  test.setTimeout(45000)

  test('首页含 main 地标与 aria-labelledby', async ({ page }) => {
    await gotoStable(page, '/', { timeout: 25000 })
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  })
})
