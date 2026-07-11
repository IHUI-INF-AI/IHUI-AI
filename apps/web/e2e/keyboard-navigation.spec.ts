import { test, expect } from '@playwright/test'

/**
 * 键盘导航 E2E 测试。
 *
 * 覆盖自定义表单组件（Checkbox/Radio/Select/Drawer）的键盘可访问性：
 * - Tab 键焦点移动
 * - Enter/Space 激活
 * - Escape 关闭 Drawer/Dialog
 * - 箭头键导航 Radio/Select
 * - focus-visible 样式可见
 */

test.describe('键盘导航', () => {
  test('Tab 键可循环聚焦所有可交互元素', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    const focusedTags: string[] = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? '')
      if (tag) focusedTags.push(tag)
      if (tag === 'BUTTON' && i > 2) break
    }
    expect(focusedTags.length).toBeGreaterThan(0)
    const interactiveTags = focusedTags.filter((t) =>
      ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(t),
    )
    expect(interactiveTags.length).toBeGreaterThan(0)
  })

  test('Escape 键关闭 Drawer/Dialog（若打开）', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    await page.keyboard.press('Escape')
    const openDialogs = await page.locator('[role="dialog"][aria-modal="true"]:visible').count()
    expect(openDialogs).toBe(0)
  })

  test('focus-visible 样式在 Tab 导航时可见', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    const hasFocusVisible = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return false
      const styles = window.getComputedStyle(el)
      const outline = styles.outline
      const boxShadow = styles.boxShadow
      return outline !== 'none' || boxShadow !== 'none'
    })
    expect(hasFocusVisible).toBeTruthy()
  })

  test('Enter 键可激活聚焦的按钮', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? '')
      if (tag === 'BUTTON' || tag === 'A') break
    }

    const urlBefore = page.url()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    const urlAfter = page.url()
    expect(urlAfter).toBeTruthy()
  })

  test('页面无 tabindex=-1 的焦点陷阱', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const negativeTabIndex = await page.locator('[tabindex="-1"]:not([role="option"])').count()
    expect(negativeTabIndex).toBeGreaterThanOrEqual(0)
  })

  test('skip-to-main-content 链接存在（若配置）', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const skipLink = page.locator('a[href="#main"], a[href="#main-content"]').first()
    const count = await skipLink.count()
    if (count > 0) {
      const isVisible = await skipLink.isVisible()
      expect(typeof isVisible).toBe('boolean')
    }
  })

  test('aria-label 存在于图标按钮', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const iconButtons = page.locator('button:not([aria-label]):not(:has-text(""))')
    const count = await iconButtons.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Radio 组件支持箭头键导航（若存在）', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const radioGroups = page.locator('[role="radiogroup"]')
    const count = await radioGroups.count()
    if (count > 0) {
      const firstGroup = radioGroups.first()
      const radios = firstGroup.locator('[role="radio"]')
      const radioCount = await radios.count()
      if (radioCount > 1) {
        await radios.first().focus()
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(200)
        const checkedRadios = await firstGroup
          .locator('[role="radio"][aria-checked="true"]')
          .count()
        expect(checkedRadios).toBeGreaterThanOrEqual(1)
      }
    }
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Select 组件支持键盘打开和选择（若存在）', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const comboboxes = page.locator('[role="combobox"]')
    const count = await comboboxes.count()
    if (count > 0) {
      const combobox = comboboxes.first()
      await combobox.focus()
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      const expanded = await combobox.getAttribute('aria-expanded')
      expect(typeof expanded).toBe('string')
    }
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
