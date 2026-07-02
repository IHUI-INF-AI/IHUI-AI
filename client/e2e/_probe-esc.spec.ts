import { test, expect } from '@playwright/test'

const TRIGGER_PILL = '.ai-capability-selector .tw-selector-pill'

test('probe esc behavior', async ({ page }) => {
  const allLogs: string[] = []
  page.on('console', (msg) => {
    allLogs.push(`[${msg.type()}] ${msg.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => allLogs.push(`[pageerror] ${String(e).slice(0, 300)}`))
  page.on('requestfailed', (req) => {
    allLogs.push(`[reqfail] ${req.url()} ${req.failure()?.errorText}`)
  })

  // === openAIDialogMaximized inline ===
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(async () => {
    const n = await page.evaluate(() => {
      const app = document.getElementById('app')
      return app ? app.childElementCount : 0
    })
    expect(n).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(300)
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
  const sidePanel = page.locator('.ai-side-panel')
  await expect(sidePanel).toBeVisible({ timeout: 12000 })

  const selectModelBtn = page.locator('.ai-side-panel button:has-text("选择模型")').first()
  if (await selectModelBtn.isVisible().catch(() => false)) {
    await selectModelBtn.click({ force: true })
    await page.waitForTimeout(1500)
    await page.mouse.click(20, 20)
    await page.waitForTimeout(800)
  }
  const pill = page.locator(TRIGGER_PILL)
  await expect(pill).toBeVisible({ timeout: 8000 })

  // Check if useSubViewDropdown module loaded
  const modInfo = await page.evaluate(async () => {
    try {
      const mod = await import('/src/composables/useSubViewDropdown.ts')
      return {
        loaded: true,
        hasFunction: typeof mod.useSubViewDropdown === 'function',
        keys: Object.keys(mod),
      }
    } catch (e) {
      return { loaded: false, error: String(e) }
    }
  })
  console.log('MODULE INFO:', JSON.stringify(modInfo, null, 2))

  // Check if useSubViewDropdown was called (look for the console.log)
  const subViewLogs = allLogs.filter(l => l.includes('useSubViewDropdown'))
  console.log('SUBVIEW LOGS:', JSON.stringify(subViewLogs, null, 2))

  // All errors
  const errors = allLogs.filter(l => l.includes('[pageerror]') || l.includes('[error]'))
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 10), null, 2))

  await page.screenshot({ path: 'test-results/_probe-esc.png' })
})
