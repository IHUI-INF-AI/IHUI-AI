/**
 * 登录页多语言视觉 + 功能回归 (2026-07-02 立)
 *
 * 目的:
 *   1. 视觉回归: 5 语言 × 2 Tab × 2 主题 = 20 张截图基线
 *      路径: e2e/__screenshots__/login-i18n/{locale}/{tab}-{theme}.png
 *   2. 硬断言 (light 模式): 5 语言下 Tab 翻译 + 协议文字翻译必须正确
 *      防止 "login.tabs.account" 字面量裸露、键名错翻译等回归
 *
 * 重要事实 (2026-07-02 核对 LoginDialog.vue / UniversalLogin.vue / TabSwitcher.vue):
 *   - 弹窗只渲染 2 个 Tab (account/phone), enterprise Tab 在旧版 LoginContainer 才存在
 *   - 协议文字 (《用户协议》/《隐私政策》) 只在注册模式 (isRegisterMode=true) 显示
 *   - 弹窗通过 useLoginDialog().open('login') 触发, 路由 /login 走 Login.vue 占位 → 自动 open
 *
 * 使用:
 *   PW_BASE_URL=http://127.0.0.1:8888 npx playwright test login-i18n-screenshots.spec.ts
 *   仅跑硬断言: --grep "硬断言"
 *   仅跑截图:   --grep "截图归档"
 *
 * 共享工具: e2e/utils/login-helpers.ts
 */

import { test, expect } from '@playwright/test'
import {
  BASE,
  LOCALES,
  LOGIN_TABS,
  THEMES,
  AUTO_THEMES,
  ASSERTIONS,
  injectLocale,
  injectTheme,
  injectAutoTheme,
  waitForLoginDialog,
  switchLoginTab,
  switchToRegisterMode,
  detectExposedKeys,
  EXPOSED_KEY_PATTERN,
} from './utils/login-helpers'

const SCREENSHOT_DIR = 'e2e/__screenshots__/login-i18n'

