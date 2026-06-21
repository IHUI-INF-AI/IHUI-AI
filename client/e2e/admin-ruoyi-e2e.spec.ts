import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

test.describe('管理后台 (admin-ruoyi) E2E', () => {
  test('未登录访问 /admin-ruoyi 跳登录', async ({ page }) => {
    await page.goto(`${BASE}/admin-ruoyi`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url = page.url()
    // 未登录 + requiresAdmin 应跳 /login（带 redirect）
    expect(url).toContain('/login')
  })

  test('未登录访问 /admin-ruoyi/system/user 跳登录', async ({ page }) => {
    await page.goto(`${BASE}/admin-ruoyi/system/user`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url = page.url()
    expect(url).toContain('/login')
    expect(url).toContain('redirect=')
  })

  test('未登录访问 /admin-ruoyi/system/role 跳登录', async ({ page }) => {
    await page.goto(`${BASE}/admin-ruoyi/system/role`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url = page.url()
    expect(url).toContain('/login')
  })

  test('未登录访问 /admin-ruoyi/ai/order 跳登录', async ({ page }) => {
    await page.goto(`${BASE}/admin-ruoyi/ai/order`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url = page.url()
    expect(url).toContain('/login')
  })

  test('robots.txt 排除 /admin-ruoyi/', async ({ page }) => {
    const resp = await page.goto(`${BASE}/robots.txt`)
    const text = await resp?.text() || ''
    expect(text).toContain('/admin-ruoyi/')
    // 应当被 Disallow
    expect(text).toMatch(/Disallow:\s*\/admin-ruoyi\//)
  })
})
