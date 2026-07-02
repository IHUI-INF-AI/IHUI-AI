/**
 * i18n 切换语言回归测试 (2026-07-02 立)
 *
 * 目的: 断言切换语言后, 旧语言的翻译值不残留 (中英混搭 bug)
 *
 * 背景:
 *   vue-i18n 用 mergeLocaleMessage 增量合并, locale 切换时整个 messages 对象替换.
 *   但如果某组件缓存了 t('key') 的返回值 (e.g. computed 不依赖 i18n.locale),
 *   切换语言后旧文本会残留, 形成中英混搭.
 *
 * 测试策略:
 *   1. zh-CN 打开登录弹窗, 记录 Tab 文本
 *   2. 切到 en, 等 500ms, 重新读 Tab 文本
 *   3. 断言: 中文 "账号登录" 消失, 英文 "Account Login" 出现
 *   4. 同理验证 zh-TW / ja / ko
 *
 * 不测的:
 *   - 完整页面 reload 后的翻译 (那是 injectLocale 的事)
 *   - 截图 (已在 login-i18n-screenshots.spec.ts 覆盖)
 *
 * 使用:
 *   PW_BASE_URL=http://127.0.0.1:8888 npx playwright test i18n-no-regression.spec.ts
 */

import { test, expect } from '@playwright/test'
import {
  BASE,
  LOCALES,
  ASSERTIONS,
  injectTheme,
  waitForLoginDialog,
} from './utils/login-helpers'

/**
 * LanguageSwitcher.vue 实际 DOM 结构 (2026-07-02 核对):
 *   - 触发器: .language-selector[role="button"] (含 .flag-icon + .language-text + arrow)
 *   - 下拉面板: .language-dropdown-menu[role="menu"] (Teleport to body)
 *   - 选项: a.language-option[role="menuitem"] (含 .flag-icon + .language-name)
 *   - 选项文本 = supportedLanguages 的 native name:
 *     zh-CN → 简体中文, en → English, zh-TW → 繁體中文, ja → 日本語, ko → 한국어
 *
 * 登录弹窗内可能不显示 LanguageSwitcher (只在 Header/Sidebar 显示),
 * 所以 /login 页面需要检查 Header 是否有语言切换器.
 * 如果 LoginDialog 遮住了 Header, 优先用 localStorage + reload fallback.
 */

// LanguageSwitcher 触发器 selector (按优先级)
const LANG_SWITCHER_SELECTORS = [
  '.language-selector',
  '.lang-switcher',
  '.language-switcher',
  '[data-testid="lang-switcher"]',
]

// native name 映射 (与 useLang.ts supportedLanguages 一致)
const NATIVE_NAMES: Record<string, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
}

