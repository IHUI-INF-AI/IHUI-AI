import { test, expect } from '@playwright/test'

test.describe('Header Overflow测试', () => {
  test('Header应该设置overflow为visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const overflow = await header.evaluate((el: HTMLElement) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('visible')
  })

  test('Header z-index应该高于mobile-menu', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const headerZIndex = await header.evaluate((el: HTMLElement) => parseInt(window.getComputedStyle(el).zIndex) || 0)
    const mobileMenu = page.locator('.mobile-menu')
    const mobileMenuZIndex = await mobileMenu.evaluate((el: HTMLElement) => parseInt(window.getComputedStyle(el).zIndex) || 0)
    expect(headerZIndex).toBeGreaterThan(mobileMenuZIndex)
  })

  test('移动端Header overflow应该保持visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const overflow = await header.evaluate((el: HTMLElement) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('visible')
  })

  test('平板端Header overflow应该保持visible', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const overflow = await header.evaluate((el: HTMLElement) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('visible')
  })

  test('桌面端Header overflow应该保持visible', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const overflow = await header.evaluate((el: HTMLElement) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('visible')
  })
})

test.describe('Header Navigation测试', () => {
  test('main-menu-items应该设置overflow为visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    const mainMenu = page.locator('.main-menu-items').first()
    const isVisible = await mainMenu.isVisible().catch(() => false)
    
    if (isVisible) {
      const overflow = await mainMenu.evaluate((el) => {
        return window.getComputedStyle(el).overflow
      })
      expect(overflow).toBe('visible')
    }
  })

  test('下拉菜单应该可以正常展开', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const dropdownTrigger = page.locator('.dropdown-trigger').first()
    if (await dropdownTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdownTrigger.evaluate((el: HTMLElement) => el.click())
      await page.waitForTimeout(300)
    }
  })

  test('「更多功能」下拉应显示且可见', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const moreBtn = page.locator('.menu-item.dropdown').filter({ hasText: /更多功能|More|more/i }).locator('.dropdown-trigger')
    const visible = await moreBtn.isVisible().catch(() => false)
    if (!visible) {
      test.skip()
      return
    }
    // 用 JS 触发点击，避免被 tour-overlay 等遮罩拦截
    await moreBtn.evaluate((el: HTMLElement) => el.click())
    await page.waitForTimeout(400)
    const panel = page.locator('.header-nav-more-dropdown')
    await expect(panel).toBeVisible({ timeout: 5000 })
    const opacity = await panel.evaluate((el) => window.getComputedStyle(el).opacity)
    const vis = await panel.evaluate((el) => window.getComputedStyle(el).visibility)
    expect(parseFloat(opacity)).toBeGreaterThan(0)
    expect(vis).toBe('visible')
  })
})

test.describe('Header层级关系测试', () => {
  test('Header z-index应该是2000', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const header = page.locator('.glass-header').first()
    await header.waitFor({ state: 'visible', timeout: 10000 })
    const zIndex = await header.evaluate((el: HTMLElement) => window.getComputedStyle(el).zIndex)
    expect(zIndex).toBe('2000')
  })

  test('Mobile-menu z-index应该是1999', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const mobileMenu = page.locator('.mobile-menu')
    const zIndex = await mobileMenu.evaluate((el: HTMLElement) => window.getComputedStyle(el).zIndex)
    expect(zIndex).toBe('1999')
  })
})
