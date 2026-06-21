import { test } from '@playwright/test'

test('捕获所有页面通用JS错误', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('WebSocket') && !msg.text().includes('vite')) {
      errors.push(msg.text())
    }
  })
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForTimeout(2000)
  console.log(`\n首页 JS错误 (${errors.length}):`)
  errors.forEach(e => console.log(`  ${e}`))
})
