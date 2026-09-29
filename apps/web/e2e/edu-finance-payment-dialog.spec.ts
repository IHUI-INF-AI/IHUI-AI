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
 *  · **浏览器验到上屏**:财务页五个 tab(含「账期管理」)确实渲染出来 + 催费管理 tab 的
 *    「催缴触达统计」卡(后端 GET /fee-reminder/stats 已建成,前端必须真的调用并展示 ——
 *    "造好没装车"本仓最高频)。点 tab 后面板切换此前有"不切换"的存疑记录,
 *    2026-09-29 浏览器实测不复现(data-state 与面板均正确切换),本条 spec 即常驻证明。
 *  · **源码验形态**:缴费弹窗的三个自由文本框必须消失、改为期次下拉;账期面板不得预填
 *    期数/首期日(预填值会被当成机构选过的值存进账期,再原样出现在给家长的催缴文案里);
 *    催缴触达统计卡必须带上 caveat 与 unknownReminders(口径说明跟数字走,不留在注释里)。
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
    // 先等 tab 组出现再取文案:该页取数后才渲染 Tabs,直接 allInnerTexts 会拿到空数组
    // (实测间歇性红 —— 不是页面坏了,是探针比渲染快)。断言用"包含",不用固定数量,
    // 否则将来有人加一个 tab 就把这条钉红。
    await expect
      .poll(async () => page.getByRole('tab').count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
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

  /**
   * 源码维:催缴触达统计卡必须真的装在催费管理 tab 里(调 stats 端点 + 展示 caveat 与
   * unknownReminders)。后端 GET /fee-reminder/stats 落地后前端一度没有任何调用 ——
   * 数字只在 API 响应里,机构在界面上看不到,等价于没交付。此锁防它被静默拆掉。
   */
  test('催费 tab 装有催缴触达统计卡(调 stats 端点,caveat 与 unknown 随数字上屏)', () => {
    const s = src.finance()
    expect(s).toContain('/api/edu-ai-management/fee-reminder/stats?days=30')
    expect(s).toContain('催缴触达统计')
    expect(s).toContain('reminderStats.caveat')
    expect(s).toContain('reminderStats.delivery.unknownReminders')
  })

  /**
   * 源码维:无归属流水与撤销缴费必须装车(2026-09-29 第四批)。三件后端能力此前都是
   * "造好没装车":① loadUnattributedPayments 只有 service 没有出口;② DELETE
   * /payment-record/:id 前端零入口;③ 退费响应的 unattributed 标记前端从未消费 ——
   * 没挂到期次的钱在界面上永远不可见,机构以为已经收进账里。此锁防再被静默拆掉。
   */
  test('无归属流水点名与撤销缴费装车(端点调用+警示条+撤销按钮+退费无归属toast)', () => {
    const s = src.finance()
    expect(s).toContain('/api/edu-ai-management/payment-record/unattributed')
    expect(s).toContain('`/api/edu-ai-management/payment-record/${id}`')
    expect(s).toContain('handleVoidPayment')
    expect(s).toContain('confirmDialog')
    expect(s).toContain('没有挂到期次')
    expect(s).toContain('res.unattributed')
  })

  /**
   * 上屏维:点「催费管理」tab 后统计卡可见(空库也成立 —— total=0 仍渲染"登记催缴 0 条")。
   * 同时是"点 tab 面板会切换"的常驻证明:此前该页有"点击后面板不切换"的存疑记录,
   * 2026-09-29 浏览器实测不复现;若此条红,先看是不是又回到那个交互问题。
   */
  test('催费管理 tab 打开后催缴触达统计卡上屏', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/finance', { waitUntil: 'domcontentloaded' })
    await requireLoggedIn(page)
    await expect
      .poll(async () => page.getByRole('tab').count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
    // 该页是受控 Tabs:click 若发生在 React hydration 之前,onValueChange 不触发,
    // 面板不切换(实测稳定复现的 flaky 根因)。networkidle ⇒ 首轮取数完成,hydration 必已完成。
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /催费管理/ }).click()
    await expect(page.getByText('催缴触达统计（近 30 天）')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/登记催缴 \d+ 条/)).toBeVisible({ timeout: 20_000 })
  })

  /**
   * 上屏维:点「缴费记录」tab 后,无归属警示条与撤销列所在的表格二选一出现 ——
   * 有流水 ⇒ 表格(带操作列表头);无流水 ⇒ 空态文案。断言不依赖库数据,空库也恒真;
   * 无归属警示条 total=0 时不渲染,故不作上屏断言(渲染路径已由源码锁守住)。
   */
  test('缴费记录 tab 打开后表格(带操作列)或空态出现', async ({ adminPage: page }) => {
    await page.goto('/edu/edu-management/finance', { waitUntil: 'domcontentloaded' })
    await requireLoggedIn(page)
    await expect
      .poll(async () => page.getByRole('tab').count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: /缴费记录/ }).click()
    await expect(
      page
        .getByRole('columnheader', { name: '操作' })
        .or(page.getByText('暂无缴费记录'))
        .first(),
    ).toBeVisible({ timeout: 20_000 })
  })

  /**
   * 教育三页在侧栏三级可达 —— 按用户真实点击路径逐层展开。
   * 这条断言存在的理由是它守的正是我踩过两次的坑:条目挂进扁平 ADMIN_NAV 时
   * 类型/lint/源码锁全绿,而侧栏一条不显(那份数据不进渲染路径);
   * 之后再拿"未挂载组件里的按钮"当探针,又得出一个反向的错误结论。
   * 层级文案取自已验证的数据源:一级 `nav.admin`=管理后台,二级 `nav.adminGroup.courseExam`=课程考试。
   * 若这两处 i18n 文案改了,本条会红并点名层级 —— 那是提醒同步改测试,不是页面的错。
   */
  test('侧栏按真实路径展开后能看到教育三页入口', async ({ adminPage: page }) => {
    test.setTimeout(90_000)
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await requireLoggedIn(page)
    await expect
      .poll(async () => page.getByText('管理后台', { exact: true }).count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
    await page.getByText('管理后台', { exact: true }).first().click()
    const group = page.getByText('课程考试', { exact: true }).first()
    await expect(group, '二级分组「课程考试」未出现(检查 nav.adminGroup.courseExam)').toBeVisible({
      timeout: 20_000,
    })
    await group.click()
    const eduLinks = page.locator('a[href^="/admin/edu"]')
    await expect(eduLinks.filter({ hasText: /./ }).first()).toBeVisible({ timeout: 20_000 })
    const hrefs = await page
      .locator('a[href^="/admin/edu"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') as string))
    for (const want of ['/admin/edu/class/schedule', '/admin/edu/student', '/admin/edu/finance']) {
      expect(hrefs, `侧栏三级里应能看到 ${want}`).toContain(want)
    }
  })
  /**
   * 数据维:上一版锁打在扁平清单上 —— 那等于锁在一份不影响渲染的数据里
   * (类型检查与断言都绿,侧栏却一条不显)。所以这条锁分组段,上屏维由上面那条负责。
   */
  test('教育三页挂在侧栏实际读取的分组清单里(不是只挂扁平清单)', () => {
    const nav = src.nav()
    const groupStart = nav.indexOf('ADMIN_NAV_GROUPS')
    expect(groupStart, '找不到 ADMIN_NAV_GROUPS 定义').toBeGreaterThan(-1)
    const groups = nav.slice(groupStart)
    for (const href of ['/admin/edu/class/schedule', '/admin/edu/student', '/admin/edu/finance']) {
      expect(groups, `分组清单里应有 ${href}`).toContain(`href: '${href}'`)
    }
  })

  test('扁平 ADMIN_NAV 也带这三条(供 path-labels 的标题映射使用,不负责渲染)', () => {
    const s = src.nav()
    for (const href of ['/admin/edu/class/schedule', '/admin/edu/student', '/admin/edu/finance']) {
      expect(s, `清单里应有 ${href}`).toContain(`href: '${href}'`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
