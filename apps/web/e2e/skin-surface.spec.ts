// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 皮肤表面覆盖视觉守门(2026-11-27 立,门 329 的视觉腿)
 *
 * 静态门 329 只看 tokens 角色与皮肤映射的差集,看不见两类真实漏配:
 *   ① 元素级局部作用域重写变量 —— 如 .login-scope 把 --color-muted/accent 写死为纯白;
 *   ② 显式 hsl 灰阶规则绕开变量 —— 如登录 tablist / 密码强度条轨道。
 * 本 spec 在真实渲染面上量"中性大面"(面积 ≥ 2400px²、不透明、色度差 < 14 的灰/黑/白),
 * 皮肤开启后必须为 0:出现任何一块,就是"半套换肤"回潮。
 *
 * 皮肤色板单一来源:直接 import src/lib/theme-skins 的 PINK_SKIN,不复制色值(§22c)。
 * 挂 public project(无登录态依赖):皮肤是纯前端 store,注入 localStorage 即可,
 * 缺 E2E_ADMIN_PASSWORD 时也能独立执行。
 */

import { test, expect, type Page } from '@playwright/test'

import { PINK_SKIN } from '../src/lib/theme-skins'

const SURFACES = ['/chat', '/settings/appearance', '/'] as const

/** 面积阈值(px²):只量"大面",细线与小图标不参与 */
const MIN_AREA = 2400
/** 色度差(max-min):低于此值视为无彩色(灰/黑/白) */
const NEUTRAL_SPREAD = 14

interface Surface {
  color: string
  area: number
  el: string
}

async function neutralLargeSurfaces(page: Page): Promise<Surface[]> {
  return page.evaluate(
    ({ minArea, spread }) => {
      const parse = (c: string) => {
        const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
        if (!m) return null
        return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
      }
      const desc = (el: Element) => {
        const cls = String((el as HTMLElement).className || '').slice(0, 70)
        return (
          el.tagName.toLowerCase() +
          (el.getAttribute('data-testid') ? `[t=${el.getAttribute('data-testid')}]` : '') +
          (cls ? '.' + cls.replace(/\s+/g, '.') : '')
        )
      }
      const out: Surface[] = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width * r.height < minArea) continue
        const cs = getComputedStyle(el as HTMLElement)
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
        if (r.bottom < 0 || r.top > innerHeight) continue
        const bg = parse(cs.backgroundColor)
        if (!bg || bg.a < 0.6) continue
        if (Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b) >= spread) continue
        out.push({
          color: `rgb(${bg.r},${bg.g},${bg.b})`,
          area: Math.round(r.width * r.height),
          el: desc(el),
        })
      }
      return out.sort((a, b) => b.area - a.area).slice(0, 10)
    },
    { minArea: MIN_AREA, spread: NEUTRAL_SPREAD },
  )
}

test.describe('皮肤表面覆盖:芭比粉开启后无中性大面', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((skin) => {
      localStorage.setItem(
        'ihui-appearance-settings',
        JSON.stringify({ state: { customTheme: skin }, version: 0 }),
      )
      localStorage.setItem('theme', 'light')
    }, PINK_SKIN)
  })

  for (const path of SURFACES) {
    test(`${path} 中性大面为零`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })

      await expect
        .poll(
          () =>
            page.evaluate(() => ({
              attr: document.documentElement.getAttribute('data-custom-theme'),
              bg: getComputedStyle(document.documentElement)
                .getPropertyValue('--color-background')
                .trim(),
            })),
          { timeout: 30_000 },
        )
        .toEqual({ attr: 'true', bg: PINK_SKIN.light.background })

      await expect
        .poll(
          async () =>
            (await neutralLargeSurfaces(page)).map((s) => `${s.color} ${s.area}px² ${s.el}`),
          { timeout: 30_000 },
        )
        .toEqual([])
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
