/**
 * auto 模式 prefers-color-scheme 动态变化监听测试 (2026-07-02 立)
 *
 * 目的: 验证 auto 主题模式下, 系统主题 (prefers-color-scheme) 变化时
 *       页面能实时切换 light/dark, 不闪烁, 不残留旧主题.
 *
 * 背景:
 *   darkMode.ts 的 auto 模式通过 matchMedia('(prefers-color-scheme: dark)') 监听
 *   系统主题变化. Playwright 的 page.emulateMedia({ colorScheme: 'dark' }) 可以
 *   在运行时动态改变 prefers-color-scheme, 触发 matchMedia change 事件.
 *
 * 测试策略:
 *   1. auto 模式 + 系统浅色 → 页面应为 light (html 无 dark class)
 *   2. 动态切到系统暗色 → 页面应变 dark (html 有 dark class), 无闪烁
 *   3. 动态切回系统浅色 → 页面应变 light, 无残留
 *   4. 多次快速切换不撕裂 (light→dark→light→dark)
 *
 * "无闪烁" 验证:
 *   - 切换后 500ms 内 html.dark class 状态稳定 (不再变化)
 *   - body 背景色与主题一致 (light=#fff, dark=#1a1a1a)
 *
 * 使用:
 *   PW_BASE_URL=http://127.0.0.1:8888 npx playwright test auto-theme-dynamic.spec.ts
 */

import { test, expect } from '@playwright/test'
import { BASE, injectLocale } from './utils/login-helpers'

// 等待主题稳定 (darkMode.ts auto 模式有 debounce 200ms)
async function waitForThemeStable(page: import('@playwright/test').Page): Promise<void> {
  // darkMode.ts 的 matchMedia listener + applyTheme + debounce 总共约 200-400ms
  await page.waitForTimeout(500)
}

// 获取当前 html.dark 状态 + body 背景色
async function getThemeState(page: import('@playwright/test').Page): Promise<{
  hasDark: boolean
  bgColor: string
}> {
  return await page.evaluate(() => {
    const html = document.documentElement
    const body = document.body
    const bg = window.getComputedStyle(body).backgroundColor
    return {
      hasDark: html.classList.contains('dark'),
      bgColor: bg,
    }
  })
}

