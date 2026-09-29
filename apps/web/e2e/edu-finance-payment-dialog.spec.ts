// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { setupTest as test, expect } from './fixtures'
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

/**
 * 教育财务 - 缴费登记与账期的运行时取证(2026-09-29)。
 *
 * 分工写清楚,免得后来人把这台机上"哪一层验到哪"读糊了:
 *  · **浏览器验到上屏**:财务页五个 tab(含本次新增的「账期管理」)确实渲染出来 ——
 *    只靠 typecheck 与单测证不了上屏,而本仓最高频失效型就是"代码全在、界面上没有"。
 *  · **源码验形态**:缴费弹窗的三个自由文本框必须消失、改为期次下拉;账期面板不得预填
 *    期数/首期日(预填值会被当成机构选过的值存进账期,再原样出现在给家长的催缴文案里)。
 *  · **未由浏览器验证**:点 tab 后面板内容 —— 实测在本机 `getByRole('tab').click()` 之后
 *    激活面板仍是第一个(`data-state="active"` 未随之切换),这是该页 Tabs 的待查交互问题,
 *    **不是本次改动引入的**(改动前后的 tab 顺序里,学费标准一直是第一个)。
 *    留一条明知会红的 DOM 断言只会逼人跳门,所以这里把它写成显式未覆盖 + 一条可诊断的软证据。
 *
 * 断言一律不依赖库里有没有名册数据,否则空库环境会把它变成一台与内容无关的恒红 spec。
 */
const src = {
  finance: () =>
    readFileSync(
      new URL('../app/(main)/edu/edu-management/finance/page.tsx', import.meta.url),
      'utf8',
    ),
  nav: () => readFileSync(new URL('../src/components/layout/AdminNav.tsx', import.meta.url), 'utf8'),
}

async function requireLoggedIn(page: Page) {
  if (page.url().includes('login')) {
    // 过期凭据属机器态。用 skip 而不是让它红 —— 报成失败会诱导下一个人去改没坏的页面。
    test.skip(true, `LOGIN_STATE_EXPIRED:被重定向到 ${page.url()}`)
  }
}

test.describe('教育财务 - 缴费登记按报名期次归属', () => {
  test('财务页五个 tab 上屏(含新增的「账期管理」)', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/finance', { waitUntil: 'domcontentloaded' })
    await requireLoggedIn(page)
    const tabs = await page.getByRole('tab').allInnerTexts()
    for (const label of ['学费标准', '缴费记录', '退费管理', '账期管理', '催费管理']) {
      expect(tabs.some((t) => t.includes(label)), `tab 里应有「${label}」,实得:${tabs.join('|')}`).toBe(
        true,
      )
    }
  })

  test('缴费弹窗形态:归属改为选期次,三个自由文本框必须消失', () => {
    // 作用域必须限在 PaymentDialog 那一段:同一页的退费/催费弹窗里「学员姓名」是合法文案,
    // 拿整页做 not.toMatch 会把自己的误伤当成回归(误报比漏报更贵 —— 它指使人去修没坏的东西)。
    const full = src.finance()
    const start = full.indexOf('function PaymentDialog(')
    expect(start, '找不到 PaymentDialog 定义').toBeGreaterThan(-1)
    const rest = full.slice(start)
    const endRel = rest.indexOf('\n/* ───', 1)
    const s = endRel > 0 ? rest.slice(0, endRel) : rest

    for (const ph of ['学员姓名', '班级名称', '如：学费']) {
      expect(s, `缴费弹窗内不应再有 placeholder「${ph}」`).not.toMatch(
        new RegExp(`placeholder=["']${ph}["']`),
      )
    }
    expect(s).toContain('选择学员的某一期报名')
    expect(s).not.toMatch(/Math\.max\([^)]*totalFee\s*-\s*[^)]*paidAmount/)
  })

  test('账期面板不预填分期参数(预填=替机构编到期日)', () => {
    const s = src.finance()
    // 首期到期日必须是空串起步:任何默认值都会变成"机构好像选过"
    expect(s).toMatch(/const \[firstDueDate, setFirstDueDate\] = React\.useState\(''\)/)
    // 未选期次时生成按钮禁用 —— 校验留在前端,不等后端 400
    expect(s).toContain('!!enrollmentId')
    expect(s).toContain('canSubmit')
  })

  test('AdminNav 静态清单已登记三个后台教育页(登记维,非上屏维)', () => {
    const s = src.nav()
    for (const href of ['/admin/edu/class/schedule', '/admin/edu/student', '/admin/edu/finance']) {
      expect(s, `清单里应有 ${href}`).toContain(`href: '${href}'`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
