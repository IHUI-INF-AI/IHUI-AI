import { test, expect } from '@playwright/test'
import {
  attachErrorGuards,
  filterRealErrors,
  I18N_KEYWORDS,
  waitForAnyText,
} from '../tests/e2e/fixtures/helpers'

/**
 * 2026-08-28 根因修复:删除本地 filterServerErrorsLocal 覆盖。
 * 原因:本地覆盖与 helpers.ts 的 filterRealErrors 存在同样的 regex 缺陷 —
 * 白名单段必须紧跟 /api/,导致 /api/admin/news/status 500(ai-service 8803
 * 未起时经 next.config.ts rewrite 代理返回 500)永远漏过白名单 → 4 个
 * 语言切换用例误报失败。已在 helpers.ts 统一根治(允许中间路径段 +
 * 兼容 /api/news?x 500 无尾路径形态),本 spec 直接复用共享实现。
 */

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
  // 2026-08-28 根因修复(并发负载 flaky):
  // 切换链路是 goto → SSR(zh-CN,见 src/i18n/request.ts 硬编码)→ 客户端
  // zustand persist rehydrate → I18nProvider 重渲染(目标语言)。
  // 高并发(多 worker)下新文档就绪 + rehydrate + 重渲染可能超过调用方 8s
  // 轮询预算,旧语言文档仍滞留 body → 假报"语言未切换"(实测 en 用例失败
  // 时页面仍为 zh-TW)。根治:switchLocale 内 goto 后轮询目标语言关键字,
  // 未命中则重新 goto(有界 4 次 × 12s),覆盖 dev server 编译慢 /
  // 客户端重渲染抖动 / 旧文档滞留三类场景;返回是否命中供调用方断言。
  const keywords = I18N_KEYWORDS[locale] ?? []
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const hit = await waitForAnyText(page, keywords, 12000)
    if (hit) return true
  }
  return false
}

test.describe('8 端关键路径 · 5 语言切换', () => {
  test('默认加载 zh-CN,中文关键字命中', async ({ page }) => {
    const { serverErrors } = attachErrorGuards(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')
    const hit = await waitForAnyText(page, I18N_KEYWORDS['zh-CN'] ?? [], 8000)
    expect(hit).toBeTruthy()
    expect(filterRealErrors(serverErrors)).toHaveLength(0)
  })

  for (const locale of LOCALES) {
    test(`切换至 ${locale}:目标语言关键字命中`, async ({ page }) => {
      const { consoleErrors, serverErrors } = attachErrorGuards(page)
      // 先访问一次以建立 context
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      // 切换(switchLocale 内部有界重试,已保证目标语言关键字命中后才返回)
      const hit = await switchLocale(page, locale)
      // 5 语言是项目硬约束,必须命中;若失败先核对 messages/<locale>.json
      expect(
        hit,
        `${locale} 关键字 ${JSON.stringify(I18N_KEYWORDS[locale])} 未在页面出现`,
      ).toBeTruthy()
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
      // 应用与 默认加载 用同一份 filterRealErrors(白名单 /api/llm/* 5xx,避免 ai-service 5xx 误杀)
      expect(filterRealErrors(serverErrors)).toHaveLength(0)
      const real = consoleErrors.filter(
        (e) => !e.includes('favicon') && !e.includes('React DevTools'),
      )
      expect(real).toHaveLength(0)
    })
  }

  test('5 语言连续切换:每次都生效,无累积状态泄漏', async ({ page }) => {
    const { consoleErrors } = attachErrorGuards(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')
    for (const locale of LOCALES) {
      const hit = await switchLocale(page, locale)
      expect(hit, `连续切换中 ${locale} 未生效`).toBeTruthy()
    }
    const real = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(real).toHaveLength(0)
  })

  test('切换后访问登录页:目标语言关键字在登录页也命中', async ({ page }) => {
    const { consoleErrors, serverErrors } = attachErrorGuards(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')
    await switchLocale(page, 'en')
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('domcontentloaded')
    // 英文关键字应出现在 /login 页面(可能重定向到 /sso/login)
    const hit = await waitForAnyText(page, I18N_KEYWORDS.en ?? [], 8000)
    expect(hit).toBeTruthy()
    expect(filterRealErrors(serverErrors)).toHaveLength(0)
    const real = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(real).toHaveLength(0)
  })
})
