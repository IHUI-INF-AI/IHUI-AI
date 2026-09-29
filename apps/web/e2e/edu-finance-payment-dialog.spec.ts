// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { setupTest as test, expect } from './fixtures'
import { readFileSync } from 'node:fs'

/**
 * 缴费登记弹窗与后台菜单的运行时取证(2026-09-29)。
 *
 * 为什么这条 spec 存在:缴费契约在当天从「按姓名自由文本」改成「按报名(期次)选择」。
 * 只靠 typecheck 与单测证不了**上屏**——本仓最高频的失效型就是
 * "宿主、store、渲染点全在,唯独没人挂"/"绿在账面而界面上没有"。
 * 断言刻意不依赖数据库里有没有名册数据(只断控件形态与文案),
 * 否则空库环境会把它变成一台与内容无关的恒红 spec。
 */
test.describe('教育财务 - 缴费登记按报名期次归属', () => {
  test('缴费弹窗用「期次」选择器,且不再有姓名/班级自由文本框', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/finance', { waitUntil: 'domcontentloaded' })

    // 该页是 Tabs,「添加缴费」在「缴费记录」面板内 —— 不切过去就找不到(第一次取证就这么红的)
    await page.getByRole('tab', { name: '缴费记录' }).click({ timeout: 20_000 })

    const open = page.getByRole('button', { name: /添加缴费/ })
    await expect(open).toBeVisible({ timeout: 20_000 })
    await open.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // 新形态:必须出现"期次（报名）"标签与一个下拉触发器
    await expect(dialog.getByText('期次（报名）')).toBeVisible()
    await expect(dialog.getByRole('combobox').first()).toBeVisible()

    // 新形态:金额 + 只读的"本期欠费" + 收据号 + 备注 = 至多 4 个文本框,归属改为下拉。
    // 刻意不用精确相等 —— 精确计数会被一次无关的表单增项钉红,而这条要守的是
    // "归属不得再用自由文本表达"那一型(由下面三条 placeholder 归零来守)。
    expect(await dialog.getByRole('textbox').count()).toBeLessThanOrEqual(4)
    await expect(dialog.getByPlaceholder('学员姓名')).toHaveCount(0)
    await expect(dialog.getByPlaceholder('班级名称')).toHaveCount(0)
    await expect(dialog.getByPlaceholder('如：学费')).toHaveCount(0)

    // 未选期次时保存按钮必须不可用(不允许把归属留空交给后端猜)
    await expect(dialog.getByRole('button', { name: /添加缴费/ })).toBeDisabled()
  })

  /**
   * 这条**故意不断言 DOM**。
   * 第一次写成 `a[href="/admin/edu/student"]` 是否出现在侧栏,跑出来是 MISS ——
   * 但对照着看,连既有的 /admin/edu/course/pay、/admin/edu/organization 也 MISS:
   * 本机后台可见菜单只有 7 条,实际由后端菜单表(`/api/admin/menu/getRouters`)驱动,
   * `ADMIN_NAV` 这份静态清单不是运行时菜单来源。
   * 所以"挂进静态清单"只等于**登记**,不等于上屏;把 DOM 断言写进来只会得到一台
   * 与真实原因无关的恒红 spec。真正让这三页可点需要菜单表数据变更(另一码事)。
   * 这里只锁"清单里别再丢条目"(被回退删掉时本锁会红)。
   */
  test('AdminNav 静态清单已登记三个后台教育页(登记维,非上屏维)', async () => {
    const src = readFileSync(
      new URL('../src/components/layout/AdminNav.tsx', import.meta.url),
      'utf8',
    )
    for (const href of ['/admin/edu/class/schedule', '/admin/edu/student', '/admin/edu/finance']) {
      expect(src, `清单里应有 ${href}`).toContain(`href: '${href}'`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
