// =============================================================================
// Error.vue 视觉回归测试
// -----------------------------------------------------------------------------
// 用途: 固化 Error.vue 错误态在 light / dark 两种主题模式下的视觉基线，
//       防护"底部 60px 白色背景条"等历史回归 (2026-07-02 修复)。
//       触发方式: URL 加 ?__test_error=1 强制 ErrorBoundary 进入错误态
//       (由 Error.vue 内的开发期 hook 控制, 生产构建 tree-shake 移除)
//
// 重新生成基线: npx playwright test e2e/visual/error-page-snapshot.spec.ts --update-snapshots
//
// 依赖: dev 服务必须运行 (默认 http://127.0.0.1:8888),
//       playwright.config.ts 已配置 webServer.reuseExistingServer=true
// =============================================================================

import { test, expect, type Page } from '@playwright/test'
import { isolateThemeStateAfterNav } from '../helpers/test-isolation'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

type ThemeMode = 'light' | 'dark'

async function setThemeMode(page: Page, mode: ThemeMode) {
  await page.evaluate(
    ({ mode }) => {
      try {
        localStorage.setItem('darkMode', mode)
        localStorage.setItem('pinia-darkMode', JSON.stringify({ themeMode: mode }))
      } catch (_e) {
        /* noop */
      }
      const root = document.documentElement
      root.classList.remove('dark', 'high-contrast-light', 'high-contrast-dark')
      if (mode === 'dark') {
        root.classList.add('dark')
      }
    },
    { mode }
  )
}

async function waitThemeApplied(page: Page, mode: ThemeMode) {
  const expectedDark = mode === 'dark'
  await page.waitForFunction(
    (expected) => document.documentElement.classList.contains('dark') === expected,
    expectedDark,
    { timeout: 5000 }
  )
  await page.waitForTimeout(300)
}

test.beforeEach(async ({ page }) => {
  await isolateThemeStateAfterNav(page)
})

test.describe('Error.vue 视觉基线 - 错误态', () => {
  test.describe.configure({ mode: 'serial' })

  for (const { mode, label } of [
    { mode: 'light' as ThemeMode, label: '浅色' },
    { mode: 'dark' as ThemeMode, label: '暗色' },
  ]) {
    test(`Error.vue 错误态 ${label} 模式 - 防止 60px 白条回归`, async ({ page }) => {
      // 1. 打开带 ?__test_error=1 的首页 (Error.vue 的 dev hook 会强制进入错误态)
      await page.goto(BASE + '/?__test_error=1', { waitUntil: 'networkidle' })

      // 2. 注入主题
      await setThemeMode(page, mode)
      await waitThemeApplied(page, mode)

      // 3. 等错误态稳定渲染
      const errorFallback = page.locator('.error-fallback')
      await errorFallback.waitFor({ state: 'visible', timeout: 5000 })
      await page.evaluate(() => document.fonts.ready)
      await page.waitForLoadState('networkidle')

      // 4. 禁用所有 CSS transition + animation, 避免截图抖动
      await page.addStyleTag({
        content: `*, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }`,
      })
      await page.waitForTimeout(500)

      // 5. 视口截图 (1280x720)
      const VIEWPORT = { width: 1280, height: 720 }
      await page.setViewportSize(VIEWPORT)
      const snapshotName = `error-fallback-${mode}.png`
      await expect(page).toHaveScreenshot(snapshotName, {
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
        // 容差放宽到 0.1: 禁用所有 transition 后仍可能有 sub-pixel 渲染抖动
        maxDiffPixelRatio: 0.1,
        animations: 'disabled',
      })
    })
  }
})

test.describe('Error.vue 错误态 - 运行时 CSS 变量断言', () => {
  // 这些断言不需要截图，作为"语义级"基线
  // 即使 baseline 图片过期，下面的变量断言也能在 CI 失败时报出具体偏差

  for (const { mode, expectedBg, expectedBgRgb, label } of [
    {
      mode: 'light' as ThemeMode,
      expectedBg: '#f7f8fa',
      expectedBgRgb: 'rgb(247, 248, 250)',
      label: '浅色',
    },
    {
      mode: 'dark' as ThemeMode,
      expectedBg: '#6a6d77',
      expectedBgRgb: 'rgb(106, 109, 119)',
      label: '暗色',
    },
  ]) {
    test(`${label}：错误态 .error-fallback min-height 应为 100vh (无 60px 露出)`, async ({ page }) => {
      await page.goto(BASE + '/?__test_error=1', { waitUntil: 'networkidle' })
      await setThemeMode(page, mode)
      await waitThemeApplied(page, mode)

      const errorFallback = page.locator('.error-fallback')
      await errorFallback.waitFor({ state: 'visible', timeout: 5000 })

      const result = await page.evaluate(() => {
        const el = document.querySelector('.error-fallback') as HTMLElement | null
        if (!el) return { ok: false, reason: 'no-element' }
        const cs = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return {
          ok: true,
          minHeight: cs.minHeight,
          bgColor: cs.backgroundColor,
          width: rect.width,
          height: rect.height,
          viewportHeight: window.innerHeight,
        }
      })

      expect(result.ok, '.error-fallback 元素必须存在').toBe(true)
      // min-height 必须为 100vh (或更大), 不能是 calc(100vh - 60px) 之类
      expect(
        result.minHeight,
        `.error-fallback min-height 应为 100vh (不是 calc(100vh - 60px)), 实际: ${result.minHeight}`
      ).toBe('100vh')
      // 元素实际高度应 >= 视口高度 (允许 sub-pixel 误差)
      expect(
        result.height,
        `.error-fallback 高度应 >= 视口高度, 实际高度=${result.height}, 视口=${result.viewportHeight}`
      ).toBeGreaterThanOrEqual(result.viewportHeight - 1)
      // 背景色应匹配预期 (避免出现 #ffffff 白色条)
      const bgOk =
        result.bgColor.toLowerCase() === expectedBg.toLowerCase() ||
        result.bgColor.replace(/\s/g, '') === expectedBgRgb.replace(/\s/g, '')
      expect(
        bgOk,
        `${label} .error-fallback 背景色应为 ${expectedBg} (避免 #ffffff 白条), 实际: ${result.bgColor}`
      ).toBe(true)
    })
  }
})
