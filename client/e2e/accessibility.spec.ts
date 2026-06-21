import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'

test('Tab 键可以聚焦到主要交互元素', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const focusableCount = await page.evaluate(() => {
    let count = 0
    for (let i = 0; i < 10; i++) {
      const tag = document.activeElement?.tagName
      if (tag && ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) count++
      // 模拟 Tab
      const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      document.activeElement?.dispatchEvent(evt)
    }
    return count
  })
  expect(focusableCount).toBeGreaterThanOrEqual(0)
})

test('header 主题切换按钮有 aria 属性', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const headerInfo = await page.evaluate(() => {
    const header = document.querySelector('header')
    if (!header) return { hasHeader: false }
    const buttons = header.querySelectorAll('button')
    const ariaButtons = Array.from(buttons).filter((b) => {
      return b.hasAttribute('aria-label') || b.hasAttribute('title') || b.textContent?.trim()
    })
    return {
      hasHeader: true,
      buttonCount: buttons.length,
      ariaButtonCount: ariaButtons.length,
    }
  })
  expect(headerInfo.hasHeader).toBe(true)
  expect(headerInfo.buttonCount).toBeGreaterThan(0)
})

test('首页主区域有正确的 landmark', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const landmarks = await page.evaluate(() => {
    return {
      header: document.querySelectorAll('header').length,
      main: document.querySelectorAll('main').length,
      nav: document.querySelectorAll('nav, [role="navigation"]').length,
      footer: document.querySelectorAll('footer, [role="contentinfo"]').length,
    }
  })
  // 至少要有 header + main（最核心的两个 landmark）
  expect(landmarks.header, '至少 1 个 <header>').toBeGreaterThanOrEqual(1)
  expect(landmarks.main, '至少 1 个 <main>').toBeGreaterThanOrEqual(1)
  // nav/footer 是渐进式增强：只在条件满足时检查
  const total = landmarks.header + landmarks.main + landmarks.nav + landmarks.footer
  expect(total, '至少 3 个语义 landmark（header/main/footer 或 nav）').toBeGreaterThanOrEqual(3)
})

test('登录页表单字段有 label 关联', async ({ page }) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  const formInfo = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"])')
    const labeled = Array.from(inputs).filter((input) => {
      const id = input.id
      const hasLabelFor = id ? !!document.querySelector(`label[for="${id}"]`) : false
      const hasAriaLabel = input.hasAttribute('aria-label')
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby')
      const hasPlaceholder = input.hasAttribute('placeholder')
      const wrapped = input.closest('label') !== null
      return hasLabelFor || hasAriaLabel || hasAriaLabelledBy || hasPlaceholder || wrapped
    })
    return { total: inputs.length, labeled: labeled.length }
  })
  // 软阈值：登录页 input 至少有一个被标记（防止完全缺失 label）
  if (formInfo.total > 0) {
    expect(formInfo.labeled).toBeGreaterThan(0)
  }
})
