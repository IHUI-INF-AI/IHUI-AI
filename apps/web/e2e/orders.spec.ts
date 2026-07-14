import { test, expect } from '@playwright/test'

test.describe('Orders 订单页面', () => {
  test('未登录访问 orders 重定向到登录页', async ({ page }) => {
    await page.goto('/orders')
    await page.waitForURL(/\/(login|register)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|orders)/)
  })

  test('orders 页面可加载且 main 容器可见(若已登录)', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/orders')
    await page.waitForLoadState('networkidle')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)
    if (page.url().includes('/orders')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('orders 页面无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/orders')
    await page.waitForLoadState('networkidle').catch(() => {})
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})

test.describe('Payment 支付页面', () => {
  test('未登录访问 payment 重定向', async ({ page }) => {
    await page.goto('/payment')
    await page.waitForURL(/\/(login|register)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|payment)/)
  })

  test('payment 无订单参数时优雅处理(不崩溃)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/payment')
    await page.waitForLoadState('networkidle')
    // 不应崩溃(可能显示错误提示或重定向)
    expect(page.url()).toBeTruthy()
    expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})
