import { test, expect } from '@playwright/test'
import { isolateThemeStateAfterNav } from './helpers/test-isolation'

// 并行测试隔离:每个测试前清理可能残留的主题状态
test.beforeEach(async ({ page }) => {
  await isolateThemeStateAfterNav(page)
})

test.describe('主题预设系统', () => {
  test('蓝色主题预设应用正确', async ({ page }) => {
    // 设置蓝色主题预设
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'blue')
    })

    // 等待 CSS 变量稳定(避免 getComputedStyle 延迟导致 flaky)
    await page.waitForFunction(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
      return color.toLowerCase().includes('1677ff')
    }, { timeout: 3000 })

    // 验证 --el-color-primary 被覆盖为蓝色
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
    })
    expect(primaryColor.toLowerCase()).toContain('1677ff')
  })

  test('绿色主题预设应用正确', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'green')
    })

    // 等待 CSS 变量稳定(避免 getComputedStyle 延迟导致 flaky)
    await page.waitForFunction(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
      return color.toLowerCase().includes('52c41a')
    }, { timeout: 3000 })

    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
    })
    expect(primaryColor.toLowerCase()).toContain('52c41a')
  })

  test('紫色主题预设应用正确', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'purple')
    })

    // 等待 CSS 变量稳定(避免 getComputedStyle 延迟导致 flaky)
    await page.waitForFunction(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
      return color.toLowerCase().includes('722ed1')
    }, { timeout: 3000 })

    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
    })
    expect(primaryColor.toLowerCase()).toContain('722ed1')
  })

  test('默认主题无 data-theme 属性', async ({ page }) => {
    const dataTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme')
    })
    expect(dataTheme).toBeNull()
  })

  test('主题预设与暗色模式可同时使用', async ({ page }) => {
    // 同时设置蓝色预设和暗色模式
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'blue')
      document.documentElement.classList.add('dark')
    })

    // 等待 CSS 变量稳定(避免 getComputedStyle 延迟导致 flaky)
    await page.waitForFunction(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
      return color.toLowerCase().includes('1677ff')
    }, { timeout: 3000 })

    // 验证蓝色主色仍然生效
    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
    })
    expect(primaryColor.toLowerCase()).toContain('1677ff')

    // 验证暗色模式也生效
    const isDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark')
    })
    expect(isDark).toBe(true)
  })

  test('主题预设切换后主色渐变阶梯完整', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'blue')
    })

    // 等待 CSS 变量稳定(避免 getComputedStyle 延迟导致 flaky)
    await page.waitForFunction(() => {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim()
      return color.toLowerCase().includes('1677ff')
    }, { timeout: 3000 })

    // 验证 light-3 到 light-9 和 dark-2 阶梯都存在
    const levels = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)
      return {
        light3: style.getPropertyValue('--el-color-primary-light-3').trim(),
        light5: style.getPropertyValue('--el-color-primary-light-5').trim(),
        light7: style.getPropertyValue('--el-color-primary-light-7').trim(),
        light9: style.getPropertyValue('--el-color-primary-light-9').trim(),
        dark2: style.getPropertyValue('--el-color-primary-dark-2').trim(),
      }
    })

    // 所有阶梯都应有值
    expect(levels.light3.length).toBeGreaterThan(0)
    expect(levels.light5.length).toBeGreaterThan(0)
    expect(levels.light7.length).toBeGreaterThan(0)
    expect(levels.light9.length).toBeGreaterThan(0)
    expect(levels.dark2.length).toBeGreaterThan(0)
  })
})