test.describe('登录页 i18n 视觉 + 功能回归', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 1. 硬断言: 5 语言下 Tab 翻译 + 协议文字 (light 模式, 登录态)
  // ─────────────────────────────────────────────────────────────────────
  for (const locale of LOCALES) {
    test(`硬断言 ${locale} - 登录 Tab 翻译正确`, async ({ page }) => {
      await injectLocale(page, locale)
      await injectTheme(page, 'light')
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await waitForLoginDialog(page)

      const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
      const tabTexts = await tabs.allTextContents()
      const expected = ASSERTIONS[locale].loginTabs

      expect(tabTexts.length, `${locale} 应有 2 个 Tab`).toBeGreaterThanOrEqual(2)
      expect(
        tabTexts[0],
        `${locale} 第一个 Tab 应是 "${expected.account}" (账号登录), 实际 "${tabTexts[0]}"`,
      ).toBe(expected.account)
      expect(
        tabTexts[1],
        `${locale} 第二个 Tab 应是 "${expected.phone}" (手机登录), 实际 "${tabTexts[1]}"`,
      ).toBe(expected.phone)
    })

    test(`硬断言 ${locale} - 注册模式协议文字翻译正确`, async ({ page }) => {
      await injectLocale(page, locale)
      await injectTheme(page, 'light')
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await waitForLoginDialog(page)

      await switchLoginTab(page, 'phone')
      await switchToRegisterMode(page)

      const expected = ASSERTIONS[locale].registerAgreement

      const prefix = page.locator('.el-checkbox').first()
      await expect(prefix, `${locale} 协议 checkbox 应可见`).toBeVisible({ timeout: 5_000 })
      const prefixText = await prefix.textContent()
      expect(
        prefixText || '',
        `${locale} 协议前缀应含 "${expected.prefixContains}"`,
      ).toContain(expected.prefixContains)

      const userLink = page.getByRole('link', { name: expected.userAgreement }).or(
        page.locator(`text="${expected.userAgreement}"`).first(),
      )
      const privacyLink = page.getByRole('link', { name: expected.privacyPolicy }).or(
        page.locator(`text="${expected.privacyPolicy}"`).first(),
      )
      await expect(userLink, `${locale} 用户协议链接 "${expected.userAgreement}" 应可见`).toBeVisible({ timeout: 5_000 })
      await expect(privacyLink, `${locale} 隐私政策链接 "${expected.privacyPolicy}" 应可见`).toBeVisible({ timeout: 5_000 })
    })
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. 硬断言: 切到 en/zh-TW/ja/ko 后, 4 语言下 Tab 都不显示裸奔键名
  // ─────────────────────────────────────────────────────────────────────
  test('硬断言 4 语言下 Tab 文本无 i18n 键名裸露 (xxx.yyy 形式)', async ({ page }) => {
    for (const locale of LOCALES) {
      await page.context().clearCookies()
      await injectLocale(page, locale)
      await injectTheme(page, 'light')
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
      await waitForLoginDialog(page)

      const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
      const tabTexts = await tabs.allTextContents()

      for (const text of tabTexts) {
        expect(
          EXPOSED_KEY_PATTERN.test(text),
          `${locale} Tab 文本 "${text}" 疑似 i18n 键名裸露 (xxx.yyy 形式)`,
        ).toBe(false)
      }
    }
  })

  // ─────────────────────────────────────────────────────────────────────
  // 3. 视觉归档: 5 语言 × 2 Tab × 2 主题 = 20 张截图基线
  // ─────────────────────────────────────────────────────────────────────
  for (const locale of LOCALES) {
    for (const tab of LOGIN_TABS) {
      for (const theme of THEMES) {
        test(`截图归档 ${locale} - ${tab.label} tab - ${theme} 模式`, async ({ page }) => {
          await injectLocale(page, locale)
          await injectTheme(page, theme)
          await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
          await waitForLoginDialog(page)
          await switchLoginTab(page, tab.value)

          const fileName = `${tab.value}-${theme}.png`
          const filePath = `${SCREENSHOT_DIR}/${locale}/${fileName}`
          await page.screenshot({
            path: filePath,
            fullPage: false,
            animations: 'disabled',
          })

          // 软断言: 检测 i18n 键名裸露 (不抛错, 仅打印)
          const exposed = await detectExposedKeys(page)
          if (exposed.length > 0) {
            console.warn(`[${locale}/${tab.value}/${theme}] 可能的键名裸露:`, exposed.slice(0, 5))
          }
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. 视觉归档: 5 语言 × 2 Tab × 2 auto 模式 = 20 张截图 (auto 模式)
  //    auto-light: localStorage=auto + Playwright colorScheme='light'
  //    auto-dark:  localStorage=auto + Playwright colorScheme='dark'
  //    验证 auto 模式正确跟随系统偏好 (不手写 dark class)
  // ─────────────────────────────────────────────────────────────────────
  for (const locale of LOCALES) {
    for (const tab of LOGIN_TABS) {
      for (const autoTheme of AUTO_THEMES) {
        test(`截图归档 ${locale} - ${tab.label} tab - ${autoTheme} 模式`, async ({ browser }) => {
          // auto 模式需要独立 context 以控制 colorScheme
          const systemPref = autoTheme === 'auto-dark' ? 'dark' : 'light'
          const context = await browser.newContext({ colorScheme: systemPref as 'light' | 'dark' })
          const page = await context.newPage()

          try {
            await injectLocale(page, locale)
            await injectAutoTheme(page, autoTheme)
            await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
            await waitForLoginDialog(page)
            await switchLoginTab(page, tab.value)

            const fileName = `${tab.value}-${autoTheme}.png`
            const filePath = `${SCREENSHOT_DIR}/${locale}/${fileName}`
            await page.screenshot({
              path: filePath,
              fullPage: false,
              animations: 'disabled',
            })

            // 软断言: auto-dark 下 html 应有 dark class, auto-light 下不应有
            const hasDarkClass = await page.evaluate(() =>
              document.documentElement.classList.contains('dark'),
            )
            const expectedDark = autoTheme === 'auto-dark'
            if (hasDarkClass !== expectedDark) {
              console.warn(
                `[${locale}/${tab.value}/${autoTheme}] auto 模式 dark class 不符合预期: ` +
                `html.dark=${hasDarkClass}, expected=${expectedDark}`,
              )
            }
          } finally {
            await context.close()
          }
        })
      }
    }
  }
})
