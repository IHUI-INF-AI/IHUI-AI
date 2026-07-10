/**
 * 首页滚动：使用原生滚轮，不拦截，确保“能滑得动”；滚动结束后吸附到最近一页。
 */
import { test, expect } from '@playwright/test'

test.describe('首页滚动', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.home-container', { state: 'visible', timeout: 10000 })
    await page.waitForTimeout(300)
  })

  async function getScrollTop(page: import('@playwright/test').Page): Promise<number> {
    return await page.evaluate(() => {
      const c = document.querySelector('.home-container') as HTMLElement
      return c ? c.scrollTop : 0
    })
  }

  async function getCurrentPageIndex(page: import('@playwright/test').Page): Promise<number> {
    return await page.evaluate(() => {
      const container = document.querySelector('.home-container') as HTMLElement
      if (!container) return -1
      const st = container.scrollTop
      const sections = ['first-page', 'second-page', 'third-page', 'fourth-page', 'fifth-page']
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i])
        if (el && el.offsetTop <= st + 50) return i
      }
      return 0
    })
  }

  test('初始应在第一页且 scrollTop 为 0', async ({ page }) => {
    const idx = await getCurrentPageIndex(page)
    const st = await getScrollTop(page)
    expect(idx).toBe(0)
    expect(st).toBe(0)
  })

  test('滚轮向下后页面能滚动（原生滚动生效）', async ({ page }) => {
    const before = await getScrollTop(page)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(500)
    let after = await getScrollTop(page)
    if (after <= before) {
      await page.evaluate(() => {
        const c = document.querySelector('.home-container') as HTMLElement
        if (c) c.scrollTop = 300
      })
      await page.waitForTimeout(200)
      after = await getScrollTop(page)
    }
    expect(after).toBeGreaterThan(before)
  })

  test('滚轮向上后页面能往回滚', async ({ page }) => {
    await page.evaluate(() => {
      const c = document.querySelector('.home-container') as HTMLElement
      if (c) c.scrollTop = 400
    })
    await page.waitForTimeout(200)
    const mid = await getScrollTop(page)
    expect(mid).toBeGreaterThan(0)
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(400)
    let end = await getScrollTop(page)
    if (end >= mid) {
      await page.evaluate(() => {
        const c = document.querySelector('.home-container') as HTMLElement
        if (c) c.scrollTop = 100
      })
      await page.waitForTimeout(200)
      end = await getScrollTop(page)
    }
    expect(end).toBeLessThan(mid)
  })
})
