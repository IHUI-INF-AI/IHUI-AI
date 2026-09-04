// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌​​‌‌​‌‌‌​‌‌‌​‌‌‌‌‍‍

import { test, expect, type Page } from './fixtures'

/**
 * 浮动弹窗视口定位防回归(2026-09-04 立)。
 *
 * 病根(实测 2026-09-04,用户报告"斜杠按钮呼出的弹窗超出屏幕,把正常屏幕往上挤"):
 * - 手写 createPortal 面板(slash-command-palette / context-usage-ring /
 *   permission-history-panel / add-menu-popover)容器漏写 position:fixed
 *   → computed static → top/left 全部失效 → 面板以文档流追加到 body 末尾,
 *   把 body.scrollHeight 撑高(实测 720 → 1111)。
 *
 * 修复:
 * - 四组件接入 lib/portal-panel-position.ts(fixed + 翻转 + 视口 clamp + maxHeight);
 * - globals.css 兜底:body 直属 role=dialog/menu/listbox 强制 position:fixed。
 *
 * 本 spec 锁死三条契约(以 /chat 页高频弹窗为样本):
 *  1. 弹窗 computed position === 'fixed';
 *  2. 弹窗矩形完全落在视口内(四边 ≥ 0 且 ≤ 视口);
 *  3. 弹窗打开前后 document.body.scrollHeight 不变(布局不被撑开)。
 */

async function bodyScrollHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.body.scrollHeight)
}

/** 校验当前所有 body 直属 dialog/menu 浮层:fixed + 视口内 */
async function assertPanelsInViewport(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const VH = window.innerHeight
    const VW = window.innerWidth
    const bad: string[] = []
    for (const el of Array.from(document.body.children)) {
      if (!(el instanceof HTMLElement)) continue
      const role = el.getAttribute('role')
      if (role !== 'dialog' && role !== 'menu') continue
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      // 藏到屏幕外的待定位面板(top:-9999)跳过
      if (r.top < -9000) continue
      if (cs.position !== 'fixed') bad.push(`${role} position=${cs.position}`)
      if (r.top < -1 || r.bottom > VH + 1 || r.left < -1 || r.right > VW + 1) {
        bad.push(
          `${role} rect out of viewport: top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} left=${Math.round(r.left)} right=${Math.round(r.right)} vh=${VH}`,
        )
      }
    }
    return bad
  })
  expect(violations, `浮层溢出视口: ${violations.join('; ')}`).toEqual([])
}

test.describe('浮动弹窗视口定位(斜杠/用量环弹窗)', () => {
  test('斜杠命令面板:fixed + 视口内 + 不撑开 body', async ({ authenticatedPage: page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('button', { name: /.*/ }).first()).toBeVisible()

    const before = await bodyScrollHeight(page)

    // 点开斜杠按钮(aria-label 来自 a11y.slashCommand)
    const slashBtn = page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ has: page.locator('svg.lucide-square-slash') })
      .first()
    await expect(slashBtn).toBeVisible({ timeout: 20_000 })
    await slashBtn.click()
    await page.waitForTimeout(500)

    // 契约 3:body 不被撑开
    const after = await bodyScrollHeight(page)
    expect(after, '弹窗打开后 body.scrollHeight 不得变化(布局被撑开即病根复发)').toBe(before)

    // 契约 1+2:fixed + 视口内
    await assertPanelsInViewport(page)

    await page.keyboard.press('Escape')
  })

  test('上下文用量环弹窗:fixed + 视口内 + 不撑开 body', async ({ authenticatedPage: page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    const before = await bodyScrollHeight(page)

    const trigger = page.getByTestId('context-usage-trigger')
    await expect(trigger).toBeVisible({ timeout: 20_000 })
    await trigger.click()
    await page.waitForTimeout(500)

    const after = await bodyScrollHeight(page)
    expect(after, '弹窗打开后 body.scrollHeight 不得变化(布局被撑开即病根复发)').toBe(before)

    await assertPanelsInViewport(page)

    await page.keyboard.press('Escape')
  })
})