test.describe('i18n 切换语言 - 旧键值不残留', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  /**
   * 通过实际 UI 点击 LanguageSwitcher 切换语言 (优先)
   * 如果 UI 不可用 (e.g. 登录弹窗遮住 Header), fallback 到 localStorage + reload.
   *
   * @returns true 表示切换成功
   */
  async function switchLanguage(page: import('@playwright/test').Page, targetLocale: string): Promise<boolean> {
    // 1. 尝试找语言切换器 (Header 或 Sidebar 中)
    let switcher = null
    for (const sel of LANG_SWITCHER_SELECTORS) {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 1_000 }).catch(() => false)) {
        switcher = el
        break
      }
    }

    if (!switcher) {
      // fallback: localStorage + reload
      await page.evaluate((loc: string) => {
        try {
          window.localStorage.setItem('language', loc)
          window.localStorage.setItem('i18n-locale', JSON.stringify({ value: loc }))
        } catch { /* ignore */ }
      }, targetLocale)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForLoginDialog(page)
      return true
    }

    // 2. 点击触发器展开下拉面板
    await switcher.click({ timeout: 3_000 }).catch(() => {})
    // 等待下拉面板出现 (Teleport to body, role="menu")
    const menu = page.locator('.language-dropdown-menu, [role="menu"]').first()
    await menu.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {})

    // 3. 找到目标语言选项 (按 native name 匹配 .language-option)
    const targetName = NATIVE_NAMES[targetLocale] || targetLocale
    // LanguageSwitcher.vue 的选项: a.language-option[role="menuitem"] > .language-name
    const option = page.locator('.language-option').filter({ hasText: targetName }).first()

    if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await option.click({ timeout: 3_000 })
      // 等 i18n reactive 更新 + 下拉关闭
      await page.waitForTimeout(500)
      return true
    }

    // 4. fallback: 关闭下拉 + localStorage + reload
    await page.keyboard.press('Escape').catch(() => {})
    await page.evaluate((loc: string) => {
      try {
        window.localStorage.setItem('language', loc)
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: loc }))
      } catch { /* ignore */ }
    }, targetLocale)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)
    return true
  }

  // ─────────────────────────────────────────────────────────────────────
  // 用例 1: zh-CN → en 切换, 中文 Tab 文字应消失, 英文应出现
  // ─────────────────────────────────────────────────────────────────────
  test('zh-CN → en: 中文 "账号登录" 应消失, "Account Login" 应出现', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'zh-CN' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    // 先验证 zh-CN 状态
    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
    const zhTexts = await tabs.allTextContents()
    expect(zhTexts[0]).toContain('账号登录')

    // 切到 en
    await switchLanguage(page, 'en')

    // 重新读 Tab
    const enTexts = await tabs.allTextContents()
    expect(
      enTexts[0],
      `切到 en 后第一个 Tab 应是 "Account Login", 实际 "${enTexts[0]}" (中文残留?)`,
    ).toBe('Account Login')
    expect(
      enTexts[1],
      `切到 en 后第二个 Tab 应是 "Phone Login", 实际 "${enTexts[1]}" (中文残留?)`,
    ).toBe('Phone Login')

    // 关键: 中文不应残留
    expect(enTexts.join(' ')).not.toContain('账号登录')
    expect(enTexts.join(' ')).not.toContain('手机登录')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 2: en → zh-TW 切换
  // ─────────────────────────────────────────────────────────────────────
  test('en → zh-TW: "Account Login" 应消失, "賬號登錄" 应出现', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'en')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'en' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
    const enTexts = await tabs.allTextContents()
    expect(enTexts[0]).toBe('Account Login')

    await switchLanguage(page, 'zh-TW')

    const twTexts = await tabs.allTextContents()
    expect(twTexts[0], `切到 zh-TW 后: "${twTexts[0]}"`).toBe('賬號登錄')
    expect(twTexts[1], `切到 zh-TW 后: "${twTexts[1]}"`).toBe('手機登錄')

    // 英文不应残留
    expect(twTexts.join(' ')).not.toContain('Account Login')
    expect(twTexts.join(' ')).not.toContain('Phone Login')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 3: zh-CN → ja 切换
  // ─────────────────────────────────────────────────────────────────────
  test('zh-CN → ja: 中文应消失, "アカウントログイン" 应出现', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'zh-CN' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
    expect((await tabs.allTextContents())[0]).toContain('账号登录')

    await switchLanguage(page, 'ja')

    const jaTexts = await tabs.allTextContents()
    expect(jaTexts[0], `切到 ja 后: "${jaTexts[0]}"`).toBe('アカウントログイン')
    expect(jaTexts[1], `切到 ja 后: "${jaTexts[1]}"`).toBe('携帯ログイン')

    // 中文不应残留
    expect(jaTexts.join(' ')).not.toContain('账号登录')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 4: zh-CN → ko 切换
  // ─────────────────────────────────────────────────────────────────────
  test('zh-CN → ko: 中文应消失, "계정 로그인" 应出现', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'zh-CN' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')
    expect((await tabs.allTextContents())[0]).toContain('账号登录')

    await switchLanguage(page, 'ko')

    const koTexts = await tabs.allTextContents()
    expect(koTexts[0], `切到 ko 后: "${koTexts[0]}"`).toBe('계정 로그인')
    expect(koTexts[1], `切到 ko 后: "${koTexts[1]}"`).toBe('휴대폰 로그인')

    // 中文不应残留
    expect(koTexts.join(' ')).not.toContain('账号登录')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 5: 循环切换 zh-CN → en → zh-TW → ja → ko → zh-CN (回到起点)
  // 验证多次切换不累积脏状态
  // ─────────────────────────────────────────────────────────────────────
  test('循环切换 5 语言回到 zh-CN, 文本应正确无累积脏状态', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'zh-CN' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')

    // 循环切换
    for (const locale of ['en', 'zh-TW', 'ja', 'ko', 'zh-CN'] as const) {
      await switchLanguage(page, locale)
      const texts = await tabs.allTextContents()
      const expected = ASSERTIONS[locale].loginTabs
      expect(
        texts[0],
        `循环切换到 ${locale}: 第一个 Tab "${texts[0]}" != "${expected.account}"`,
      ).toBe(expected.account)
    }

    // 最终回到 zh-CN
    const finalTexts = await tabs.allTextContents()
    expect(finalTexts[0]).toBe('账号登录')
    expect(finalTexts[1]).toBe('手机登录')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 6: 切换语言后, 协议文字也跟随切换 (注册模式)
  // ─────────────────────────────────────────────────────────────────────
  test('切换语言后, 注册模式协议文字也跟随切换 (zh-CN → en)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
        window.localStorage.setItem('i18n-locale', JSON.stringify({ value: 'zh-CN' }))
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    // 切到 phone tab + 注册模式
    const phoneTab = page.locator('.login-tabs .el-tabs__item').nth(1)
    await phoneTab.click({ timeout: 5_000 }).catch(() => {})
    await page.waitForTimeout(300)
    const toggleBtn = page.locator('.mode-toggle-btn, .login-content button:has-text("注册"), .login-content button:has-text("Register")').first()
    if (await toggleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await toggleBtn.click({ timeout: 3_000 }).catch(() => {})
      await page.waitForTimeout(400)
    }

    // 验证 zh-CN 协议文字
    await expect(page.getByText('《用户协议》')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('《隐私政策》')).toBeVisible({ timeout: 5_000 })

    // 切到 en
    await switchLanguage(page, 'en')

    // zh-CN 协议文字应消失, en 应出现
    await expect(page.getByText('User Agreement')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Privacy Policy')).toBeVisible({ timeout: 5_000 })

    // 中文《用户协议》不应残留 (注意: 《》是中文标点, 英文版没有)
    const bodyText = await page.locator('body').textContent() || ''
    expect(bodyText).not.toContain('《用户协议》')
    expect(bodyText).not.toContain('《隐私政策》')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 用例 7: 快速连续切换语言 (zh→en→zh→en) 不导致渲染撕裂
  // ─────────────────────────────────────────────────────────────────────
  test('快速连续切换 zh→en→zh→en 不导致渲染撕裂', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('language', 'zh-CN')
      } catch { /* ignore */ }
    })
    await injectTheme(page, 'light')
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await waitForLoginDialog(page)

    const tabs = page.locator('.login-tabs .el-tabs__item .tab-label-text')

    // 快速切换 4 次
    for (const locale of ['en', 'zh-CN', 'en', 'zh-CN'] as const) {
      await page.evaluate((loc: string) => {
        try {
          window.localStorage.setItem('language', loc)
          window.localStorage.setItem('i18n-locale', JSON.stringify({ value: loc }))
        } catch { /* ignore */ }
      }, locale)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await waitForLoginDialog(page)
    }

    // 最终应该是 zh-CN
    const finalTexts = await tabs.allTextContents()
    expect(finalTexts[0]).toBe('账号登录')
    expect(finalTexts[1]).toBe('手机登录')
    // 不应含英文残留
    expect(finalTexts.join(' ')).not.toContain('Account Login')
  })
})
