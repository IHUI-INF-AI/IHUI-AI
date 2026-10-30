// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Tooltip 箭头裁剪回归守卫 (2026-10-30 立)
 *
 * 根因:
 *   `apps/web/src/components/feedback/Tooltip.tsx` 的 Radix TooltipPrimitive.Content 曾带
 *   `overflow-hidden`,而 Radix 把 Arrow 包在 translateY(100%) 的外溢 wrapper 里(箭头顶在气泡盒
 *   之外)。overflow-hidden 会把箭头整枚切掉 ⇒ 气泡与目标之间留一段空白、相邻图标看不出指哪一个。
 *   这是 batch-7 在 `packages/ui-react/src/components/tooltip.tsx` 修掉的同源 bug 的孪生体,
 *   app 级这份当时漏改,本次(2026-10-30)已移除 overflow-hidden 修复。
 *   实证见 batch-7 探针:8801 现网 7/7 悬停样本箭头落在内容盒外被判裁(bottom 6 / right 1)。
 *
 * 守卫点:
 *   1. 悬停侧边栏导航项触发 feedback Tooltip 后,Content 的 computed overflow 不得为 hidden
 *      (回归守卫:overflow-hidden 一旦被加回,箭头会被裁)。
 *   2. Arrow([data-radix-tooltip-arrow]) 必须存在且尺寸 > 0(未被裁成 0)。
 *   3. Arrow 应位于内容盒之外(translateY(100%) 顶出)——被裁时虽 DOM 仍在,但 overflow=hidden
 *      已由第 1 条兜住;此条作为辅助,确认箭头确实"探出"气泡而不是缩在里面。
 *
 * 复用 sidebar-height-verify.spec.ts 的公开首页入口(无需登录即可渲染侧边栏 + feedback Tooltip)。
 */

const SHOT_DIR = 'tmp/tooltip-arrow-shots'
// 精确匹配桌面侧边栏(排除移动端 dialog 树)
const DESKTOP_ASIDE = 'aside[aria-label="主导航"]:not([role="dialog"])'
// 目标服务器可配置:默认 8801(现网),本地验证修复时指向带修复的 dev server(如 8911)。
const E2E_BASE_URL = process.env.IHUI_E2E_BASE_URL ?? 'http://localhost:8801'

// 侧边栏折叠态的持久化键(Sidebar.tsx:74 读 / :84 写)。
// 关键:NavLink 只在 collapsed=true 时才把导航项包进 feedback/Tooltip
// (src/components/sidebar/NavLink.tsx:78-95);展开态是裸 <Link>,压根没有 Tooltip。
// ⇒ 本守卫必须先进折叠态,否则悬停侧栏永远不会出现 Radix 提示框。
const COLLAPSED_KEY = 'sidebar-collapsed'

/**
 * 载入首页并进入「侧边栏折叠态」。
 * dev 下首屏路由要现编译,故 goto 有重试;折叠态由 localStorage 持久化 ⇒ 写完必须 reload 才生效。
 * theme 一并写入并 reload,保证 reload 之后仍是目标主题(否则深色用例等于白跑)。
 */
