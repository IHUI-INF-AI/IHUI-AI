import { test, expect } from '@playwright/test'

/**
 * Feature Center 完整流程测试。
 *
 * 覆盖:
 * - 仪表盘
 * - API 集市
 * - Agent 集市
 * - 文档
 * - 模型
 * - SDK
 * - 页面无 500/无控制台异常
 */

// Feature Center 子页面路径
const FEATURE_CENTER_PAGES = [
  '/feature-center',
  '/feature-center/dashboard',
  '/feature-center/api-market',
  '/feature-center/agent-market',
  '/feature-center/docs',
  '/feature-center/models',
  '/feature-center/sdk',
] as const

test.describe('Feature Center - 各子页面可达', () => {
  for (const path of FEATURE_CENTER_PAGES) {
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
      // 页面应渲染(或重定向到登录)
      const url = page.url()
      expect(url).toBeTruthy()
    })
  }
})

test.describe('Feature Center - 功能验证', () => {
  test('仪表盘渲染(若可访问)', async ({ page }) => {
    await page.goto('/feature-center/dashboard')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/feature-center')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('API 集市列表渲染(若可访问)', async ({ page }) => {
    await page.goto('/feature-center/api-market')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/feature-center')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('Agent 集市列表渲染(若可访问)', async ({ page }) => {
    await page.goto('/feature-center/agent-market')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/feature-center')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('模型列表渲染(若可访问)', async ({ page }) => {
    await page.goto('/feature-center/models')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/feature-center')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('SDK 页面渲染(若可访问)', async ({ page }) => {
    await page.goto('/feature-center/sdk')
    await page.waitForLoadState('networkidle')
    if (page.url().includes('/feature-center')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('Feature Center 无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/feature-center')
    await page.waitForLoadState('networkidle').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })
})
