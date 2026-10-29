// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { expect, setupTest, type Page } from './fixtures'

/**
 * 账号代理管理页(/admin/relay/account-proxy)真浏览器契约。
 *
 * 锁三件:① 入口命名与表头文案(本轮由「私有出口」改为「账号代理」,防回潮);
 * ② 代理状态筛选把 hasProxy 带到库侧(不是前端过滤);
 * ③ 设置→脱敏回显→清除 的闭环真的打到 PUT 并落回直连。
 * 副作用纪律:只在「停用 ∧ 直连」的行上写,收尾必须清回 null;
 * 挑不到这种行就跳过这一条,不改任何人已配置好的出口。
 */

const PATH = '/admin/relay/account-proxy'
const PROBE_URL = 'http://127.0.0.1:8877'
// 无账密的地址按 `scheme://host:port` 原样脱敏(带账密才替换成 ***@)
const PROBE_MASKED = 'http://127.0.0.1:8877'

async function gotoPage(page: Page) {
  // 冷编译首个 admin 路由可达分钟级,超时给足(本机实测 turbopack 缓存重建后首访 ~90s)
  await page.goto(PATH, { waitUntil: 'domcontentloaded', timeout: 240_000 })
  await page.waitForLoadState('networkidle', { timeout: 120_000 }).catch(() => {})
}

setupTest.describe('账号代理管理页', () => {
  setupTest('入口与文案已归「账号代理」,表头为「代理地址」', async ({ adminPage }) => {
    await gotoPage(adminPage)
    if (!adminPage.url().includes(PATH)) return setupTest.skip()

    await expect(adminPage.getByRole('heading', { level: 1, name: '账号代理' })).toBeVisible()
    await expect(adminPage.locator('th', { hasText: '代理地址' }).first()).toBeVisible()
    await expect(adminPage.getByRole('button', { name: '私有出口' })).toHaveCount(0)
  })

  setupTest('代理状态筛选把 hasProxy=true 带到库侧', async ({ adminPage }) => {
    await gotoPage(adminPage)
    if (!adminPage.url().includes(PATH)) return setupTest.skip()

    const requested = adminPage
      .waitForRequest(
        (r) => r.url().includes('/api/admin/relay/accounts') && r.url().includes('hasProxy=true'),
        { timeout: 30_000 },
      )
      .catch(() => null)

    await adminPage.getByRole('combobox', { name: '代理状态' }).click()
    await adminPage.getByRole('option', { name: '已配置代理' }).click()

    expect(await requested).not.toBeNull()
  })

  setupTest('设置代理→脱敏回显→清除回直连(只动停用且未配置的账号)', async ({ adminPage }) => {
    await gotoPage(adminPage)
    if (!adminPage.url().includes(PATH)) return setupTest.skip()

    const rows = adminPage.locator('table tbody tr')
    // 等列表落定:骨架行的 innerText 是空的,数据行才带平台名
    await expect
      .poll(
        async () =>
          (
            await rows
              .first()
              .innerText()
              .catch(() => '')
          ).trim().length,
        {
          timeout: 30_000,
          message: '等账号列表落定(骨架→数据)',
        },
      )
      .toBeGreaterThan(3)

    // 残留自愈:本探针若上一轮没清掉(断言失败即退出),先清回 null 再走闭环
    const stale = rows.filter({ hasText: PROBE_MASKED }).first()
    if (await stale.isVisible().catch(() => false)) {
      await stale.getByRole('button', { name: '清除' }).click()
      await adminPage.getByRole('dialog').last().getByRole('button', { name: '清除' }).click()
      await expect(adminPage.getByText('已清除代理').first()).toBeVisible({ timeout: 15_000 })
      await adminPage.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {})
    }

    const row = rows.filter({ hasText: '停用' }).filter({ hasText: '直连' }).first()
    if (!(await row.isVisible().catch(() => false))) return setupTest.skip()

    await row.getByRole('button', { name: '设置代理' }).click()
    // 页面另有一枚 aria-label="显示代理地址" 的按钮,getByLabel('代理地址') 会双命中
    await adminPage.getByRole('textbox', { name: '代理地址' }).fill(PROBE_URL)

    const put = adminPage
      .waitForResponse(
        (r) => r.request().method() === 'PUT' && r.url().includes('/api/admin/relay/accounts/'),
        { timeout: 30_000 },
      )
      .catch(() => null)
    await adminPage.getByRole('button', { name: '保存' }).click()

    const res = await put
    expect(res).not.toBeNull()
    expect(res!.ok()).toBe(true)
    await expect(adminPage.getByText('代理已保存').first()).toBeVisible({ timeout: 15_000 })
    await expect(adminPage.getByText(PROBE_MASKED).first()).toBeVisible({ timeout: 20_000 })

    const target = adminPage.locator('table tbody tr').filter({ hasText: PROBE_MASKED }).first()
    await target.getByRole('button', { name: '清除' }).click()
    const dialog = adminPage.getByRole('dialog').last()
    await dialog.getByRole('button', { name: '清除' }).click()

    await expect(adminPage.getByText('已清除代理').first()).toBeVisible({ timeout: 15_000 })
    await expect(adminPage.getByText(PROBE_MASKED)).toHaveCount(0, { timeout: 20_000 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
