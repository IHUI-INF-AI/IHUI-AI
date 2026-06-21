import { test } from '@playwright/test'

test('捕获 AI世界 404 资源', async ({ page }) => {
  const failed: string[] = []
  page.on('response', resp => {
    if (resp.status() === 404) failed.push(`${resp.status()} ${resp.url()}`)
  })
  await page.goto('/ai-world', { waitUntil: 'networkidle', timeout: 20000 })
  await page.waitForTimeout(2000)
  console.log(`\nAI世界 404 资源 (${failed.length}):`)
  failed.forEach(f => console.log(`  ${f}`))
})