async function prepareHome(page: Page, theme: 'light' | 'dark') {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(`${E2E_BASE_URL}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.evaluate(
        ({ collapsedKey, mode }) => {
          try {
            localStorage.setItem(collapsedKey, 'true')
            localStorage.setItem('theme', mode)
          } catch {}
        },
        { collapsedKey: COLLAPSED_KEY, mode: theme },
      )
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
      // 折叠态由 Sidebar 的 useEffect 读 localStorage 后才切换,给一拍
      await page.waitForTimeout(2500)
      return
    } catch (e) {
      if (attempt === 2) throw e
      await page.waitForTimeout(2000)
    }
  }
}

async function assertTooltipArrowNotClipped(page: Page, tag: string, theme: 'light' | 'dark') {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await prepareHome(page, theme)
  await expect(page.locator(DESKTOP_ASIDE)).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(1000)

  if (theme === 'dark') {
    // 深色态必须真的生效,否则这个用例等于白跑(应用若不读 'theme' 键则手工补 class)
    await page.evaluate(() => {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    })
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5000 })
    await page.waitForTimeout(300)
  }

  // 折叠态下 NavLink 才被 feedback/Tooltip 包住;Radix Trigger 会给触发元素打 data-state,
  // 故用 [data-state] 过滤 —— 它同时证明两件事:① 折叠态已生效 ② 它确实是一枚 Tooltip 触发器。
  // (展开态的导航项是裸 <Link>,没有 data-state,也没有 Tooltip ⇒ 悬停它永远不会出提示框。)
  const firstNavLink = page.locator(`${DESKTOP_ASIDE} a[data-testid^="nav-"][data-state]`).first()
  await firstNavLink.waitFor({ state: 'visible', timeout: 20000 })
  await firstNavLink.scrollIntoViewIfNeeded()
  await firstNavLink.hover()
  // 只认 feedback/Tooltip 产出的那枚 Radix tooltip(内容盒带 text-xs px-2 特征类);
  // 侧栏/页脚里一直挂着的 CSS 二维码提示框也带 role="tooltip" 但无箭头,必须排除。
  const tip = page.locator('[role="tooltip"].text-xs.px-2').first()
  await expect(tip, `${tag}: feedback Tooltip 应出现`).toBeVisible({ timeout: 10000 })

  await page.waitForTimeout(300) // 等箭头定位稳定
  await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-tooltip.png`), fullPage: false })

  const data = await tip.evaluate((el) => {
    const content = el as HTMLElement
    const cs = getComputedStyle(content)
    const cRect = content.getBoundingClientRect()
    // Arrow 可能以多种形态存在:Radix Tooltip 用 data-radix-tooltip-arrow,
    // 不同版本也可能落在 data-radix-popper-arrow 或直接是个 svg。逐个兜底。
    const arrowEl =
      (content.querySelector('[data-radix-tooltip-arrow]') as HTMLElement | null) ??
      (content.querySelector('[data-radix-popper-arrow]') as HTMLElement | null) ??
      (content.querySelector('svg') as HTMLElement | null)
    const debugHtml = content.outerHTML.slice(0, 400)
    let arrowInfo: null | {
      w: number
      h: number
      outsideLeft: boolean
      outsideRight: boolean
      outsideTop: boolean
      outsideBottom: boolean
      fullyInside: boolean
    } = null
    if (arrowEl) {
      const r = arrowEl.getBoundingClientRect()
      arrowInfo = {
        w: Math.round(r.width),
        h: Math.round(r.height),
        outsideLeft: r.right < cRect.left + 1,
        outsideRight: r.left > cRect.right - 1,
        outsideTop: r.bottom < cRect.top + 1,
        outsideBottom: r.top > cRect.bottom - 1,
        fullyInside:
          r.top >= cRect.top &&
          r.bottom <= cRect.bottom &&
          r.left >= cRect.left &&
          r.right <= cRect.right,
      }
    }
    return {
      overflow: cs.overflow,
      overflowY: cs.overflowY,
      arrow: arrowInfo,
      arrowTag: arrowEl
        ? arrowEl.tagName +
          (arrowEl.getAttribute('data-radix-tooltip-arrow') !== null
            ? '[arrow]'
            : arrowEl.getAttribute('data-radix-popper-arrow') !== null
              ? '[popper]'
              : '')
        : null,
      debugHtml,
    }
  })

  console.info(`=== ${tag} tooltip DOM ===`)
  console.info(JSON.stringify(data, null, 2))
  console.info(`=== ${tag} console errors ===`)
  console.info(consoleErrors.length === 0 ? '(无)' : consoleErrors.join('\n'))

  // 守卫 1:Content 不得裁剪箭头
  expect(
    `${data.overflow} ${data.overflowY}`,
    `${tag}: tooltip 内容盒不得裁剪箭头(回归守卫:feedback/Tooltip overflow-hidden 裁 Arrow)`,
  ).not.toContain('hidden')

  // 守卫 2:Arrow 必须存在且尺寸 > 0
  expect(data.arrow, `${tag}: tooltip 必须渲染 Arrow`).not.toBeNull()
  expect(data.arrow!.w, `${tag}: Arrow 宽度应 > 0(未被裁掉)`).toBeGreaterThan(0)
  expect(data.arrow!.h, `${tag}: Arrow 高度应 > 0(未被裁掉)`).toBeGreaterThan(0)

  // 守卫 3:Arrow 应探出内容盒(被 overflow 裁掉时虽 DOM 仍在,但守卫 1 已兜住;此处确认其外溢形态)
  const a = data.arrow!
  const sticksOut = a.outsideLeft || a.outsideRight || a.outsideTop || a.outsideBottom
  expect(
    sticksOut && !a.fullyInside,
    `${tag}: Arrow 应顶在内容盒之外(若 overflow-hidden 被裁则不可见/尺寸异常)`,
  ).toBeTruthy()

  // 收尾:确保无 hydration / 运行时报错
  expect(
    consoleErrors.filter((e) => /hydrat|Maximum update depth|Cannot read|undefined is not/.test(e)),
    `${tag}: 不应有 hydration / 运行时报错`,
  ).toHaveLength(0)
}

test.describe('Tooltip 箭头裁剪回归守卫', () => {
  // dev 模式首屏路由现编译,30s 默认预算不够(实测首次 goto+reload 就吃掉大半);
  // 串行跑避免两个 worker 同时压 dev server 造成编译争抢。
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('light mode: 侧边栏 Tooltip 箭头可见且未被裁', async ({ page }) => {
    await assertTooltipArrowNotClipped(page, 'light', 'light')
  })

  test('dark mode: 侧边栏 Tooltip 箭头可见且未被裁', async ({ page }) => {
    await assertTooltipArrowNotClipped(page, 'dark', 'dark')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
