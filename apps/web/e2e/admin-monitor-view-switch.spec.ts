// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * 监控面板页两种呈现切换器的无障碍接线锁(2026-10-20,真实浏览器)
 *
 * 契约(与 apps/web/app/(main)/admin/monitor/panels/page.tsx 同批):
 *   - 整页只有一个 Tabs 根,根同时包 TabsList 与两块 TabsContent;
 *   - 选中的那枚 tab 的 aria-controls 必须指向页面里真存在的元素,而那块元素以
 *     role=tabpanel 呈现、aria-labelledby 指回这枚 tab;
 *   - 切换件住在视图自己的顶栏里(顶栏在 tabpanel 内)⇒ 它不独立占一行
 *     (机主 2026-10-20 定档:切换件要显眼,但不许把内容往下挤一行)。
 *
 * 立项成因是一次真实缺陷:切换器曾自带一个 Tabs 根而整页不渲染 TabsContent,于是两枚
 * tab 的 aria-controls 全部悬空、整页没有 role=tabpanel(读屏拿到两个"选项卡"却不知
 * 道它们控制哪块内容)。本 spec 的断言在修好前的那个线上版本上实测为红,修好后为绿
 * —— 回归锁钉在 e2e 每次都跑的那一层,不只住在自检档里。
 */
test.describe('监控面板 两种呈现切换器(真实浏览器)', () => {
  test('选中的 tab ⇒ aria-controls 指到真存在的 tabpanel', async ({ adminPage }) => {
    test.setTimeout(120_000)
    await adminPage.goto('/admin/monitor/panels', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    })

    await expect(adminPage.getByRole('tab')).toHaveCount(2, { timeout: 20_000 })

    const active = adminPage.getByRole('tab', { selected: true })
    await expect(active).toHaveCount(1)
    const activeId = await active.getAttribute('id')
    const controls = await active.getAttribute('aria-controls')
    expect(controls, 'tab 必须带 aria-controls').toBeTruthy()
    expect(activeId, 'tab 必须有自己的 id 供面板回指').toBeTruthy()

    const panel = adminPage.getByRole('tabpanel')
    await expect(panel, '整页必须恰有一块呈现挂在 tabpanel 语义上').toHaveCount(1)
    await expect(panel).toHaveId(controls!)
    await expect(panel).toHaveAttribute('aria-labelledby', activeId!)
    await expect(
      active.locator('xpath=ancestor::div[@role="tabpanel"]'),
      '切换件必须住在被它控制的那块面板里(独立一行=住在面板外)',
    ).toHaveCount(1)

    // 切到另一档:面板换成那一枚 tab 指的那块,且引用仍然解析得到
    const other = adminPage.getByRole('tab', { name: '数据大屏' })
    const otherControls = (await other.getAttribute('aria-controls'))!
    await other.click()
    await expect(other).toHaveAttribute('aria-selected', 'true')
    await expect(adminPage.getByRole('tabpanel')).toHaveCount(1)
    await expect(adminPage.getByRole('tabpanel')).toHaveId(otherControls)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
