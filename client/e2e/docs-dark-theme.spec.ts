import { test, expect } from '@playwright/test'

test.describe('文档页暗色主题正文可读性', () => {
  test('暗色下 .markdown-content 正文应为高对比度浅色', async ({ page }) => {
    await page.goto('/docs?doc=dev-introduction')
    await page.waitForLoadState('networkidle')

    // 注入暗色：与 ThemeToggle 一致，给 html 加 class="dark"
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })

    // 等待右侧文档内容渲染
    const content = page.locator('.edu-docs-root .docs-content .markdown-content')
    await expect(content).toBeVisible({ timeout: 10000 })

    const firstP = content.locator('p').first()
    await expect(firstP).toBeVisible({ timeout: 5000 })

    const color = await firstP.evaluate((el) => {
      const s = window.getComputedStyle(el)
      return s.color
    })

    // 暗色下正文应为高对比度浅色（相对亮度 > 0.4），不硬编码具体色值
    const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
    const luminance = rgbMatch
      ? (([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255)(
          rgbMatch.slice(1, 4).map(Number)
        )
      : 0
    expect(
      luminance > 0.4,
      `正文颜色应为浅色（高对比度），实际: ${color}，相对亮度: ${luminance.toFixed(2)}`
    ).toBe(true)
  })
})
