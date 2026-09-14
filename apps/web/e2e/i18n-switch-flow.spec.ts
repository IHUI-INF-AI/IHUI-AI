// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  // 2026-09-14 确定性修复(负载 flaky):evaluate 写 localStorage 发生在「当前文档」,
  // goto 后新文档首帧 SSR 恒 zh-CN(src/i18n/request.ts 硬编码),目标语言要等
  // zustand persist rehydrate + I18nProvider 重渲染,全量负载下可能超出轮询预算。
  // 改 addInitScript:每次导航在新文档任何脚本前写入,首帧客户端渲染即目标语言,
  // 消灭"写→导航→rehydrate→重渲染"四段竞态(多次注册时后注册者后执行、最终值正确)。
  await page.addInitScript((l) => {
    try {
      localStorage.setItem(
        'ihui-language',
        JSON.stringify({ state: { locale: l, initialized: true }, version: 0 }),
      )
    } catch {
      // localStorage 不可用时忽略
    }
  }, locale)
  // 轮询保留作兜底(rehydrate 后重渲染仍需时间),预算 4 × 12s。
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
    // 2026-08-28 修复:switchLocale 内部有界重试(4 次 × 12s),5 语言最坏 ~240s,
    // 默认 30s 测试超时在高负载下不够 → 放宽到 150s
    test.setTimeout(150_000)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
