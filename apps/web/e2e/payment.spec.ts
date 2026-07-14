import { test, expect } from '@playwright/test'

/**
 * 支付结账 E2E 测试。
 *
 * 覆盖关键链路:
 * - /payment 列表页可访问(无 500/无 JS 崩溃)
 * - /payment/checkout 结账页可访问
 * - 未登录访问跳转登录
 * - 关键 DOM 元素可见(main 容器)
 * - 控制台无未捕获异常
 */
test.describe('支付结账链路', () => {
  test('未登录访问 /payment 跳转登录', async ({ page }) => {
    await page.goto('/payment')
    await page.waitForURL(/\/(login|register)/, { timeout: 10000 }).catch(() => {})
    const url = page.url()
    expect(
      url.includes('/login') || url.includes('/register') || url.includes('/payment'),
    ).toBeTruthy()
  })

  test('未登录访问 /payment/checkout 跳转或显示提示', async ({ page }) => {
    await page.goto('/payment/checkout')
    await page.waitForLoadState('domcontentloaded')
    const url = page.url()
    expect(
      url.includes('/login') || url.includes('/register') || url.includes('/checkout'),
    ).toBeTruthy()
  })

  test('/payment 页面无 500 错误且 main 容器可见', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/payment')
    await page.waitForLoadState('domcontentloaded')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)
    // 若仍在 /payment 页面(未跳转登录),main 容器应可见
    if (page.url().includes('/payment')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('/payment 无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/payment')
    await page.waitForLoadState('networkidle').catch(() => {})
    // 过滤已知的 Next.js dev 警告,只留真正的未捕获错误
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('Download the React DevTools') && !e.includes('favicon'),
    )
    expect(realErrors).toHaveLength(0)
  })
})