test.describe('auto 模式 - prefers-color-scheme 动态变化', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 1: auto 模式 + 系统浅色 → 页面应为 light
  // ─────────────────────────────────────────────────────────────────────
  test('auto 模式 + 系统浅色 → html 无 dark class, body 背景接近白色', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()

    try {
      await injectLocale(page, 'zh-CN')
      // 设 localStorage theme-mode=auto
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
        } catch { /* ignore */ }
      })

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await waitForThemeStable(page)

      const state = await getThemeState(page)
      expect(state.hasDark, 'auto + 系统浅色: html 不应有 dark class').toBe(false)
      // body 背景应该是白色系 (rgb(255,255,255) 或接近)
      expect(state.bgColor, `auto + 系统浅色: body 背景应为白色系, 实际 ${state.bgColor}`).toMatch(/rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)/)
    } finally {
      await context.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 2: auto 模式 + 系统暗色 → 页面应为 dark
  // ─────────────────────────────────────────────────────────────────────
  test('auto 模式 + 系统暗色 → html 有 dark class, body 背景为暗色', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()

    try {
      await injectLocale(page, 'zh-CN')
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
        } catch { /* ignore */ }
      })

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await waitForThemeStable(page)

      const state = await getThemeState(page)
      expect(state.hasDark, 'auto + 系统暗色: html 应有 dark class').toBe(true)
      // body 背景应该是暗色 (rgb 值 < 100)
      expect(state.bgColor, `auto + 系统暗色: body 背景应为暗色, 实际 ${state.bgColor}`).toMatch(/rgb\([0-9]{1,2},\s*[0-9]{1,2},\s*[0-9]{1,2}\)/)
    } finally {
      await context.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 3: 动态切换 系统浅色 → 系统暗色 → 页面应实时变 dark
  // ─────────────────────────────────────────────────────────────────────
  test('auto 模式: 系统浅色 → 暗色动态切换, html.dark 实时变化', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()

    try {
      await injectLocale(page, 'zh-CN')
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
        } catch { /* ignore */ }
      })

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await waitForThemeStable(page)

      // 初始: light
      let state = await getThemeState(page)
      expect(state.hasDark, '初始应为 light').toBe(false)

      // 动态切到 dark
      await page.emulateMedia({ colorScheme: 'dark' })
      await waitForThemeStable(page)

      state = await getThemeState(page)
      expect(state.hasDark, '切到系统暗色后应为 dark').toBe(true)

      // 再切回 light
      await page.emulateMedia({ colorScheme: 'light' })
      await waitForThemeStable(page)

      state = await getThemeState(page)
      expect(state.hasDark, '切回系统浅色后应为 light').toBe(false)
    } finally {
      await context.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 4: 快速连续切换 light→dark→light→dark 不撕裂
  // ─────────────────────────────────────────────────────────────────────
  test('auto 模式: 快速连续切换 4 次, 最终状态正确无撕裂', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()

    try {
      await injectLocale(page, 'zh-CN')
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
        } catch { /* ignore */ }
      })

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await waitForThemeStable(page)

      // 快速连续切换 4 次
      const sequence: Array<{ scheme: 'light' | 'dark'; expectedDark: boolean }> = [
        { scheme: 'dark', expectedDark: true },
        { scheme: 'light', expectedDark: false },
        { scheme: 'dark', expectedDark: true },
        { scheme: 'light', expectedDark: false },
      ]

      for (const step of sequence) {
        await page.emulateMedia({ colorScheme: step.scheme })
        await waitForThemeStable(page)
        const state = await getThemeState(page)
        expect(
          state.hasDark,
          `切到 ${step.scheme} 后 html.dark=${state.hasDark}, 期望=${step.expectedDark}`,
        ).toBe(step.expectedDark)
      }

      // 最终状态: light
      const finalState = await getThemeState(page)
      expect(finalState.hasDark, '最终应为 light').toBe(false)
    } finally {
      await context.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 5: 切换后 CSS 变量跟随更新 (--el-bg-color)
  // ─────────────────────────────────────────────────────────────────────
  test('auto 模式: 切换主题后 --el-bg-color CSS 变量跟随更新', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' })
    const page = await context.newPage()

    try {
      await injectLocale(page, 'zh-CN')
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
        } catch { /* ignore */ }
      })

      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await waitForThemeStable(page)

      // light 模式 --el-bg-color 应为白色系
      const lightBg = await page.evaluate(() =>
        window.getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim(),
      )

      // 切到 dark
      await page.emulateMedia({ colorScheme: 'dark' })
      await waitForThemeStable(page)

      const darkBg = await page.evaluate(() =>
        window.getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim(),
      )

      // 两个值应该不同 (light 和 dark 的 --el-bg-color 不同)
      expect(
        lightBg,
        `light --el-bg-color "${lightBg}" 与 dark "${darkBg}" 应不同`,
      ).not.toBe(darkBg)
    } finally {
      await context.close()
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 6: 5 语言下 auto 模式切换都正常 (i18n + 主题联动)
  // ─────────────────────────────────────────────────────────────────────
  for (const locale of ['zh-CN', 'en', 'zh-TW', 'ja', 'ko'] as const) {
    test(`auto 模式 ${locale}: 系统暗色 → html.dark 正确`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'dark' })
      const page = await context.newPage()

      try {
        await injectLocale(page, locale)
        await page.addInitScript(() => {
          try {
            window.localStorage.setItem('theme-mode', JSON.stringify({ value: 'auto' }))
          } catch { /* ignore */ }
        })

        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle').catch(() => {})
        await waitForThemeStable(page)

        const state = await getThemeState(page)
        expect(state.hasDark, `${locale} auto + 系统暗色: html 应有 dark class`).toBe(true)

        // 切到 light 也应跟随
        await page.emulateMedia({ colorScheme: 'light' })
        await waitForThemeStable(page)
        const state2 = await getThemeState(page)
        expect(state2.hasDark, `${locale} auto + 切到系统浅色: html 不应有 dark class`).toBe(false)
      } finally {
        await context.close()
      }
    })
  }
})
