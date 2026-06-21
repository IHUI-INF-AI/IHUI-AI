import { test, expect } from '@playwright/test'
import { setTheme, getEffectiveTheme } from './helpers/theme-helper'

/**
 * 主题切换实时预览测试
 * 验证:
 *  1. 切换主题时 CSS 变量实时生效(无需刷新)
 *  2. 关键 token 在不同主题下取值不同
 *  3. 切换前后页面无视觉跳变(关键元素可见性保持)
 *  4. 高对比度模式生效
 */

const KEY_TOKENS = [
  '--el-bg-color',
  '--el-bg-color-page',
  '--el-text-color-primary',
  '--el-text-color-regular',
  '--el-border-color',
  '--el-color-primary',
] as const

test.describe('主题切换实时预览', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
  })

  test('切换 light → dark 时 CSS 变量实时生效', async ({ page }) => {
    // 先记录 light 模式下的 token 取值
    const lightTokens = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
    }, [...KEY_TOKENS])

    // 切换到 dark
    await setTheme(page, 'dark')
    await page.waitForTimeout(500)

    const darkTokens = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
    }, [...KEY_TOKENS])

    // 验证主题已切换
    const effective = await getEffectiveTheme(page)
    expect(effective).toBe('dark')

    // 验证关键 token 取值发生变化(至少 --el-bg-color 应该不同)
    expect(darkTokens['--el-bg-color']).not.toBe(lightTokens['--el-bg-color'])
  })

  test('切换 dark → light 时 CSS 变量实时生效', async ({ page }) => {
    await setTheme(page, 'dark')
    await page.waitForTimeout(400)

    const darkTokens = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
    }, [...KEY_TOKENS])

    await setTheme(page, 'light')
    await page.waitForTimeout(500)

    const lightTokens = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
    }, [...KEY_TOKENS])

    const effective = await getEffectiveTheme(page)
    expect(effective).toBe('light')
    expect(lightTokens['--el-bg-color']).not.toBe(darkTokens['--el-bg-color'])
  })

  test('切换到高对比度模式时 CSS 变量生效', async ({ page }) => {
    await setTheme(page, 'hc-light')
    await page.waitForTimeout(500)

    const effective = await getEffectiveTheme(page)
    expect(effective).toBe('hc-light')

    const hcTokens = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement)
      return Object.fromEntries(tokens.map((t) => [t, cs.getPropertyValue(t).trim()]))
    }, [...KEY_TOKENS])

    // 高对比度模式下 token 应该有值
    for (const token of KEY_TOKENS) {
      expect(hcTokens[token]).toBeTruthy()
    }
  })

  test('快速连续切换主题不产生异常', async ({ page }) => {
    const themes = ['dark', 'light', 'dark', 'light', 'dark'] as const
    for (const t of themes) {
      await setTheme(page, t)
      await page.waitForTimeout(150)
    }
    const effective = await getEffectiveTheme(page)
    expect(effective).toBe('dark')

    // 验证页面没有崩溃
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('切换主题后关键 UI 元素仍然可见', async ({ page }) => {
    await setTheme(page, 'dark')
    await page.waitForTimeout(500)

    // 验证 body 可见且有背景色
    const bodyBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    expect(bodyBg).toBeTruthy()
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)')

    // 切回 light
    await setTheme(page, 'light')
    await page.waitForTimeout(500)

    const bodyBgLight = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor
    })
    expect(bodyBgLight).toBeTruthy()
  })

  test('主题切换不破坏 CSS 变量继承链', async ({ page }) => {
    await setTheme(page, 'dark')
    await page.waitForTimeout(400)

    // 验证 --el-text-color-primary 在 body 上也能取到
    const inherited = await page.evaluate(() => {
      return getComputedStyle(document.body).getPropertyValue('--el-text-color-primary').trim()
    })
    expect(inherited).toBeTruthy()

    // 验证 --global-box-shadow 在 body 上也能取到
    const shadow = await page.evaluate(() => {
      return getComputedStyle(document.body).getPropertyValue('--global-box-shadow').trim()
    })
    expect(shadow).toBeTruthy()
  })
})
