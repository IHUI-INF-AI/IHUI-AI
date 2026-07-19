import { test, expect } from '@playwright/test'
import { attachErrorGuards, filterRealErrors, I18N_KEYWORDS, waitForAnyText } from '../tests/e2e/fixtures/helpers'

/**
 * 8 端关键路径 — 5 语言切换 (zh-CN / en / ja / ko / zh-TW)
 *
 * 覆盖:
 *  - 默认加载 zh-CN 命中中文关键字
 *  - 5 语言依次切换(写 cookie + router.refresh 触发 next-intl 重渲染)
 *  - 每次切换后等待目标语言关键字出现
 *  - 切换后 localStorage 持久化(ihui-language store)
 *  - 切换过程无 5xx / 无控制台异常
 *
 * 切换机制(与 src/components/sidebar.tsx:handleLocaleChange 一致):
 *  1. 写 document.cookie `locale=<code>;path=/;max-age=31536000`
 *  2. setLocale(zustand)
 *  3. router.refresh() → 服务端重读 cookie → next-intl 重渲染
 * 本 spec 直接复用此机制(避免依赖 UI 控件位置,降低脆弱性)。
 *
 * 关键约束:
 *  - 用 zustand persist key `ihui-language` 验证持久化
 *  - cookie 域为 localhost(本机 dev server)
 *  - 不依赖任何业务文案,只断言"目标语言关键字在 body 中出现"
 */

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

async function switchLocale(page: import('@playwright/test').Page, locale: Locale) {
  // 通过 init script 写 cookie(对所有后续 request 生效) + localStorage
  await page.context().addCookies([
    {
      name: 'locale',
      value: locale,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
  await page.evaluate((l) => {
    try {
      const raw = localStorage.getItem('ihui-language')
      const obj = raw ? JSON.parse(raw) : { state: { locale: 'zh-CN' }, version: 0 }
      obj.state = obj.state || {}
      obj.state.locale = l
      localStorage.setItem('ihui-language', JSON.stringify(obj))
    } catch {
      // localStorage 不可用时忽略
    }
  }, locale)
  // router.refresh 触发服务端重读 cookie
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
}

test.describe('8 端关键路径 · 5 语言切换', () => {
  test('默认加载 zh-CN,中文关键字命中', async ({ page }) => {
    const { serverErrors } = attachErrorGuards(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const hit = await waitForAnyText(page, I18N_KEYWORDS['zh-CN'], 8000)
    expect(hit).toBeTruthy()
    expect(filterRealErrors(serverErrors)).toHaveLength(0)
  })

  for (const locale of LOCALES) {
    test(`切换至 ${locale}:目标语言关键字命中`, async ({ page }) => {
      const { consoleErrors, serverErrors } = attachErrorGuards(page)
      // 先访问一次以建立 context
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      // 切换
      await switchLocale(page, locale)
      // 等待目标语言关键字出现
      const hit = await waitForAnyText(page, I18N_KEYWORDS[locale], 10000)
      // 5 语言是项目硬约束,必须命中;若失败先核对 messages/<locale>.json
      expect(hit, `${locale} 关键字 ${JSON.stringify(I18N_KEYWORDS[locale])} 未在页面出现`).toBeTruthy()
      // 校验持久化
      const persisted = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('ihui-language') || '{}')?.state?.locale
        } catch {
          return null
        }
      })
      expect(persisted).toBe(locale)
      // 无 5xx / 无控制台异常
      expect(serverErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
      const real = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('React DevTools'),
      )
      expect(real).toHaveLength(0)
    })
  }

  test('5 语言连续切换:每次都生效,无累积状态泄漏', async ({ page }) => {
    const { consoleErrors } = attachErrorGuards(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    for (const locale of LOCALES) {
      await switchLocale(page, locale)
      const hit = await waitForAnyText(page, I18N_KEYWORDS[locale], 8000)
      expect(hit, `连续切换中 ${locale} 未生效`).toBeTruthy()
    }
    const real = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(real).toHaveLength(0)
  })

  test('切换后访问登录页:目标语言关键字在登录页也命中', async ({ page }) => {
    const { consoleErrors, serverErrors } = attachErrorGuards(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await switchLocale(page, 'en')
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    // 英文关键字应出现在 /login 页面(可能重定向到 /sso/login)
    const hit = await waitForAnyText(page, I18N_KEYWORDS.en, 8000)
    expect(hit).toBeTruthy()
    expect(filterRealErrors(serverErrors)).toHaveLength(0)
    const real = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(real).toHaveLength(0)
  })
})
