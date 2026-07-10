import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

// 注: /chat-history 重定向测试和 /conversation 公开页测试已统一迁移到 route-guard.spec.ts

test('AIChat 大组件按需懒加载（modulePreload 排除）', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const preloads = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('link[rel="modulepreload"]')).map(
      (l) => l.getAttribute('href') || ''
    )
  })
  const hasAIChatPreload = preloads.some((href) => /AIChat/i.test(href))
  expect(hasAIChatPreload, 'AIChat 不得被 modulePreload（应按需加载）').toBe(false)
})
