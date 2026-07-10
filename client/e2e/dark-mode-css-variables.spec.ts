import { test, expect } from '@playwright/test'

/**
 * Dark Mode CSS 变量回归测试
 *
 * 防护目标：上一轮修复的两个 dark mode 隐性 bug 不再回归
 * 1. --el-color-primary 曾被链式引用为 var(--el-bg-color)=#0d0d0d，
 *    导致所有 background-color: var(--el-color-primary) 的按钮在 dark 模式下"消失"。
 *    修复值：#2563eb（蓝色主色）
 * 2. --el-text-color-regular 曾指向 neutral 色阶（被映射为深色），
 *    导致文字色与背景色同色不可见。修复值：#cfd3dc（浅灰）
 *
 * 本 spec 直接断言 CSS 变量值，并验证主色按钮的可见性（背景色 ≠ 页面背景色）。
 */
test.describe('Dark Mode CSS 变量回归', () => {
  // 测试前确保样式已加载（CSS 资源加载完成后再操作，避免 domcontentloaded 阶段
  // 样式未应用导致 getComputedStyle 返回空值）
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    // 等一个 microtask tick，确保所有 CSS 变量已应用到 :root
    await page.waitForTimeout(200)
  })

  test('dark 模式下 --el-color-primary 为 #2563eb，按钮不"消失"', async ({ page }) => {
    // 注入暗色模式：与 ThemeToggle 一致，给 html 加 class="dark"
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    // 强制样式重算（getComputedStyle 已能读取，但确保 class 触发样式重计算）
    await page.waitForTimeout(100)

    // 读取 :root(html.dark) 上的 CSS 变量
    const primaryVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--el-color-primary')
        .trim()
    })

    // 断言主色为蓝色 #2563eb（允许 hex 或 rgb 两种表示）
    const ok =
      primaryVar.toLowerCase() === '#2563eb' ||
      primaryVar.replace(/\s/g, '') === 'rgb(37,99,235)'
    expect(ok, `--el-color-primary 应为 #2563eb, 实际: "${primaryVar}"`).toBe(true)

    // 验证主色 ≠ 页面背景色（即按钮不会"消失"）
    const bgVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--el-bg-color')
        .trim()
    })
    expect(
      primaryVar.toLowerCase() !== bgVar.toLowerCase(),
      `主色(${primaryVar}) 不应等于页面背景色(${bgVar}), 否则按钮不可见`
    ).toBe(true)
  })

  test('dark 模式下 --el-text-color-regular 为浅色 #cfd3dc，文字可见', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(100)

    const regularVar = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--el-text-color-regular')
        .trim()
    })

    // 断言常规文字色为浅灰 #cfd3dc
    const ok =
      regularVar.toLowerCase() === '#cfd3dc' ||
      regularVar.replace(/\s/g, '') === 'rgb(207,211,220)'
    expect(ok, `--el-text-color-regular 应为 #cfd3dc, 实际: "${regularVar}"`).toBe(true)

    // 验证文字色相对亮度 > 0.4（浅色，在深色背景上可见）
    const luminance = await page.evaluate(() => {
      const c = getComputedStyle(document.documentElement)
        .getPropertyValue('--el-text-color-regular')
        .trim()
      let r = 0, g = 0, b = 0
      // 尝试 rgb(r, g, b) 格式
      const rgbM = c.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
      if (rgbM) {
        ;[r, g, b] = rgbM.slice(1, 4).map(Number)
      } else {
        // 尝试 #rrggbb hex 格式
        const hexM = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
        if (!hexM) return -1
        ;[r, g, b] = hexM.slice(1, 4).map((h) => parseInt(h, 16))
      }
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    })
    expect(
      luminance > 0.4,
      `文字色相对亮度应 > 0.4（浅色可见）, 实际亮度: ${luminance.toFixed(2)}`
    ).toBe(true)
  })
})
