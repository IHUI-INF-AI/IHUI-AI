// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from '@playwright/test'

/**
 * 下载功能验证 — 2026-08-06 立,2026-10-20 改走「侧边栏用户行下拉 → 下载客户端子菜单」。
 *
 * 改判据立因:旧实现等 `[aria-label*="下载"] / [title*="下载"] / [data-tooltip*="下载"]`
 * 恒超时。374de0cbcc 删掉 SidebarActions,把「下载客户端」折进侧边栏底部用户行的下拉子菜单
 * (SidebarUserRow.tsx:176-224),而 Radix DropdownMenu 的 Content 走 Portal —— 打开前菜单项
 * 根本不在 DOM 里;本项目又禁用原生 title(check-no-native-dialog.mjs)、从不渲染 data-tooltip,
 * 三条选择器全死。trigger 的 aria-label 是用户昵称(:330),不能当定位依据,
 * 故用 aside#main-sidebar 内 .group/row 这一结构标记(与 sidebar-visual.spec.ts 同源用法)。
 * 子菜单入口按 Radix MenuSubTrigger 源码走 click 打开(onClick → onOpenChange(true);
 * pointermove 那条路要等 100ms open timer,不适合测试)。
 *
 * 验证项:
 * 1. 用户行下拉可打开,「下载客户端」入口可见且 aria-haspopup=menu
 * 2. 点子菜单入口 → 8 端下载项全部列出(DOWNLOADS 条目)
 * 3. 已接入端真的可点(点「桌面客户端」→ 跳 /download/desktop)
 * 4. 未接入端显示"即将上线",且禁用态与角标逐条同起同落(环境前提:CI/本地均未配
 *    NEXT_PUBLIC_DOWNLOAD_*,resolveIosHref/resolveAndroidHref/resolveWechatHref 返回 '' ⇒ 3 端未接入)
 * 5. 截图:默认态 + dark mode
 *
 * 使用 admin storageState(已登录),baseURL=http://localhost:8801
 */

// 桌面侧栏唯一 id(见 Sidebar.tsx「保证 DOM id 唯一」注记);用户行 row 即 button
const USER_ROW_TRIGGER = 'aside#main-sidebar button[class*="group/row"]'
// DOWNLOADS(src/lib/downloads.tsx)8 端在 zh-CN 下的显示名(nav.downloadXxx)
const DOWNLOAD_LABELS = [
  'Web 版',
  '桌面客户端',
  'iOS App',
  'Android APK',
  '移动端 H5',
  '微信小程序',
  '浏览器插件',
  '命令行工具',
]

test.describe('下载功能验证', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })
  test('侧边栏用户行下拉 → 下载客户端子菜单展示 8 端下载项', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // 1. 打开用户行下拉(SidebarUserRow 要等 mounted && isAuthenticated)
    const userRow = page.locator(USER_ROW_TRIGGER).first()
    await expect(userRow, '侧边栏用户行(trigger)应可见').toBeVisible({ timeout: 15000 })
    await userRow.click()

    const menu = page.locator('[role="menu"]').first()
    await expect(menu, '用户行下拉菜单应出现').toBeVisible({ timeout: 10000 })

    // 2. 「下载客户端」入口:子菜单 trigger(Radix SubTrigger = role=menuitem + aria-haspopup)
    const downloadEntry = menu.getByRole('menuitem', { name: /下载客户端/ }).first()
    await expect(downloadEntry, '「下载客户端」入口应在用户行下拉内').toBeVisible()
    await expect(downloadEntry).toHaveAttribute('aria-haspopup', 'menu')

    // 3. 点开子菜单 → 新出现一层 [role="menu"](SubContent 也 Portal 到 body 末尾)
    const menusBefore = await page.locator('[role="menu"]').count()
    await downloadEntry.click()
    await expect
      .poll(async () => page.locator('[role="menu"]').count(), { timeout: 10000 })
      .toBe(menusBefore + 1)
    const submenu = page.locator('[role="menu"]').last()
    await expect(submenu, '下载客户端子菜单应可见').toBeVisible()

    // 截图:默认态(子菜单展开)
    await page.screenshot({ path: 'e2e/screenshots/download-popover-default.png', fullPage: false })

    // 4. 8 端条目齐备
    const items = submenu.getByRole('menuitem')
    const itemCount = await items.count()
    expect(itemCount, `下载子菜单应列出 8 端,实际 ${itemCount}`).toBe(8)
    for (const label of DOWNLOAD_LABELS) {
      await expect(
        submenu.locator('[role="menuitem"]', { hasText: label }).first(),
        `下载子菜单应含「${label}」`,
      ).toBeVisible()
    }

    // 5. 禁用态与"即将上线"角标逐条同起同落(SidebarUserRow:disabled=!available,
    //    角标只在 !available 时渲染),并确认确有未接入端(环境前提见文件头)
    const coupling: Array<{ label: string; disabled: boolean; soon: boolean }> = []
    for (let i = 0; i < itemCount; i++) {
      const item = items.nth(i)
      const info = await item.evaluate((el) => ({
        text: el.textContent ?? '',
        disabled: el.hasAttribute('data-disabled'),
      }))
      coupling.push({
        label: `#${i}`,
        disabled: info.disabled,
        soon: info.text.includes('即将上线'),
      })
    }
    for (const c of coupling) {
      expect(
        c.disabled,
        `${c.label}:禁用态与"即将上线"角标必须同起同落(disabled=${c.disabled}, soon=${c.soon})`,
      ).toBe(c.soon)
    }
    expect(
      coupling.filter((c) => c.soon).length,
      '至少有一个未接入端显示"即将上线"',
    ).toBeGreaterThanOrEqual(1)
    expect(
      coupling.filter((c) => !c.disabled).length,
      '至少有一个已接入端可点',
    ).toBeGreaterThanOrEqual(1)

    // 6. dark mode 截图(同一子菜单展开态)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'e2e/screenshots/download-popover-dark.png', fullPage: false })

    // 7. 已接入端真的可点:桌面端 href='/download/desktop'(内部路由)→ 点击应发生跳转
    await submenu.locator('[role="menuitem"]', { hasText: '桌面客户端' }).first().click()
    await expect(page, '点「桌面客户端」应跳到下载详情页').toHaveURL(/\/download\/desktop/, {
      timeout: 15000,
    })
  })

  test('下载详情页 /download/desktop 可访问', async ({ page }) => {
    await page.goto('/download/desktop')
    await page.waitForLoadState('domcontentloaded')

    // 验证页面加载成功(不 404)
    const title = await page.title()
    expect(title).not.toContain('404')

    // 截图
    await page.screenshot({ path: 'e2e/screenshots/download-detail-desktop.png', fullPage: false })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
